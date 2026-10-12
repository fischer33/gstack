import { describe, expect, it } from 'vitest';
import { boundingRect, centerOf, fromNodePose, intersects, normalizeRotation, toNodePose } from './geometry';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('toNodePose / fromNodePose', () => {
  it('ohne Drehung identisch', () => {
    expect(toNodePose({ x: 10, y: 20, width: 100, height: 50, rotation: 0 })).toEqual({ x: 10, y: 20, rotation: 0 });
  });

  it('Rundreise erhält Modellwerte für beliebige Drehungen', () => {
    for (const rotation of [0, 30, 45, 90, 137, 180, -75]) {
      const box = { x: 123, y: -45, width: 210, height: 64, rotation };
      const pose = toNodePose(box);
      const back = fromNodePose(pose, box.width, box.height);
      for (const k of ['x', 'y', 'width', 'height', 'rotation'] as const) close(back[k], box[k]);
    }
  });

  it('Drehung um 90° dreht um die Mitte: Mittelpunkt bleibt, Knoten-Ursprung wandert', () => {
    const box = { x: 0, y: 0, width: 100, height: 20, rotation: 90 };
    const pose = toNodePose(box);
    // Mitte (50, 10); nach 90° steht der Rahmen hochkant, die obere linke Ecke des Knotens liegt rechts oben davon
    close(pose.x, 60);
    close(pose.y, -40);
    const c = centerOf(fromNodePose(pose, 100, 20));
    close(c.x, 50);
    close(c.y, 10);
  });

  it('Größenänderung am Knoten verschiebt die Mitte korrekt (Ecke oben links bleibt fest)', () => {
    const pose = toNodePose({ x: 10, y: 10, width: 100, height: 50, rotation: 90 });
    const grown = fromNodePose(pose, 200, 50); // Breite verdoppelt, Knoten-Ursprung unverändert
    const o = toNodePose(grown);
    close(o.x, pose.x);
    close(o.y, pose.y);
  });
});

describe('normalizeRotation', () => {
  it('bringt Winkel in (-180, 180]', () => {
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(540)).toBe(180);
    expect(normalizeRotation(-180)).toBe(180);
    expect(normalizeRotation(45.123456)).toBe(45.12);
  });
});

describe('boundingRect / intersects', () => {
  it('um 90° gedrehter Rahmen vertauscht Breite und Höhe', () => {
    const r = boundingRect({ x: 0, y: 0, width: 100, height: 20, rotation: 90 });
    close(r.width, 20);
    close(r.height, 100);
    close(r.x, 40);
    close(r.y, -40);
  });
  it('Schnittprüfung: berührende Kanten zählen nicht', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(intersects(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(intersects(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
    expect(intersects(a, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
  });
});
