import { Download, Loader2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import {
  FORMAT_INFO, SCALES, loadExportOptions, maxAllowedScale, pagesToExport, pixelSize, saveExportOptions, scaleAllowed, usesQuality, usesScale,
  type ExportFormat, type ExportOptions,
} from '@/editor/export/exportOptions';
import { useDocumentStore } from '@/editor/store/documentStore';

interface Props { open: boolean; onClose(): void; title: string }

export default function ExportDialog({ open, onClose, title }: Props) {
  const doc = useDocumentStore((s) => s.doc);
  const activePageId = useDocumentStore((s) => s.activePageId) ?? '';
  const { toast } = useToast();
  const [opts, setOpts] = useState<ExportOptions>(loadExportOptions);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const busy = progress !== null;

  const info = FORMAT_INFO[opts.format];
  const pageCount = doc ? pagesToExport(doc, opts.scope, activePageId).length : 0;
  const maxScale = doc ? maxAllowedScale(doc.width, doc.height) : 1;
  const effScale = doc && !scaleAllowed(doc.width, doc.height, opts.scale) ? maxScale : opts.scale;
  const size = useMemo(() => (doc ? pixelSize(doc.width, doc.height, effScale) : null), [doc, effScale]);
  const set = (patch: Partial<ExportOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const close = () => { if (busy) abort.current?.abort(); onClose(); };

  const run = async () => {
    if (!doc || busy) return;
    const final = { ...opts, scale: effScale };
    saveExportOptions(final);
    abort.current = new AbortController();
    setProgress({ done: 0, total: pageCount });
    try {
      const { exportDesign, downloadBlob } = await import('@/editor/export/exporters');
      const { blob, filename } = await exportDesign(
        { doc, title, activePageId, signal: abort.current.signal, onProgress: (done, total) => setProgress({ done, total }) }, final,
      );
      downloadBlob(blob, filename);
      toast(`„${filename}“ wurde heruntergeladen.`);
      onClose();
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) toast(err instanceof Error ? err.message : 'Der Export ist fehlgeschlagen.', 'error');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Herunterladen">
      {doc && (
        <div className="space-y-4 text-sm" data-testid="export-dialog">
          <fieldset>
            <legend className="mb-1.5 font-medium">Dateityp</legend>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Dateityp">
              {(Object.keys(FORMAT_INFO) as ExportFormat[]).map((f) => (
                <label key={f} className={`cursor-pointer rounded-md border px-2 py-2 text-center font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${opts.format === f ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                  <input type="radio" name="export-format" className="sr-only" checked={opts.format === f} onChange={() => set({ format: f })} />
                  {FORMAT_INFO[f].label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{info.hint}</p>
          </fieldset>

          {doc.pages.length > 1 && (
            <fieldset>
              <legend className="mb-1.5 font-medium">Seiten</legend>
              <div className="space-y-1">
                <label className="flex items-center gap-2"><input type="radio" name="export-scope" checked={opts.scope === 'current'} onChange={() => set({ scope: 'current' })} /> Aktuelle Seite</label>
                <label className="flex items-center gap-2"><input type="radio" name="export-scope" checked={opts.scope === 'all'} onChange={() => set({ scope: 'all' })} /> Alle {doc.pages.length} Seiten
                  <span className="text-xs text-muted-foreground">{opts.format === 'pdf' ? '(eine PDF-Datei)' : '(als ZIP)'}</span></label>
              </div>
            </fieldset>
          )}

          {usesScale(opts.format) && (
            <div>
              <label htmlFor="export-scale" className="mb-1.5 block font-medium">Größe</label>
              <select id="export-scale" value={effScale} onChange={(e) => set({ scale: Number(e.target.value) })} className="h-9 w-full rounded-md border border-border bg-background px-2">
                {SCALES.map((s) => (
                  <option key={s} value={s} disabled={!scaleAllowed(doc.width, doc.height, s)}>
                    {s}× · {pixelSize(doc.width, doc.height, s).width} × {pixelSize(doc.width, doc.height, s).height} px{scaleAllowed(doc.width, doc.height, s) ? '' : ' (zu groß für den Browser)'}
                  </option>
                ))}
              </select>
              {size && <p className="mt-1 text-xs text-muted-foreground" data-testid="export-size">Ergebnis: {size.width} × {size.height} px</p>}
            </div>
          )}

          {usesQuality(opts.format) && (
            <div>
              <label htmlFor="export-quality" className="mb-1.5 flex justify-between font-medium">Qualität <span className="tabular-nums text-muted-foreground">{Math.round(opts.quality * 100)} %</span></label>
              <input id="export-quality" type="range" min={0.3} max={1} step={0.01} value={opts.quality} onChange={(e) => set({ quality: Number(e.target.value) })} className="w-full" />
            </div>
          )}

          {busy && (
            <div role="status" className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Seite {Math.min(progress.done + 1, progress.total)} von {progress.total} wird erstellt…
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={close}>{busy ? 'Abbrechen' : 'Schließen'}</Button>
            <Button onClick={run} disabled={busy || !pageCount || maxScale === 0} data-testid="export-run"><Download className="mr-2 h-4 w-4" />Herunterladen</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
