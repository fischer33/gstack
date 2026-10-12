import { describe, expect, it } from 'vitest';
import { computeSnap } from './snap';

const page = { width: 1000, height: 1000 };

describe('computeSnap', () => {
  it('rastet an der Seitenmitte ein und meldet die Führungslinie', () => {
    // rechte Kante 495 → Seitenmitte 500
    const edge = computeSnap({ x: 395, y: 100, width: 100, height: 100 }, [], page, 8);
    expect(edge.dx).toBe(5);
    const near = computeSnap({ x: 453, y: 100, width: 100, height: 100 }, [], page, 8); // Mitte 503 → 500
    expect(near.dx).toBe(-3);
    expect(near.guides.vertical).toContain(500);
  });

  it('rastet an Kanten anderer Elemente ein (links an rechter Kante)', () => {
    const other = { x: 100, y: 600, width: 200, height: 100 };
    const r = computeSnap({ x: 305, y: 100, width: 80, height: 80 }, [other], page, 8);
    expect(r.dx).toBe(-5); // linke Kante 305 → 300 (rechte Kante des anderen)
    expect(r.guides.vertical).toContain(300);
  });

  it('rastet an Oberkante/Mitte unabhängig von x', () => {
    const other = { x: 700, y: 400, width: 100, height: 100 };
    const r = computeSnap({ x: 100, y: 452, width: 100, height: 100 }, [other], page, 8); // Mitte 502 → 500 (Seitenmitte); auch andere Mitte 450 liegt weit
    expect(r.dy).toBe(-2);
    expect(r.dx).toBe(0);
    expect(r.guides.horizontal).toContain(500);
  });

  it('außerhalb der Schwelle: keine Korrektur, keine Linien', () => {
    const r = computeSnap({ x: 200, y: 300, width: 100, height: 100 }, [{ x: 600, y: 700, width: 50, height: 50 }], page, 4);
    expect(r).toEqual({ dx: 0, dy: 0, guides: { vertical: [], horizontal: [] } });
  });

  it('wählt das nächste Ziel, wenn mehrere in Reichweite sind', () => {
    // Linien der anderen: 98/198/298 und 100/200/300; eigene linke Kante 102 → 100 ist näher (−2) als 98 (−4)
    const r = computeSnap({ x: 102, y: 0, width: 50, height: 50 }, [{ x: 98, y: 300, width: 200, height: 10 }, { x: 100, y: 600, width: 200, height: 10 }], page, 8);
    expect(r.dx).toBe(-2);
  });

  it('Seitenrand: linke Kante rastet bei 0 ein', () => {
    expect(computeSnap({ x: 6, y: 300, width: 100, height: 100 }, [], page, 8).dx).toBe(-6);
  });

  it('rastet an zusätzlichen Linien (Hilfslinien) ein und meldet sie', () => {
    const r = computeSnap({ x: 303, y: 100, width: 100, height: 100 }, [], page, 8, { x: [300], y: [900] });
    expect(r.dx).toBe(-3); // linke Kante an Hilfslinie x=300
    expect(r.guides.vertical).toContain(300);
    const v = computeSnap({ x: 100, y: 702, width: 100, height: 100 }, [], page, 8, { y: [800] }); // Unterkante 802 → 800
    expect(v.dy).toBe(-2);
    expect(v.guides.horizontal).toContain(800);
  });
  it('ohne zusätzliche Linien unverändertes Verhalten', () => {
    expect(computeSnap({ x: 303, y: 100, width: 100, height: 100 }, [], page, 4).dx).toBe(0);
  });
});
