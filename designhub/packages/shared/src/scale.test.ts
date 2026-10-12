import { describe, expect, it } from 'vitest';
import type { Element, GroupElement, Page, TextElement } from './document';
import { fitPageToSize, scaleElement } from './scale';

const base = { x: 100, y: 50, width: 200, height: 100, rotation: 10, opacity: 1, locked: false, visible: true };
const text: TextElement = { ...base, id: 't', type: 'text', text: 'Hi', fontFamily: 'Inter', fontSize: 40, fontWeight: 400, italic: false, underline: false, align: 'left', fill: '#000', lineHeight: 1.2, letterSpacing: 2, strokeWidth: 4, shadow: { color: '#000', blur: 10, offsetX: 4, offsetY: 6, opacity: 0.5 } };

describe('scaleElement', () => {
  it('gleichmäßig: alle Maße folgen dem Faktor, Drehung bleibt', () => {
    const s = scaleElement(text, 2, 2);
    expect(s).toMatchObject({ x: 200, y: 100, width: 400, height: 200, fontSize: 80, letterSpacing: 4, strokeWidth: 8, rotation: 10 });
    expect(s.shadow).toEqual({ color: '#000', blur: 20, offsetX: 8, offsetY: 12, opacity: 0.5 });
  });
  it('ungleichmäßig: Maße einzeln, Schrift nach geometrischem Mittel', () => {
    const s = scaleElement(text, 2, 0.5);
    expect(s).toMatchObject({ x: 200, y: 25, width: 400, height: 50 });
    expect(s.fontSize).toBeCloseTo(40);
  });
  it('verändert das Original nicht', () => {
    const copy = JSON.stringify(text);
    scaleElement(text, 3, 3);
    expect(JSON.stringify(text)).toBe(copy);
  });
  it('Gruppen skalieren ihre Kinder mit', () => {
    const g: GroupElement = { ...base, id: 'g', type: 'group', children: [{ ...text, x: 10, y: 20 }] };
    const s = scaleElement(g, 2, 2);
    expect(s.children[0]).toMatchObject({ x: 20, y: 40, fontSize: 80 });
  });
});

describe('fitPageToSize', () => {
  const page: Page = { id: 'p', background: { type: 'solid', color: '#fff' }, elements: [{ ...text, x: 0, y: 0, width: 1000, height: 100 } as Element] };

  it('gleiches Format: unverändert', () => {
    expect(fitPageToSize(page, { width: 1000, height: 1000 }, { width: 1000, height: 1000 }).elements[0]).toMatchObject({ x: 0, y: 0, width: 1000, fontSize: 40 });
  });
  it('breiteres Ziel: gleichmäßig skaliert und mittig', () => {
    const out = fitPageToSize(page, { width: 1000, height: 1000 }, { width: 2000, height: 500 }); // k = 0.5, Seitenrand je 750
    expect(out.elements[0]).toMatchObject({ x: 750, y: 0, width: 500, fontSize: 20 });
  });
  it('größeres Ziel: hochskaliert', () => {
    const out = fitPageToSize(page, { width: 1000, height: 1000 }, { width: 2000, height: 2000 });
    expect(out.elements[0]).toMatchObject({ width: 2000, fontSize: 80 });
  });
});
