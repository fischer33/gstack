import { describe, expect, it } from 'vitest';
import { filterParams, hasFilters } from './imageFilters';

const f = (o: Partial<Record<'brightness' | 'contrast' | 'saturation' | 'blur', number>>) => ({ brightness: 0, contrast: 0, saturation: 0, blur: 0, ...o });

describe('filterParams', () => {
  it('neutral bleibt neutral', () => {
    expect(filterParams(f({}))).toEqual({ brightness: 0, contrast: 0, saturation: 0, blurRadius: 0 });
    expect(hasFilters(f({}))).toBe(false);
  });
  it('Helligkeit wird auf −1…1 abgebildet, Kontrast und Weichzeichnen unverändert', () => {
    expect(filterParams(f({ brightness: 50 })).brightness).toBe(0.5);
    expect(filterParams(f({ contrast: -40 })).contrast).toBe(-40);
    expect(filterParams(f({ blur: 7 })).blurRadius).toBe(7);
  });
  it('Sättigung: Faktor 0 (grau) … 1 … 2, denn Konva rechnet 2^s', () => {
    const factor = (v: number) => 2 ** filterParams(f({ saturation: v })).saturation;
    expect(factor(0)).toBeCloseTo(1);
    expect(factor(100)).toBeCloseTo(2);
    expect(factor(-50)).toBeCloseTo(0.5);
    expect(factor(-100)).toBeLessThan(0.002); // praktisch ganz grau, ohne log2(0)
    expect(Number.isFinite(filterParams(f({ saturation: -100 })).saturation)).toBe(true);
  });
  it('hasFilters erkennt jeden einzelnen Regler', () => {
    for (const k of ['brightness', 'contrast', 'saturation', 'blur'] as const) expect(hasFilters(f({ [k]: 1 }))).toBe(true);
  });
});
