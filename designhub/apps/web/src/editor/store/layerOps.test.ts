import { describe, expect, it } from 'vitest';
import { layerDropIndex } from './layerOps';
import { reorderToIndex } from './pageOps';

const doc = (s: string) => [...s].map((id) => ({ id })); // Dokumentreihenfolge: hinten → vorne
const apply = (docOrder: string, moved: string[], slot: number) => {
  const items = doc(docOrder);
  const display = [...items].reverse(); // Panel: vorne zuerst
  return reorderToIndex(items, moved, layerDropIndex(display, moved, slot)).map((e) => e.id).join('');
};

describe('layerDropIndex', () => {
  it('ganz nach oben (vorne)', () => expect(apply('abcd', ['a'], 0)).toBe('bcda'));
  it('ganz nach unten (hinten)', () => expect(apply('abcd', ['d'], 4)).toBe('dabc'));
  it('zwischen zwei Zeilen', () => {
    // Panel: d c b a. Marke 2 liegt zwischen c und b → d soll hinter c, vor b stehen
    expect(apply('abcd', ['d'], 2)).toBe('abdc');
  });
  it('auf der eigenen Stelle bleibt alles gleich', () => {
    expect(apply('abcd', ['c'], 1)).toBe('abcd'); // direkt über der eigenen Zeile
    expect(apply('abcd', ['c'], 2)).toBe('abcd'); // direkt darunter
  });
  it('Block aus mehreren Elementen bleibt zusammen', () => {
    expect(apply('abcde', ['b', 'd'], 0)).toBe('acebd'); // beide nach vorne, Reihenfolge b, d bleibt
    expect(apply('abcde', ['b', 'd'], 5)).toBe('bdace'); // beide nach hinten
  });
  it('Marke wird begrenzt', () => {
    expect(apply('abc', ['a'], -5)).toBe('bca');
    expect(apply('abc', ['c'], 99)).toBe('cab');
  });
});
