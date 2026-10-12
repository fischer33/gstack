import { describe, expect, it } from 'vitest';
import { blankDocument, parseSize } from './document-utils';
import type { Page, ShapeElement, TextElement } from './document';
import { pageToSvg, svgToDataUrl } from './svg';

const base = { x: 10, y: 20, width: 100, height: 50, rotation: 0, opacity: 1, locked: false, visible: true };
const rect = (o: Partial<ShapeElement> = {}): ShapeElement => ({ ...base, id: 'r', type: 'shape', kind: 'rect', fill: '#f00', stroke: 'transparent', strokeWidth: 0, ...o });
const text = (o: Partial<TextElement> = {}): TextElement => ({ ...base, id: 't', type: 'text', text: 'Hallo', fontFamily: 'Inter', fontSize: 20, fontWeight: 400, italic: false, underline: false, align: 'left', fill: '#000', lineHeight: 1.2, letterSpacing: 0, ...o });
const page = (elements: Page['elements'], background: Page['background'] = { type: 'solid', color: '#fff' }): Page => ({ id: 'p', background, elements });
const svg = (p: Page) => pageToSvg({ width: 400, height: 300 }, p);

describe('pageToSvg', () => {
  it('rendert Hintergrund und Größe', () => {
    const out = pageToSvg({ width: 400, height: 300 }, blankDocument(400, 300).pages[0]);
    expect(out).toContain('viewBox="0 0 400 300"');
    expect(out).toContain('fill="#ffffff"');
  });

  it('wendet Position, Drehung um die Mitte und Deckkraft an', () => {
    const out = svg(page([rect({ rotation: 45, opacity: 0.5 })]));
    expect(out).toContain('transform="translate(10 20) rotate(45 50 25)"');
    expect(out).toContain('opacity="0.5"');
  });

  it('überspringt unsichtbare Elemente', () => {
    expect(svg(page([rect({ visible: false })]))).not.toContain('<rect width="100"');
  });

  it('maskiert Text, damit kein Markup eingeschleust werden kann', () => {
    const out = svg(page([text({ text: '<script>alert(1)</script> & "x"', fontFamily: 'a"b' })]));
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('&amp;');
    expect(out).not.toContain('font-family="a"b');
  });

  it('bricht Text an Zeilenumbrüchen und nach geschätzter Breite um', () => {
    const lines = (o: Partial<TextElement>) => (svg(page([text(o)])).match(/<tspan/g) ?? []).length;
    expect(lines({ text: 'a\nb\nc' })).toBe(3);
    expect(lines({ text: 'eins zwei drei vier fünf sechs', width: 100 })).toBeGreaterThan(1);
  });

  it('zeichnet Verlauf mit CSS-Winkel (90° = links nach rechts)', () => {
    const out = svg(page([], { type: 'gradient', angle: 90, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] }));
    expect(out).toContain('rotate(0 .5 .5)');
    expect(out).toMatch(/fill="url\(#g\d+\)"/);
  });

  it('Stern hat 2 × Zacken Eckpunkte', () => {
    const out = svg(page([rect({ kind: 'star', points: 6 })]));
    expect(out.match(/points="([^"]+)"/)![1].split(' ')).toHaveLength(12);
  });

  it('Gruppen rendern ihre Kinder', () => {
    const group = { ...base, id: 'g', type: 'group' as const, children: [rect()] };
    expect(svg(page([group]))).toContain('<rect width="100"');
  });

  it('Icons: sichere Pfaddaten werden skaliert ausgegeben, unsichere verworfen', () => {
    const icon = { ...base, id: 'i', type: 'icon' as const, path: 'M0 0L24 0L12 24Z', viewBox: 24, fill: '#f00' };
    expect(svg(page([icon]))).toContain('<path d="M0 0L24 0L12 24Z" transform="scale(4.17 2.08)" fill="#f00"/>');
    for (const bad of ['M0 0"/><script>alert(1)</script>', 'url(javascript:x)', '']) {
      expect(svg(page([{ ...icon, path: bad }]))).not.toContain('<path');
    }
  });

  it('Text mit Kontur und Schatten', () => {
    const out = svg(page([text({ stroke: '#f00', strokeWidth: 3, shadow: { color: '#000', blur: 8, offsetX: 2, offsetY: 4, opacity: 0.5 } })]));
    expect(out).toContain('stroke="#f00" stroke-width="3" paint-order="stroke"');
    expect(out).toContain('<feDropShadow dx="2" dy="4" stdDeviation="4"');
    expect(out).toMatch(/filter="url\(#s\d+\)"/);
  });

  it('Bild mit Zuschnitt zeigt nur den Ausschnitt', () => {
    const img = { ...base, id: 'im', type: 'image' as const, src: 'data:image/png;base64,AAAA', flipX: false, flipY: false, filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0 }, naturalWidth: 800, naturalHeight: 600, crop: { x: 100, y: 50, width: 400, height: 300 } };
    expect(svg(page([img]))).toContain('viewBox="100 50 400 300"');
    expect(svg(page([{ ...img, crop: undefined }]))).not.toContain('viewBox="100');
  });

  it('svgToDataUrl ist Base64 und verträgt Umlaute', () => {
    const url = svgToDataUrl('<svg>Grüße €</svg>');
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(Buffer.from(url.split(',')[1], 'base64').toString('utf8')).toBe('<svg>Grüße €</svg>');
  });
});

describe('parseSize', () => {
  it('akzeptiert gängige Schreibweisen', () => {
    expect(parseSize('1080x1920')).toEqual({ width: 1080, height: 1920 });
    expect(parseSize(' 800 × 600 ')).toEqual({ width: 800, height: 600 });
  });
  it('lehnt Unsinn und Grenzwerte ab', () => {
    for (const bad of ['abc', '10x10', '9000x100', '100', '-5x100', '']) expect(parseSize(bad)).toBeNull();
  });
});
