import type { DesignDocument, Page } from '@designhub/shared';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';
export type PageScope = 'current' | 'all';

export interface ExportOptions {
  format: ExportFormat;
  scope: PageScope;
  /** Faktor auf die Dokumentgröße (1 = 1 Pixel pro Dokumentpixel). Gilt für PNG, JPG und PDF-Rasterbilder. */
  scale: number;
  /** 0.1–1, nur JPG und PDF */
  quality: number;
}

export const DEFAULT_EXPORT: ExportOptions = { format: 'png', scope: 'current', scale: 1, quality: 0.92 };
export const SCALES = [0.5, 1, 2, 3, 4] as const;

/** Browser-Grenzen für Canvas: Kantenlänge und Gesamtfläche (Safari/mobil sind am strengsten). */
export const MAX_SIDE = 16384;
export const MAX_PIXELS = 64_000_000;

export const FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; mime: string; hint: string }> = {
  png: { label: 'PNG', ext: 'png', mime: 'image/png', hint: 'Verlustfrei, ideal für Grafiken und Text.' },
  jpg: { label: 'JPG', ext: 'jpg', mime: 'image/jpeg', hint: 'Kleinere Dateien, ideal für Fotos. Weißer Hintergrund statt Transparenz.' },
  svg: { label: 'SVG', ext: 'svg', mime: 'image/svg+xml', hint: 'Vektor. Schriften werden nicht eingebettet, sie müssen beim Betrachter installiert sein.' },
  pdf: { label: 'PDF', ext: 'pdf', mime: 'application/pdf', hint: 'Dokument mit allen gewählten Seiten; Seiten sind Rasterbilder.' },
};

export const usesScale = (f: ExportFormat) => f !== 'svg';
export const usesQuality = (f: ExportFormat) => f === 'jpg' || f === 'pdf';

export function pixelSize(width: number, height: number, scale: number) {
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function scaleAllowed(width: number, height: number, scale: number): boolean {
  const { width: w, height: h } = pixelSize(width, height, scale);
  return w <= MAX_SIDE && h <= MAX_SIDE && w * h <= MAX_PIXELS;
}

/** Größter erlaubter Faktor aus SCALES (0, wenn nicht einmal 0,5× passt). */
export function maxAllowedScale(width: number, height: number): number {
  return [...SCALES].reverse().find((s) => scaleAllowed(width, height, s)) ?? 0;
}

export function pagesToExport(doc: DesignDocument, scope: PageScope, activePageId: string): Page[] {
  if (scope === 'all') return doc.pages;
  const p = doc.pages.find((x) => x.id === activePageId) ?? doc.pages[0];
  return p ? [p] : [];
}

/** Dateiname ohne Pfadzeichen und Steuerzeichen; Seitennummer nur bei mehreren Dateien. */
export function exportFileName(title: string, ext: string, pageIndex?: number): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80) || 'Design';
  return pageIndex === undefined ? `${base}.${ext}` : `${base}-${pageIndex + 1}.${ext}`;
}

const KEY = 'designhub.export';
export function loadExportOptions(): ExportOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ExportOptions> | null;
    if (!raw) return DEFAULT_EXPORT;
    return {
      format: raw.format && raw.format in FORMAT_INFO ? raw.format : DEFAULT_EXPORT.format,
      scope: raw.scope === 'all' ? 'all' : 'current',
      scale: (SCALES as readonly number[]).includes(raw.scale as number) ? (raw.scale as number) : DEFAULT_EXPORT.scale,
      quality: typeof raw.quality === 'number' && raw.quality >= 0.1 && raw.quality <= 1 ? raw.quality : DEFAULT_EXPORT.quality,
    };
  } catch { return DEFAULT_EXPORT; }
}
export function saveExportOptions(o: ExportOptions) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* privater Modus: Einstellung bleibt nur für diese Sitzung */ }
}
