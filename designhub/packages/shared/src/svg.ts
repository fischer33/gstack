import { isSafePathData, type Background, type Element, type ImageFilters, type Page } from './document';

export interface SvgOptions {
  /**
   * Exakte Zeilenumbrüche je Text-Element (ID → Zeilen), z. B. aus der Messung mit Konva. Ohne Angabe schätzt der Renderer
   * den Umbruch mit fester Zeichenbreite: genau genug für Vorschaubilder, für den Export sollte man messen.
   */
  textLines?: Readonly<Record<string, readonly string[]>>;
  /** CSS, das als <style> in die Datei kommt (z. B. @import der benötigten Webschriften). Wird nicht maskiert: nur vertrauenswürdig erzeugen. */
  styles?: string;
}

/**
 * Rendert eine Seite als SVG-String. Rein funktional, ohne DOM, damit es auf Server (Vorschaubilder)
 * und Client (SVG-Export) identisch läuft. Ziel ist Deckung mit dem Canvas-Renderer (Konva): gleiche Verlaufsformel,
 * Textausrichtung in der Mitte der Zeile, gestreckte statt beschnittene Bilder, Pfeilspitzen in Konva-Größe.
 *
 * Grenzen: Blocksatz gibt es in SVG nicht (wird linksbündig), Bildfilter sind eine Näherung der Konva-Filter.
 */
export function pageToSvg(size: { width: number; height: number }, page: Page, options: SvgOptions = {}): string {
  const { width, height } = size;
  const defs: string[] = [];
  const ctx: Ctx = { defs, lines: options.textLines ?? {} };
  const body = [background(page.background, width, height, defs), ...page.elements.map((e) => render(e, ctx))].join('');
  const style = options.styles ? `<style>${options.styles.replace(/<\/style/gi, '')}</style>` : ''; // </style> kann den Block nicht verlassen
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}" height="${num(height)}">` +
    (defs.length || style ? `<defs>${style}${defs.join('')}</defs>` : '') + body + '</svg>'
  );
}

interface Ctx { defs: string[]; lines: Readonly<Record<string, readonly string[]>> }

export const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${toBase64(svg)}`;

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const num = (n: number) => String(Math.round(n * 100) / 100);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
let uid = 0;

function background(bg: Background, w: number, h: number, defs: string[]): string {
  const rect = (fill: string) => `<rect width="${num(w)}" height="${num(h)}" fill="${fill}"/>`;
  if (bg.type === 'solid') return rect(esc(bg.color));
  if (bg.type === 'image') {
    // Wie im Editor: weiße Fläche darunter (bei "Einpassen" bleiben Ränder), Bild füllt oder passt ein
    return rect('#ffffff') + `<image href="${esc(bg.src)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid ${bg.fit === 'cover' ? 'slice' : 'meet'}"/>`;
  }
  // CSS-Winkel (0° = nach oben, 90° = nach rechts). Start-/Endpunkt wie im Editor, in Seitenkoordinaten, damit der Winkel
  // auch bei nicht quadratischen Seiten stimmt.
  const id = `g${++uid}`, a = ((bg.angle - 90) * Math.PI) / 180, cx = w / 2, cy = h / 2;
  const r = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
  const stops = bg.stops.map((s) => `<stop offset="${s.offset}" stop-color="${esc(s.color)}"/>`).join('');
  defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(cx - Math.cos(a) * r)}" y1="${num(cy - Math.sin(a) * r)}" x2="${num(cx + Math.cos(a) * r)}" y2="${num(cy + Math.sin(a) * r)}">${stops}</linearGradient>`);
  return rect(`url(#${id})`);
}

function render(el: Element, ctx: Ctx): string {
  if (!el.visible) return '';
  const transform = `translate(${num(el.x)} ${num(el.y)})` + (el.rotation ? ` rotate(${num(el.rotation)} ${num(el.width / 2)} ${num(el.height / 2)})` : '');
  const opacity = el.opacity < 1 ? ` opacity="${num(el.opacity)}"` : '';
  return `<g transform="${transform}"${opacity}>${inner(el, ctx)}</g>`;
}

function inner(el: Element, ctx: Ctx): string {
  const { defs } = ctx;
  const { width: w, height: h } = el;
  switch (el.type) {
    case 'shape': {
      const paint = `fill="${esc(el.fill)}" stroke="${esc(el.stroke)}" stroke-width="${num(el.strokeWidth)}"`;
      if (el.kind === 'rect') return `<rect width="${num(w)}" height="${num(h)}" rx="${num(el.cornerRadius ?? 0)}" ${paint}/>`;
      if (el.kind === 'ellipse') return `<ellipse cx="${num(w / 2)}" cy="${num(h / 2)}" rx="${num(w / 2)}" ry="${num(h / 2)}" ${paint}/>`;
      if (el.kind === 'star') return `<polygon points="${starPoints(w, h, el.points ?? 5)}" ${paint}/>`;
      // Linie/Pfeil: Strich in Kontur-, sonst Füllfarbe
      const color = esc(el.strokeWidth > 0 ? el.stroke : el.fill);
      const sw = Math.max(el.strokeWidth, 1);
      const line = `<line x1="0" y1="${num(h / 2)}" x2="${num(w)}" y2="${num(h / 2)}" stroke="${color}" stroke-width="${num(sw)}" stroke-linecap="round"/>`;
      if (el.kind === 'line') return line;
      const head = sw * 3; // wie Konva.Arrow (Länge und Breite je 3 × Strichstärke)
      return line + `<polygon points="${num(w)},${num(h / 2)} ${num(w - head)},${num(h / 2 - head / 2)} ${num(w - head)},${num(h / 2 + head / 2)}" fill="${color}"/>`;
    }
    case 'text': {
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const x = el.align === 'center' ? w / 2 : el.align === 'right' ? w : 0;
      const lines = ctx.lines[el.id] ?? wrap(el.text, w, el.fontSize, el.letterSpacing);
      // Konva zeichnet jede Zeile mittig in ihrer Zeilenbox (textBaseline 'middle'): dominant-baseline=central entspricht dem
      const lineBox = el.fontSize * el.lineHeight;
      const spans = lines.map((l, i) => `<tspan x="${num(x)}" y="${num((i + 0.5) * lineBox)}">${esc(l)}</tspan>`).join('');
      let filter = '';
      if (el.shadow) {
        const id = `s${++uid}`;
        defs.push(`<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="${num(el.shadow.offsetX)}" dy="${num(el.shadow.offsetY)}" stdDeviation="${num(el.shadow.blur / 2)}" flood-color="${esc(el.shadow.color)}" flood-opacity="${num(el.shadow.opacity)}"/></filter>`);
        filter = ` filter="url(#${id})"`;
      }
      const outline = el.stroke && (el.strokeWidth ?? 0) > 0 ? ` stroke="${esc(el.stroke)}" stroke-width="${num(el.strokeWidth!)}" paint-order="stroke" stroke-linejoin="round"` : '';
      return `<text${filter}${outline} font-family="${esc(el.fontFamily)}, sans-serif" font-size="${num(el.fontSize)}" font-weight="${el.fontWeight}" dominant-baseline="central"` +
        (el.italic ? ' font-style="italic"' : '') + (el.underline ? ' text-decoration="underline"' : '') +
        (el.letterSpacing ? ` letter-spacing="${num(el.letterSpacing)}"` : '') + ` fill="${esc(el.fill)}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`;
    }
    case 'image': {
      const id = `c${++uid}`;
      const clip = el.cornerRadius ? (defs.push(`<clipPath id="${id}"><rect width="${num(w)}" height="${num(h)}" rx="${num(el.cornerRadius)}"/></clipPath>`), ` clip-path="url(#${id})"`) : '';
      const flip = el.flipX || el.flipY ? ` transform="translate(${el.flipX ? num(w) : 0} ${el.flipY ? num(h) : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})"` : '';
      const filter = imageFilter(el.filters, defs);
      const c = el.crop, nw = el.naturalWidth, nh = el.naturalHeight;
      // Zuschnitt: das ganze Bild in Originalgröße in einem Ausschnitt-Fenster (viewBox) zeigen.
      // preserveAspectRatio="none": Der Editor streckt Bilder auf den Rahmen, statt zu beschneiden.
      const picture = c && nw && nh
        ? `<svg width="${num(w)}" height="${num(h)}" viewBox="${num(c.x)} ${num(c.y)} ${num(c.width)} ${num(c.height)}" preserveAspectRatio="none"><image href="${esc(el.src)}" width="${num(nw)}" height="${num(nh)}"/></svg>`
        : `<image href="${esc(el.src)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="none"/>`;
      return `<g${clip}><g${flip}${filter}>${picture}</g></g>`;
    }
    case 'group': return el.children.map((c) => render(c, ctx)).join('');
    case 'icon': {
      if (!isSafePathData(el.path) || !(el.viewBox > 0)) return ''; // nur geprüfte Pfaddaten werden ausgegeben
      return `<path d="${esc(el.path)}" transform="scale(${num(w / el.viewBox)} ${num(h / el.viewBox)})" fill="${esc(el.fill)}"/>`;
    }
  }
}

/**
 * Bildfilter als SVG-Filter, in derselben Reihenfolge wie im Editor (Helligkeit, Kontrast, Sättigung, Weichzeichnen).
 * Näherung der Konva-Filter: Helligkeit und Kontrast sind dieselben linearen Formeln, die Sättigung nutzt die SVG-Matrix.
 */
function imageFilter(f: ImageFilters, defs: string[]): string {
  const parts: string[] = [];
  const rgb = (attrs: string) => ['R', 'G', 'B'].map((c) => `<feFunc${c} type="linear" ${attrs}/>`).join('');
  if (f.brightness) parts.push(`<feComponentTransfer>${rgb(`slope="1" intercept="${num(f.brightness / 100)}"`)}</feComponentTransfer>`);
  if (f.contrast) {
    const k = ((f.contrast + 100) / 100) ** 2; // wie Konva.Filters.Contrast
    parts.push(`<feComponentTransfer>${rgb(`slope="${num(k)}" intercept="${num(0.5 * (1 - k))}"`)}</feComponentTransfer>`);
  }
  if (f.saturation) parts.push(`<feColorMatrix type="saturate" values="${num(Math.max(0, 1 + f.saturation / 100))}"/>`);
  if (f.blur) parts.push(`<feGaussianBlur stdDeviation="${num(f.blur / 2)}"/>`);
  if (!parts.length) return '';
  const id = `f${++uid}`;
  defs.push(`<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${parts.join('')}</filter>`);
  return ` filter="url(#${id})"`;
}

/** Eckpunkte eines Sterns im Einheitsquadrat (0..1), Spitze oben. Auch vom Canvas-Renderer genutzt. */
export function starUnitPoints(n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? 0.2 : 0.5; // Verhältnis innen/außen
    pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return pts;
}

const starPoints = (w: number, h: number, n: number) => starUnitPoints(n).map(([x, y]) => `${num(w * x)},${num(h * y)}`).join(' ');

/** Grober Umbruch: nimmt pro Zeichen 0,55 em Breite an. Reicht für Vorschaubilder. */
function wrap(text: string, maxWidth: number, fontSize: number, letterSpacing: number): string[] {
  const perChar = fontSize * 0.55 + letterSpacing;
  const maxChars = Math.max(1, Math.floor(maxWidth / perChar));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length > maxChars) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}
