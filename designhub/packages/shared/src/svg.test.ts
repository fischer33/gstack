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

  it('Gruppen rendern ihre Kinder, Icons werden (noch) nicht gerendert', () => {
    const group = { ...base, id: 'g', type: 'group' as const, children: [rect()] };
    expect(svg(page([group]))).toContain('<rect width="100"');
    const icon = { ...base, id: 'i', type: 'icon' as const, svg: '<script/>', fill: '#000' };
    expect(svg(page([icon]))).not.toContain('script');
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
