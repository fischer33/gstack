import { describe, expect, it } from 'vitest';
import type { Element } from '@designhub/shared';
import { alignOffsets, distributeOffsets } from './alignOps';

const el = (id: string, x: number, y: number, w = 100, h = 50, rotation = 0): Element =>
  ({ id, type: 'shape', kind: 'rect', x, y, width: w, height: h, rotation, opacity: 1, locked: false, visible: true, fill: '#000', stroke: '#000', strokeWidth: 0 }) as Element;
const page = { width: 1000, height: 800 };

describe('alignOffsets', () => {
  const a = el('a', 100, 100), b = el('b', 400, 300, 200, 80);
  it('mehrere: am Umschlag der Auswahl', () => {
    expect(alignOffsets([a, b], 'left', page)).toEqual({ a: { dx: 0, dy: 0 }, b: { dx: -300, dy: 0 } });
    expect(alignOffsets([a, b], 'right', page)).toEqual({ a: { dx: 400, dy: 0 }, b: { dx: 0, dy: 0 } }); // Umschlag endet bei 600
    expect(alignOffsets([a, b], 'top', page)).toEqual({ a: { dx: 0, dy: 0 }, b: { dx: 0, dy: -200 } });
    expect(alignOffsets([a, b], 'bottom', page)).toEqual({ a: { dx: 0, dy: 230 }, b: { dx: 0, dy: 0 } });
  });
  it('mehrere: Mitten', () => {
    const o = alignOffsets([a, b], 'centerX', page); // Umschlag 100..600, Mitte 350
    expect(o.a.dx).toBe(200); expect(o.b.dx).toBe(-150);
    const v = alignOffsets([a, b], 'centerY', page); // Umschlag 100..380, Mitte 240
    expect(v.a.dy).toBe(115); expect(v.b.dy).toBe(-100);
  });
  it('einzelnes Element: an der Seite', () => {
    expect(alignOffsets([a], 'left', page).a.dx).toBe(-100);
    expect(alignOffsets([a], 'right', page).a.dx).toBe(800);
    expect(alignOffsets([a], 'centerX', page).a.dx).toBe(350); // Mitte 150 → 500
    expect(alignOffsets([a], 'centerY', page).a.dy).toBe(275);
    expect(alignOffsets([a], 'bottom', page).a.dy).toBe(650);
  });
  it('gedrehte Elemente zählen mit ihrem Umschlag', () => {
    const r = el('r', 0, 0, 100, 20, 90); // Umschlag x 40..60, y -40..60
    expect(alignOffsets([r], 'left', page).r.dx).toBeCloseTo(-40);
    expect(alignOffsets([r], 'top', page).r.dy).toBeCloseTo(40);
  });
  it('leere Auswahl', () => expect(alignOffsets([], 'left', page)).toEqual({}));
});

describe('distributeOffsets', () => {
  it('gleiche Lücken, Außenelemente bleiben stehen', () => {
    const els = [el('a', 0, 0, 100), el('b', 120, 0, 100), el('c', 600, 0, 100)]; // Spanne 0..700, Breiten 300 → Lücke 200
    const o = distributeOffsets(els, 'x');
    expect(o.a.dx).toBe(0); expect(o.c.dx).toBe(0);
    expect(120 + o.b.dx).toBe(300); // a endet bei 100, +200 Lücke
  });
  it('unsortierte Eingabe wird nach Position behandelt', () => {
    const o = distributeOffsets([el('c', 600, 0, 100), el('a', 0, 0, 100), el('b', 120, 0, 100)], 'x');
    expect(120 + o.b.dx).toBe(300);
  });
  it('vertikal', () => {
    const o = distributeOffsets([el('a', 0, 0, 50, 100), el('b', 0, 10, 50, 100), el('c', 0, 500, 50, 100)], 'y');
    expect(10 + o.b.dy).toBe(250); // Spanne 0..600, Höhen 300 → Lücke 150, b startet bei 100+150
  });
  it('unter drei Elementen: nichts', () => expect(distributeOffsets([el('a', 0, 0), el('b', 50, 0)], 'x')).toEqual({}));
});
