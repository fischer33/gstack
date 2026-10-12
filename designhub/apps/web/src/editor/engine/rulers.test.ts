import { describe, expect, it } from 'vitest';
import { formatTick, guidePosition, minorDivisions, niceStep, rulerTicks } from './rulers';

describe('niceStep', () => {
  it('wählt 1/2/5 × 10^n so, dass der Abstand mindestens 70 Bildschirmpixel hat', () => {
    expect(niceStep(1)).toBe(100);
    expect(niceStep(0.5)).toBe(200);
    expect(niceStep(4)).toBe(20);
    expect(niceStep(0.1)).toBe(1000);
    expect(niceStep(2)).toBe(50);
  });
  it('Abstand auf dem Bildschirm liegt immer zwischen 70 und ~250 px', () => {
    for (const z of [0.1, 0.13, 0.25, 0.4, 0.54, 0.8, 1, 1.5, 2.2, 3, 4]) {
      const px = niceStep(z) * z;
      expect(px).toBeGreaterThanOrEqual(70);
      expect(px).toBeLessThan(250);
    }
  });
  it('ungültiger Zoom ergibt einen sinnvollen Standard', () => expect(niceStep(0)).toBe(100));
});

describe('minorDivisions', () => {
  it('1 und 5 → 5 Teile, 2 → 4 Teile', () => {
    expect(minorDivisions(100)).toBe(5);
    expect(minorDivisions(500)).toBe(5);
    expect(minorDivisions(200)).toBe(4);
    expect(minorDivisions(0.2)).toBe(4);
  });
});

describe('rulerTicks', () => {
  it('Hauptstriche liegen bei Vielfachen des Abstands, mit Bildschirmposition und Beschriftung', () => {
    const { step, ticks } = rulerTicks(1, 50, 300); // sichtbar: Dokument −50 … 250
    expect(step).toBe(100);
    const majors = ticks.filter((t) => t.major);
    expect(majors.map((t) => [t.pos, t.screen, t.label])).toEqual([[0, 50, '0'], [100, 150, '100'], [200, 250, '200']]);
  });
  it('Zwischenstriche in gleichen Abständen (100 → alle 20)', () => {
    const { ticks } = rulerTicks(1, 0, 250);
    expect(ticks.filter((t) => t.pos >= 0 && t.pos <= 100).map((t) => t.pos)).toEqual([0, 20, 40, 60, 80, 100]);
  });
  it('deckt den ganzen sichtbaren Bereich ab, auch bei negativem Pan', () => {
    const { ticks } = rulerTicks(2, -500, 800); // Dokument 250 … 650
    expect(Math.min(...ticks.map((t) => t.screen))).toBeLessThanOrEqual(0);
    expect(Math.max(...ticks.map((t) => t.screen))).toBeGreaterThanOrEqual(800);
    expect(ticks.filter((t) => t.major).map((t) => t.pos)).toContain(300);
  });
  it('kleine Zoomstufen: keine Fließkomma-Drift in den Positionen', () => {
    const { ticks } = rulerTicks(4, 0, 400);
    expect(ticks.every((t) => Number.isInteger(t.pos * 10))).toBe(true);
  });
  it('liefert nie unbegrenzt viele Striche', () => expect(rulerTicks(0.1, 0, 5000).ticks.length).toBeLessThan(2000));
});

it('formatTick: Dezimalkomma', () => {
  expect(formatTick(100)).toBe('100');
  expect(formatTick(0.5)).toBe('0,5');
});

describe('guidePosition', () => {
  it('rechnet Mausposition in Dokumentkoordinaten um und rundet auf halbe Pixel', () => {
    expect(guidePosition(400, 100, 50, 1)).toBe(250);
    expect(guidePosition(400, 100, 50, 0.5)).toBe(500);
    expect(guidePosition(401, 100, 50, 3)).toBe(83.5); // (401-100-50)/3 = 83,67 → 83,5
  });
  it('Positionen links/oberhalb des Dokuments sind negativ', () => expect(guidePosition(120, 100, 50, 1)).toBe(-30));
});
