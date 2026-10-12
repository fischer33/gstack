import type { Background, Element, Page } from './document';

/**
 * Rendert eine Seite als SVG-String. Rein funktional, ohne DOM, damit es auf Server (Vorschaubilder)
 * und Client (später: SVG-Export) identisch läuft.
 *
 * Bewusst noch nicht enthalten: Bildzuschnitt/-filter, Icons, Text-Schatten und -Kontur. Das kommt mit dem
 * Export in Etappe (e). Zeilenumbrüche im Text sind eine Schätzung (feste Zeichenbreite), kein exaktes Layout.
 */
export function pageToSvg(size: { width: number; height: number }, page: Page): string {
  const { width, height } = size;
  const defs: string[] = [];
  const body = [background(page.background, width, height, defs), ...page.elements.map((e) => render(e, defs))].join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width)}" height="${num(height)}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') + body + '</svg>'
  );
}

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
  if (bg.type === 'solid') return `<rect width="${num(w)}" height="${num(h)}" fill="${esc(bg.color)}"/>`;
  if (bg.type === 'image') {
    return `<image href="${esc(bg.src)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid ${bg.fit === 'cover' ? 'slice' : 'meet'}"/>`;
  }
  const id = `g${++uid}`;
  // CSS-Winkel: 0° = von unten nach oben, 90° = von links nach rechts.
  const stops = bg.stops.map((s) => `<stop offset="${s.offset}" stop-color="${esc(s.color)}"/>`).join('');
  defs.push(`<linearGradient id="${id}" gradientTransform="rotate(${num(bg.angle - 90)} .5 .5)">${stops}</linearGradient>`);
  return `<rect width="${num(w)}" height="${num(h)}" fill="url(#${id})"/>`;
}

function render(el: Element, defs: string[]): string {
  if (!el.visible) return '';
  const transform = `translate(${num(el.x)} ${num(el.y)})` + (el.rotation ? ` rotate(${num(el.rotation)} ${num(el.width / 2)} ${num(el.height / 2)})` : '');
  const opacity = el.opacity < 1 ? ` opacity="${num(el.opacity)}"` : '';
  return `<g transform="${transform}"${opacity}>${inner(el, defs)}</g>`;
}

function inner(el: Element, defs: string[]): string {
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
      const head = sw * 4;
      return line + `<polygon points="${num(w)},${num(h / 2)} ${num(w - head)},${num(h / 2 - head / 2)} ${num(w - head)},${num(h / 2 + head / 2)}" fill="${color}"/>`;
    }
    case 'text': {
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const x = el.align === 'center' ? w / 2 : el.align === 'right' ? w : 0;
      const lines = wrap(el.text, w, el.fontSize, el.letterSpacing);
      const spans = lines.map((l, i) => `<tspan x="${num(x)}" y="${num(el.fontSize * 0.9 + i * el.fontSize * el.lineHeight)}">${esc(l)}</tspan>`).join('');
      return `<text font-family="${esc(el.fontFamily)}, sans-serif" font-size="${num(el.fontSize)}" font-weight="${el.fontWeight}"` +
        (el.italic ? ' font-style="italic"' : '') + (el.underline ? ' text-decoration="underline"' : '') +
        (el.letterSpacing ? ` letter-spacing="${num(el.letterSpacing)}"` : '') + ` fill="${esc(el.fill)}" text-anchor="${anchor}" xml:space="preserve">${spans}</text>`;
    }
    case 'image': {
      const id = `c${++uid}`;
      const clip = el.cornerRadius ? (defs.push(`<clipPath id="${id}"><rect width="${num(w)}" height="${num(h)}" rx="${num(el.cornerRadius)}"/></clipPath>`), ` clip-path="url(#${id})"`) : '';
      const flip = el.flipX || el.flipY ? ` transform="translate(${el.flipX ? num(w) : 0} ${el.flipY ? num(h) : 0}) scale(${el.flipX ? -1 : 1} ${el.flipY ? -1 : 1})"` : '';
      return `<g${clip}><image href="${esc(el.src)}" width="${num(w)}" height="${num(h)}" preserveAspectRatio="xMidYMid slice"${flip}/></g>`;
    }
    case 'group': return el.children.map((c) => render(c, defs)).join('');
    case 'icon': return ''; // Icons enthalten fremdes SVG; erst mit Sanitizing (Etappe d/e) rendern.
  }
}

function starPoints(w: number, h: number, n: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? 0.2 : 0.5; // Verhältnis innen/außen wie im Editor-Standardstern
    pts.push(`${num(w * (0.5 + r * Math.cos(a)))},${num(h * (0.5 + r * Math.sin(a)))}`);
  }
  return pts.join(' ');
}

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
