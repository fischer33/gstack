import { describe, expect, it } from 'vitest';
import { PALETTES, hexToRgb, normalizeHex, readableOn, rgbToHex, toHexOrDefault } from './colors';

describe('colors', () => {
  it('normalizeHex akzeptiert übliche Schreibweisen', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('7d2ae8')).toBe('#7d2ae8');
    expect(normalizeHex('  #FFFFFF ')).toBe('#ffffff');
    for (const bad of ['', '#12', '#12345', 'gggggg', '#1234567', 'rgb(1,2,3)']) expect(normalizeHex(bad)).toBeNull();
  });
  it('hex ↔ rgb Rundreise', () => {
    expect(hexToRgb('#7d2ae8')).toEqual({ r: 125, g: 42, b: 232 });
    expect(rgbToHex({ r: 125, g: 42, b: 232 })).toBe('#7d2ae8');
    expect(hexToRgb('nope')).toBeNull();
  });
  it('rgbToHex begrenzt und rundet', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe('#ff0080');
  });
  it('toHexOrDefault versteht rgb() und fällt bei transparent zurück', () => {
    expect(toHexOrDefault('rgb(255, 0, 128)')).toBe('#ff0080');
    expect(toHexOrDefault('rgba(0,0,0,0.5)')).toBe('#000000');
    expect(toHexOrDefault('transparent', '#123456')).toBe('#123456');
  });
  it('readableOn wählt Schwarz auf Hell und Weiß auf Dunkel', () => {
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#14161f')).toBe('#ffffff');
    expect(readableOn('#7d2ae8')).toBe('#ffffff');
  });
  it('Paletten enthalten nur gültige, eindeutige Farben', () => {
    for (const p of PALETTES) {
      expect(p.colors.every((c) => normalizeHex(c) === c)).toBe(true);
      expect(new Set(p.colors).size).toBe(p.colors.length);
    }
  });
});
