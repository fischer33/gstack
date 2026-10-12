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
    expect(out).toContain('x1="0" y1="150" x2="400" y2="150"'); // 400×300: von links nach rechts durch die Mitte
    expect(out).toMatch(/fill="url\(#g\d+\)"/);
    const down = svg(page([], { type: 'gradient', angle: 180, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] }));
    expect(down).toContain('x1="200" y1="0" x2="200" y2="300"'); // 180° = von oben nach unten
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

describe('pageToSvg: Deckung mit dem Editor', () => {
  const img = (o = {}) => ({ ...base, id: 'im', type: 'image' as const, src: 'data:image/png;base64,AAAA', flipX: false, flipY: false, filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0 }, ...o });

  it('exakte Zeilenumbrüche aus der Messung haben Vorrang vor der Schätzung', () => {
    const t = text({ id: 'tt', text: 'ein sehr langer Text der geschätzt umbrechen würde', width: 1000 });
    const estimated = pageToSvg({ width: 400, height: 300 }, page([t]));
    expect((estimated.match(/<tspan/g) ?? []).length).toBe(1);
    const measured = pageToSvg({ width: 400, height: 300 }, page([t]), { textLines: { tt: ['ein sehr langer', 'Text der', 'geschätzt'] } });
    expect((measured.match(/<tspan/g) ?? []).length).toBe(3);
    expect(measured).toContain('>Text der</tspan>');
  });

  it('Zeilen sitzen mittig in ihrer Zeilenbox (wie textBaseline "middle" im Editor)', () => {
    const out = pageToSvg({ width: 400, height: 300 }, page([text({ id: 't', fontSize: 20, lineHeight: 1.5, text: 'a\nb' })]));
    expect(out).toContain('dominant-baseline="central"');
    expect(out).toContain('y="15"'); // (0 + 0,5) × 30
    expect(out).toContain('y="45"'); // (1 + 0,5) × 30
  });

  it('Pfeilspitze: 3 × Strichstärke wie Konva.Arrow', () => {
    const out = svg(page([rect({ kind: 'arrow', width: 100, height: 20, stroke: '#000', strokeWidth: 4 })]));
    expect(out).toContain('points="100,10 88,4 88,16"');
  });

  it('Bilder werden gestreckt statt beschnitten (preserveAspectRatio none)', () => {
    expect(svg(page([img()]))).toContain('preserveAspectRatio="none"');
  });

  it('Hintergrundbild: weiße Fläche darunter für "Einpassen"', () => {
    const out = svg(page([], { type: 'image', src: 'data:image/png;base64,AAAA', fit: 'contain' }));
    expect(out.indexOf('fill="#ffffff"')).toBeLessThan(out.indexOf('<image'));
    expect(out).toContain('xMidYMid meet');
  });

  it('Bildfilter werden als SVG-Filter in Editor-Reihenfolge ausgegeben', () => {
    const out = svg(page([img({ filters: { brightness: 50, contrast: 40, saturation: -100, blur: 6 } })]));
    expect(out).toContain('<feFuncR type="linear" slope="1" intercept="0.5"/>'); // Helligkeit +50 → +0,5
    expect(out).toContain('slope="1.96" intercept="-0.48"'); // Kontrast 40: ((40+100)/100)² = 1,96
    expect(out).toContain('<feColorMatrix type="saturate" values="0"/>');
    expect(out).toContain('<feGaussianBlur stdDeviation="3"/>');
    expect(out.indexOf('intercept="0.5"')).toBeLessThan(out.indexOf('saturate'));
    expect(out.indexOf('saturate')).toBeLessThan(out.indexOf('feGaussianBlur'));
    expect(out).toMatch(/<g filter="url\(#f\d+\)">/);
  });

  it('ohne aktive Filter kein Filter-Element', () => {
    expect(svg(page([img()]))).not.toContain('<filter');
  });

  it('Sättigung +100 verdoppelt, nie negativ', () => {
    expect(svg(page([img({ filters: { brightness: 0, contrast: 0, saturation: 100, blur: 0 } })]))).toContain('values="2"');
  });

  it('styles landen in <style>, ein eingeschleustes </style> wird entschärft', () => {
    const out = pageToSvg({ width: 10, height: 10 }, page([]), { styles: "@import url('x');</style><script>alert(1)</script>" });
    expect(out).toContain('<style>@import url(\'x\');');
    expect(out.match(/<\/style>/g)).toHaveLength(1);
    expect(out.indexOf('</style>')).toBeGreaterThan(out.indexOf('<script>')); // Skript bleibt im Style-Block (kein Ausbruch)
  });
});
