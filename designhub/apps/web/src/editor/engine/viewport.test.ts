import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, centerPan, clampZoom, fitZoom, zoomAround } from './viewport';

describe('viewport', () => {
  it('fitZoom passt die Seite mit Rand ein und bleibt in 10–400 %', () => {
    expect(fitZoom({ width: 1000, height: 700 }, { width: 1000, height: 1000 }, 50)).toBeCloseTo(0.6);
    expect(fitZoom({ width: 10_000, height: 10_000 }, { width: 100, height: 100 })).toBe(MAX_ZOOM);
    expect(fitZoom({ width: 100, height: 100 }, { width: 8000, height: 8000 })).toBe(MIN_ZOOM);
    expect(fitZoom({ width: 50, height: 50 }, { width: 500, height: 500 }, 48)).toBe(MIN_ZOOM); // Viewport kleiner als Rand
  });

  it('centerPan zentriert die Seite', () => {
    expect(centerPan({ width: 1000, height: 800 }, { width: 400, height: 200 }, 2)).toEqual({ x: 100, y: 200 });
  });

  it('zoomAround hält den Punkt unter dem Zeiger fest', () => {
    const pan = { x: 100, y: 50 }, zoom = 1, next = 2, anchor = { x: 300, y: 250 };
    const p2 = zoomAround(pan, zoom, next, anchor);
    // Seitenpunkt unter dem Anker vorher/nachher gleich
    expect((anchor.x - pan.x) / zoom).toBeCloseTo((anchor.x - p2.x) / next);
    expect((anchor.y - pan.y) / zoom).toBeCloseTo((anchor.y - p2.y) / next);
  });

  it('clampZoom', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
  });
});
