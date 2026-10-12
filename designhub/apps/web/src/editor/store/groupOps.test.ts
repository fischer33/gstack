import { describe, expect, it } from 'vitest';
import type { Element, GroupElement } from '@designhub/shared';
import { groupElements, ungroupElement } from './groupOps';

const el = (id: string, o: Partial<Element> = {}): Element => ({
  id, type: 'shape', kind: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, locked: false, visible: true,
  fill: '#f00', stroke: '#000', strokeWidth: 0, ...o,
}) as Element;
const ids = (xs: Element[]) => xs.map((e) => e.id).join('');

describe('groupElements', () => {
  it('Gruppe umschließt die Mitglieder, Kinder bekommen relative Koordinaten', () => {
    const { elements, groupId } = groupElements([el('a', { x: 100, y: 200 }), el('b', { x: 300, y: 250, width: 40, height: 80 })], ['a', 'b']);
    const g = elements.find((e) => e.id === groupId) as GroupElement;
    expect(g).toMatchObject({ type: 'group', x: 100, y: 200, width: 240, height: 130, rotation: 0 });
    expect(g.children.map((c) => [c.id, c.x, c.y])).toEqual([['a', 0, 0], ['b', 200, 50]]);
  });

  it('Gruppe sitzt an der Stelle des obersten Mitglieds, andere Elemente behalten ihre Reihenfolge', () => {
    const { elements, groupId } = groupElements([el('a'), el('x'), el('b'), el('y')], ['a', 'b']);
    expect(elements.map((e) => (e.id === groupId ? 'G' : e.id)).join('')).toBe('xGy');
  });

  it('gedrehte Mitglieder zählen mit ihrem Umschlag', () => {
    const { elements, groupId } = groupElements([el('a', { x: 0, y: 0, width: 100, height: 20, rotation: 90 }), el('b', { x: 500, y: 0 })], ['a', 'b']);
    const g = elements.find((e) => e.id === groupId) as GroupElement;
    expect(g.y).toBeCloseTo(-40); // um 90° gedreht ragt das schmale Rechteck 40 nach oben
    expect(g.x).toBeCloseTo(40);
  });

  it('weniger als zwei Elemente: nichts passiert', () => {
    const src = [el('a'), el('b')];
    expect(groupElements(src, ['a']).groupId).toBeNull();
    expect(groupElements(src, ['x', 'y']).groupId).toBeNull();
    expect(ids(groupElements(src, ['a']).elements)).toBe('ab');
  });

  it('verändert die Eingabe nicht', () => {
    const src = [el('a', { x: 10 }), el('b', { x: 50 })];
    const copy = JSON.stringify(src);
    groupElements(src, ['a', 'b']);
    expect(JSON.stringify(src)).toBe(copy);
  });
});

describe('ungroupElement', () => {
  it('Rundreise: gruppieren und auflösen ergibt die Ausgangsposition', () => {
    const src = [el('a', { x: 100, y: 200, rotation: 15 }), el('b', { x: 300, y: 250, width: 40, height: 80 })];
    const { elements, groupId } = groupElements(src, ['a', 'b']);
    const back = ungroupElement(elements, groupId!);
    expect(ids(back.elements)).toBe('ab');
    for (const [i, e] of back.elements.entries()) {
      expect(e.x).toBeCloseTo(src[i].x, 6); expect(e.y).toBeCloseTo(src[i].y, 6); expect(e.rotation).toBeCloseTo(src[i].rotation, 6);
    }
  });

  it('Auflösen bleibt an der Stelle der Gruppe in der Reihenfolge', () => {
    const { elements, groupId } = groupElements([el('a'), el('b'), el('c')], ['a', 'b']);
    expect(ids(ungroupElement(elements, groupId!).elements)).toBe('abc');
  });

  it('gedrehte Gruppe: Kinder drehen mit und wandern um die Gruppenmitte', () => {
    const g: GroupElement = { id: 'g', type: 'group', x: 0, y: 0, width: 200, height: 100, rotation: 90, opacity: 0.5, locked: false, visible: true,
      children: [{ ...el('k'), x: 0, y: 0, width: 100, height: 100 }] }; // linke Hälfte
    const { elements } = ungroupElement([g], 'g');
    const k = elements[0];
    // Gruppenmitte (100,50); Kindmitte relativ (-50,0) → um 90° gedreht (0,-50) → (100,0); Kind 100×100 → x=50,y=-50
    expect(k.x).toBeCloseTo(50); expect(k.y).toBeCloseTo(-50);
    expect(k.rotation).toBe(90);
    expect(k.opacity).toBeCloseTo(0.5);
  });

  it('keine Gruppe oder unbekannte ID: unverändert', () => {
    const src = [el('a')];
    expect(ungroupElement(src, 'a').childIds).toEqual([]);
    expect(ungroupElement(src, 'zzz').elements).toEqual(src);
  });
});
