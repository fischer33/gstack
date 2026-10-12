import { newId, type IconElement, type ImageElement, type ShapeElement, type ShapeKind, type TextElement } from '@designhub/shared';
import { ICON_VIEWBOX, type IconDef } from '../lib/icons';

interface PageSize { width: number; height: number }
export type TextKind = 'heading' | 'subheading' | 'body';

const base = (page: PageSize, width: number, height: number) => ({
  id: newId(), x: Math.round((page.width - width) / 2), y: Math.round((page.height - height) / 2), width, height,
  rotation: 0, opacity: 1, locked: false, visible: true,
});

const TEXT_STYLE: Record<TextKind, { label: string; size: number; weight: 400 | 700; widthRatio: number }> = {
  heading: { label: 'Überschrift', size: 0.09, weight: 700, widthRatio: 0.8 },
  subheading: { label: 'Unterüberschrift', size: 0.055, weight: 700, widthRatio: 0.7 },
  body: { label: 'Füge hier deinen Text ein', size: 0.035, weight: 400, widthRatio: 0.6 },
};

/** Größen relativ zur Seite, damit ein Text auf Story und Visitenkarte gleich gut lesbar startet. */
export function createText(page: PageSize, kind: TextKind = 'body'): TextElement {
  const s = TEXT_STYLE[kind];
  const unit = Math.min(page.width, page.height);
  const fontSize = Math.max(12, Math.round(unit * s.size));
  const width = Math.round(Math.min(page.width, page.height * 1.5) * s.widthRatio);
  return {
    ...base(page, width, Math.round(fontSize * 1.2)), type: 'text', text: s.label, fontFamily: 'Inter', fontSize,
    fontWeight: s.weight, italic: false, underline: false, align: 'left', fill: '#1e2030', lineHeight: 1.2, letterSpacing: 0,
  };
}

export function createShape(page: PageSize, kind: ShapeKind): ShapeElement {
  const unit = Math.min(page.width, page.height);
  const size = Math.round(unit * 0.3);
  const common = { type: 'shape' as const, kind, stroke: '#1e2030', strokeWidth: 0 };
  if (kind === 'line' || kind === 'arrow') {
    // Linien haben eine höhere, unsichtbare Trefferfläche, damit man sie gut greifen kann.
    const sw = Math.max(4, Math.round(unit * 0.008));
    return { ...base(page, Math.round(unit * 0.4), Math.max(24, sw * 4)), ...common, fill: 'transparent', stroke: '#1e2030', strokeWidth: sw };
  }
  const fill = kind === 'ellipse' ? '#00b8c4' : kind === 'star' ? '#ffbd59' : '#7d2ae8';
  return { ...base(page, size, size), ...common, fill, stroke: 'transparent', ...(kind === 'rect' ? { cornerRadius: 0 } : {}), ...(kind === 'star' ? { points: 5 } : {}) };
}

/** Bild mit natürlicher Größe auf höchstens 60 % der Seite eingepasst, zentriert. */
export function createImage(page: PageSize, src: string, natural: { width: number; height: number }): ImageElement {
  const k = Math.min(1, (page.width * 0.6) / natural.width, (page.height * 0.6) / natural.height);
  const w = Math.max(20, Math.round(natural.width * k)), h = Math.max(20, Math.round(natural.height * k));
  return { ...base(page, w, h), type: 'image', src, naturalWidth: natural.width, naturalHeight: natural.height, flipX: false, flipY: false, filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0 } };
}

export function createIcon(page: PageSize, icon: IconDef): IconElement {
  const size = Math.round(Math.min(page.width, page.height) * 0.2);
  return { ...base(page, size, size), type: 'icon', name: icon.name, path: icon.path, viewBox: ICON_VIEWBOX, fill: '#7d2ae8' };
}

/** Sticker sind Emoji als Text: einfärben lässt sich nichts, dafür sind sie auf jedem Gerät sofort verfügbar. */
export function createSticker(page: PageSize, emoji: string): TextElement {
  const fontSize = Math.round(Math.min(page.width, page.height) * 0.18);
  return {
    ...base(page, Math.round(fontSize * 1.5), Math.round(fontSize * 1.2)), type: 'text', name: 'Sticker', text: emoji,
    fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji', fontSize, fontWeight: 400, italic: false, underline: false,
    align: 'center', fill: '#000000', lineHeight: 1.2, letterSpacing: 0,
  };
}

/** Fertige Schriftkombinationen für das Text-Panel. Größe relativ zur kürzeren Seite. */
export interface TextPreset { label: string; sample: string; font: string; weight: 400 | 700; size: number; fill: string; spacing?: number; italic?: boolean }
export const TEXT_PRESETS: TextPreset[] = [
  { label: 'Plakat', sample: 'GROSSER TITEL', font: 'Bebas Neue', weight: 400, size: 0.14, fill: '#14161f', spacing: 2 },
  { label: 'Elegant', sample: 'Elegante Zeile', font: 'Playfair Display', weight: 700, size: 0.08, fill: '#2b1a20' },
  { label: 'Handschrift', sample: 'Von Hand', font: 'Pacifico', weight: 400, size: 0.09, fill: '#c2185b' },
  { label: 'Modern', sample: 'Modern & klar', font: 'Montserrat', weight: 700, size: 0.07, fill: '#0f4c5c' },
  { label: 'Schreibmaschine', sample: 'Typed note', font: 'Space Mono', weight: 400, size: 0.05, fill: '#1f3a2e' },
  { label: 'Magazin', sample: 'Magazin', font: 'Abril Fatface', weight: 400, size: 0.11, fill: '#d9482b' },
];

export function createTextFromPreset(page: PageSize, p: TextPreset): TextElement {
  const t = createText(page, 'heading');
  const fontSize = Math.max(12, Math.round(Math.min(page.width, page.height) * p.size));
  return { ...t, text: p.sample, fontFamily: p.font, fontWeight: p.weight, fontSize, fill: p.fill, letterSpacing: p.spacing ?? 0, italic: !!p.italic, height: Math.round(fontSize * 1.2) };
}

export const TEXT_KINDS: { kind: TextKind; label: string }[] = [
  { kind: 'heading', label: 'Überschrift' }, { kind: 'subheading', label: 'Unterüberschrift' }, { kind: 'body', label: 'Fließtext' },
];

/** Bild lesen, Größe prüfen. Wirft eine verständliche Meldung bei Problemen. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export async function readImageFile(file: File): Promise<{ src: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Das ist keine Bilddatei.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Das Bild ist größer als 10 MB.');
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    r.readAsDataURL(file);
  });
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    img.onerror = () => reject(new Error('Das Bild ist beschädigt oder wird nicht unterstützt.'));
    img.src = src;
  });
  return { src, ...size };
}
