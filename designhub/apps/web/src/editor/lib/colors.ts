export interface Rgb { r: number; g: number; b: number }

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
const hex2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');

/** "#abc", "abc", "#aabbcc", "AABBCC" → "#aabbcc"; sonst null. */
export function normalizeHex(input: string): string | null {
  const m = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(m)) return '#' + [...m].map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(m) ? '#' + m : null;
}

export function hexToRgb(hex: string): Rgb | null {
  const n = normalizeHex(hex);
  return n ? { r: parseInt(n.slice(1, 3), 16), g: parseInt(n.slice(3, 5), 16), b: parseInt(n.slice(5, 7), 16) } : null;
}

export const rgbToHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** Gibt eine nutzbare Hex-Farbe zurück (für <input type=color>), auch bei "transparent" oder rgb(...). */
export function toHexOrDefault(color: string, fallback = '#000000'): string {
  const direct = normalizeHex(color);
  if (direct) return direct;
  const m = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  return m ? rgbToHex({ r: +m[1], g: +m[2], b: +m[3] }) : fallback;
}

/** Lesbare Textfarbe (schwarz/weiß) für einen Hintergrund. */
export function readableOn(hex: string): '#000000' | '#ffffff' {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.6 ? '#000000' : '#ffffff';
}

export const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Grundfarben', colors: ['#000000', '#545454', '#a6a6a6', '#d9d9d9', '#ffffff', '#ff5757', '#ff914d', '#ffde59', '#7ed957', '#00bf63', '#00c2cb', '#5271ff', '#7d2ae8', '#ff66c4'] },
  { name: 'Pastell', colors: ['#fde8ec', '#fdebd3', '#fff6c9', '#e3f5d3', '#d4f1e7', '#d6ecf8', '#e1e0fa', '#f3dcf5'] },
  { name: 'Erde', colors: ['#f6f1e7', '#e8d8a8', '#c9a26b', '#a1673d', '#6e4a2f', '#1f3a2e', '#0f4c5c', '#14161f'] },
];
