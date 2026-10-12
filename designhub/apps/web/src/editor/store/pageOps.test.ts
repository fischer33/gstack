import { describe, expect, it } from 'vitest';
import type { Element } from '@designhub/shared';
import { cloneElement, reorder } from './pageOps';

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
