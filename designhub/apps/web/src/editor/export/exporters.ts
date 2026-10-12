import { zipSync } from 'fflate';
import { pageToSvg, type DesignDocument } from '@designhub/shared';
import { exportFileName, FORMAT_INFO, pagesToExport, pixelSize, scaleAllowed, usesScale, type ExportOptions } from './exportOptions';

export interface ExportResult { blob: Blob; filename: string }
export interface ExportContext {
  doc: DesignDocument;
  title: string;
  activePageId: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

const canvasToBlob = (c: HTMLCanvasElement, mime: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Das Bild konnte nicht erzeugt werden (zu groß für diesen Browser?).'))), mime, quality));

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Export abgebrochen', 'AbortError');
}

/**
 * Exportiert das Dokument. Eine Seite → eine Datei; mehrere Seiten → PDF mit allen Seiten, sonst ZIP.
 * Renderer und Bibliotheken werden erst hier geladen, damit sie nicht im Editor-Bundle liegen.
 */
export async function exportDesign(ctx: ExportContext, opts: ExportOptions): Promise<ExportResult> {
  const { doc, title, onProgress, signal } = ctx;
  const pages = pagesToExport(doc, opts.scope, ctx.activePageId);
  if (!pages.length) throw new Error('Keine Seite zum Exportieren.');
  if (usesScale(opts.format) && !scaleAllowed(doc.width, doc.height, opts.scale)) {
    throw new Error('Diese Größe ist für den Browser zu groß. Wähle einen kleineren Faktor.');
  }
  const info = FORMAT_INFO[opts.format];
  const render = await import('./renderPage');
  await render.preparePages(pages);
  checkAbort(signal);
  const total = pages.length;
  onProgress?.(0, total);

  if (opts.format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const pt = (px: number) => px * 0.75; // 96 dpi → 72 pt
    const orient = doc.width >= doc.height ? 'l' : 'p';
    const pdf = new jsPDF({ unit: 'pt', format: [pt(doc.width), pt(doc.height)], orientation: orient, compress: true });
    for (const [i, page] of pages.entries()) {
      const canvas = await render.renderPageToCanvas(doc, page, opts.scale, true);
      if (i > 0) pdf.addPage([pt(doc.width), pt(doc.height)], orient);
      pdf.addImage(canvas.toDataURL('image/jpeg', opts.quality), 'JPEG', 0, 0, pt(doc.width), pt(doc.height), undefined, 'FAST');
      onProgress?.(i + 1, total);
      checkAbort(signal);
      await new Promise((r) => setTimeout(r, 0)); // Oberfläche atmen lassen
    }
    pdf.setProperties({ title });
    return { blob: pdf.output('blob'), filename: exportFileName(title, 'pdf') };
  }

  const files: { name: string; blob: Blob }[] = [];
  for (const [i, page] of pages.entries()) {
    const name = exportFileName(title, info.ext, total > 1 ? i : undefined);
    if (opts.format === 'svg') {
      const svg = pageToSvg({ width: doc.width, height: doc.height }, page, { textLines: render.measureTextLines(page.elements) });
      files.push({ name, blob: new Blob([svg], { type: info.mime }) });
    } else {
      const canvas = await render.renderPageToCanvas(doc, page, opts.scale, opts.format === 'jpg');
      files.push({ name, blob: await canvasToBlob(canvas, info.mime, opts.quality) });
      canvas.width = canvas.height = 0; // Speicher früh freigeben
    }
    onProgress?.(i + 1, total);
    checkAbort(signal);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (files.length === 1) return { blob: files[0]!.blob, filename: files[0]!.name };
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  // Bilder sind schon komprimiert; Level 0 spart Zeit
  return { blob: new Blob([zipSync(entries, { level: opts.format === 'svg' ? 6 : 0 })], { type: 'application/zip' }), filename: exportFileName(title, 'zip') };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export { pixelSize };
