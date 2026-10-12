import { describe, expect, it } from 'vitest';
import { cropByEdges, effectiveCrop } from './cropMath';

// 400×300 Dokumentpixel zeigen ein 800×600-Bild (Faktor 0,5)
const frame = { width: 400, height: 300, naturalWidth: 800, naturalHeight: 600 };

describe('cropByEdges', () => {
  it('ohne Zuschnitt zeigt das Bild alles', () => {
    expect(effectiveCrop(frame)).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('linke Kante nach innen: Ausschnitt schrumpft ohne zu strecken (gleiche Pixeldichte)', () => {
    const r = cropByEdges(frame, { left: 100, top: 0, right: 400, bottom: 300 });
    expect(r.crop).toEqual({ x: 200, y: 0, width: 600, height: 600 });
    expect(r.offsetX).toBe(100);
    expect(r.width).toBe(300);
    expect(r.width / r.crop.width).toBeCloseTo(0.5); // Dichte unverändert
  });

  it('rechte und untere Kante nach innen', () => {
    const r = cropByEdges(frame, { left: 0, top: 0, right: 200, bottom: 150 });
    expect(r.crop).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect([r.width, r.height]).toEqual([200, 150]);
  });

  it('wieder aufziehen: erneutes Zuschneiden kann Bildteile zurückholen', () => {
    const cropped = { ...frame, width: 300, height: 300, crop: { x: 200, y: 0, width: 600, height: 600 } };
    const r = cropByEdges(cropped, { left: -100, top: 0, right: 300, bottom: 300 });
    expect(r.crop.x).toBe(0);
    expect(r.crop.width).toBe(800);
    expect(r.offsetX).toBe(-100);
  });

  it('wird an den Bildgrenzen begrenzt', () => {
    const r = cropByEdges(frame, { left: -500, top: -500, right: 5000, bottom: 5000 });
    expect(r.crop).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect([r.offsetX, r.offsetY, r.width, r.height]).toEqual([0, 0, 400, 300]);
  });

  it('Mindestgröße: kann nicht auf nichts zugeschnitten werden', () => {
    const r = cropByEdges(frame, { left: 395, top: 0, right: 400, bottom: 300 });
    expect(r.crop.width).toBeGreaterThanOrEqual(8);
    const l = cropByEdges(frame, { left: 0, top: 0, right: 2, bottom: 300 });
    expect(l.crop.width).toBeGreaterThanOrEqual(8);
  });
});
