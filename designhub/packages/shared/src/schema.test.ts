import { describe, expect, it } from 'vitest';
import { LIMITS, parseDesignDocument } from './schema';
import { blankDocument } from './document-utils';
import type { DesignDocument, Element, GroupElement } from './document';

const base = { x: 10, y: 20, width: 100, height: 50, rotation: 0, opacity: 1, locked: false, visible: true };
const shape = (id = 's'): Element => ({ ...base, id, type: 'shape', kind: 'rect', fill: '#7d2ae8', stroke: 'transparent', strokeWidth: 0 });
const text = (id = 't'): Element => ({ ...base, id, type: 'text', text: 'Hallo', fontFamily: 'Playfair Display', fontSize: 40, fontWeight: 700, italic: false, underline: false, align: 'left', fill: 'rgb(10, 20, 30)', lineHeight: 1.2, letterSpacing: 0 });
const image = (src = 'data:image/png;base64,iVBORw0KGgo='): Element => ({ ...base, id: 'i', type: 'image', src, flipX: false, flipY: false, filters: { brightness: 0, contrast: 0, saturation: 0, blur: 0 } });
const doc = (elements: Element[]): DesignDocument => ({ ...blankDocument(1080, 1080), pages: [{ id: 'p', background: { type: 'solid', color: '#ffffff' }, elements }] });
const bad = (d: unknown) => { const r = parseDesignDocument(d); expect(r.ok).toBe(false); return r.ok ? [] : r.issues; };

describe('parseDesignDocument: gültige Dokumente', () => {
  it('leeres Dokument', () => expect(parseDesignDocument(blankDocument(1080, 1080)).ok).toBe(true));

  it('alle Elementtypen, Hintergründe und Effekte', () => {
    const icon: Element = { ...base, id: 'ic', type: 'icon', path: 'M0 0L24 0L12 24Z', viewBox: 24, fill: '#f00' };
    const grad = { type: 'gradient' as const, angle: 135, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: 'hsl(200, 50%, 50%)' }] };
    const d = doc([shape(), { ...text(), shadow: { color: '#000', blur: 8, offsetX: 2, offsetY: 2, opacity: 0.5 }, stroke: '#fff', strokeWidth: 2 } as Element, image(), icon]);
    d.pages[0].background = grad;
    d.pages.push({ id: 'p2', background: { type: 'image', src: 'https://example.com/a.png', fit: 'cover' }, elements: [] });
    expect(parseDesignDocument(d).ok).toBe(true);
  });

  it('Gruppen (verschachtelt)', () => {
    const group = (children: Element[]): GroupElement => ({ ...base, id: `g${children.length}`, type: 'group', children });
    expect(parseDesignDocument(doc([group([shape('a'), group([text('b')])])])).ok).toBe(true);
  });

  it('entfernt unbekannte Felder', () => {
    const r = parseDesignDocument(doc([{ ...shape(), evil: '<script>' } as unknown as Element]));
    expect(r.ok && JSON.stringify(r.doc)).not.toContain('evil');
  });
});

describe('parseDesignDocument: Ablehnung', () => {
  it('kaputte Zahlen und Bereiche', () => {
    for (const patch of [{ opacity: 2 }, { opacity: NaN }, { x: Infinity }, { width: -1 }, { rotation: 1000 }]) {
      bad(doc([{ ...shape(), ...patch } as Element]));
    }
    bad({ ...blankDocument(1080, 1080), width: 10 });
    bad({ ...blankDocument(1080, 1080), width: 9000 });
    bad({ ...blankDocument(1080, 1080), width: 100.5 });
  });

  it('falsche Version, fehlende Seiten, unbekannter Elementtyp', () => {
    bad({ ...blankDocument(100, 100), version: 99 });
    bad({ ...blankDocument(100, 100), pages: [] });
    bad(doc([{ ...shape(), type: 'video' } as unknown as Element]));
    bad(null); bad('x'); bad({});
  });

  it('Einschleusung über Farben wird abgelehnt', () => {
    for (const c of ['url(javascript:alert(1))', '#fff"/><script>', 'red; background: url(x)', "expression(alert(1))", '']) {
      bad(doc([{ ...shape(), fill: c } as Element]));
    }
    const d = doc([]); d.pages[0].background = { type: 'solid', color: '"><script>' };
    bad(d);
  });

  it('Einschleusung über Schriftnamen wird abgelehnt (SVG-/CSS-Ausbruch)', () => {
    for (const f of ['a"b', "a'b", 'a;b', 'a{b}', '<x>', 'a\\b']) bad(doc([{ ...text(), fontFamily: f } as Element]));
  });

  it('Bildquellen: nur data:image (png/jpeg/webp/gif) und https', () => {
    for (const s of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,AAAA', 'http://example.com/a.png', 'file:///etc/passwd', 'data:image/png;base64,%%%']) bad(doc([image(s)]));
    expect(parseDesignDocument(doc([image('data:image/jpeg;base64,/9j/4AAQ')])).ok).toBe(true);
    expect(parseDesignDocument(doc([image('https://cdn.example.com/x.webp')])).ok).toBe(true);
  });

  it('Icon-Pfade werden streng geprüft', () => {
    bad(doc([{ ...base, id: 'ic', type: 'icon', path: 'M0 0"/><script>', viewBox: 24, fill: '#000' } as Element]));
  });

  it('Obergrenzen: Elemente, Seiten, Textlänge', () => {
    bad(doc(Array.from({ length: LIMITS.elementsPerPage + 1 }, (_, i) => shape(`s${i}`))));
    const many = blankDocument(100, 100); many.pages = Array.from({ length: LIMITS.pages + 1 }, (_, i) => ({ id: `p${i}`, background: { type: 'solid', color: '#fff' }, elements: [] }));
    bad(many);
    bad(doc([{ ...text(), text: 'x'.repeat(LIMITS.textLength + 1) } as Element]));
  });

  it('Verschachtelungstiefe von Gruppen ist begrenzt', () => {
    let el: Element = shape('leaf');
    for (let i = 0; i < LIMITS.groupDepth + 2; i++) el = { ...base, id: `g${i}`, type: 'group', children: [el] };
    bad(doc([el]));
  });

  it('Meldungen nennen Pfad und Grund', () => {
    const issues = bad(doc([{ ...shape(), opacity: 3 } as Element]));
    expect(issues[0].path).toContain('opacity');
  });
});
