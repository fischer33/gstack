import { describe, expect, it } from 'vitest';
import type { Element } from '@designhub/shared';
import { cloneElement, moveItem, reorder, reorderToIndex } from './pageOps';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join('');
const list = (s: string) => [...s].map((id) => ({ id }));

describe('reorder', () => {
  it('front/back: gewählte Elemente behalten ihre relative Reihenfolge', () => {
    expect(ids(reorder(list('abcde'), ['b', 'd'], 'front'))).toBe('acebd');
    expect(ids(reorder(list('abcde'), ['b', 'd'], 'back'))).toBe('bdace');
  });
  it('forward/backward: ein Schritt', () => {
    expect(ids(reorder(list('abcd'), ['b'], 'forward'))).toBe('acbd');
    expect(ids(reorder(list('abcd'), ['c'], 'backward'))).toBe('acbd');
  });
  it('forward/backward: Block bleibt zusammen und kommt an den Rand, ohne zu überspringen', () => {
    expect(ids(reorder(list('abcd'), ['b', 'c'], 'forward'))).toBe('adbc');
    expect(ids(reorder(list('abcd'), ['b', 'c'], 'backward'))).toBe('bcad');
  });
  it('am Rand passiert nichts', () => {
    expect(ids(reorder(list('abc'), ['c'], 'forward'))).toBe('abc');
    expect(ids(reorder(list('abc'), ['a'], 'backward'))).toBe('abc');
    expect(ids(reorder(list('abc'), ['c'], 'front'))).toBe('abc');
  });
  it('ignoriert unbekannte IDs und verändert das Original nicht', () => {
    const src = list('abc');
    expect(ids(reorder(src, ['x'], 'front'))).toBe('abc');
    reorder(src, ['a'], 'front');
    expect(ids(src)).toBe('abc');
  });
});

describe('cloneElement', () => {
  const base = { x: 10, y: 20, width: 5, height: 5, rotation: 0, opacity: 1, locked: false, visible: true };
  it('vergibt neue IDs (auch für Kinder), versetzt nur das Original-Element und teilt keinen Zustand', () => {
    let n = 0;
    const group: Element = { ...base, id: 'g', type: 'group', children: [{ ...base, id: 'c', type: 'shape', kind: 'rect', fill: '#000', stroke: '#000', strokeWidth: 0 }] };
    const copy = cloneElement(group, () => `n${++n}`, 5, 7);
    expect(copy).toMatchObject({ id: 'n1', x: 15, y: 27 });
    expect(copy.type === 'group' && copy.children[0]).toMatchObject({ id: 'n2', x: 10, y: 20 });
    if (copy.type === 'group') copy.children[0].x = 999;
    expect(group.type === 'group' && group.children[0].x).toBe(10);
  });
});

describe('moveItem / reorderToIndex', () => {
  const l = (s: string) => [...s].map((id) => ({ id }));
  const out = (xs: { id: string }[]) => xs.map((x) => x.id).join('');
  it('moveItem verschiebt und begrenzt Indizes', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveItem([1, 2, 3], 0, 99)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 1, -5)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
  });
  it('reorderToIndex: Index zählt ohne die Verschobenen', () => {
    expect(out(reorderToIndex(l('abcd'), ['a'], 2))).toBe('bcad');
    expect(out(reorderToIndex(l('abcd'), ['d'], 0))).toBe('dabc');
    expect(out(reorderToIndex(l('abcd'), ['b'], 99))).toBe('acdb');
  });
  it('Block bleibt zusammen und in relativer Reihenfolge', () => {
    expect(out(reorderToIndex(l('abcde'), ['d', 'b'], 1))).toBe('abdce'); // b, d als Block hinter a
  });
  it('unbekannte IDs: unverändert', () => expect(out(reorderToIndex(l('abc'), ['x'], 0))).toBe('abc'));
});
