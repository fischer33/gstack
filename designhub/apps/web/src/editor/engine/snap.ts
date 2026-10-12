export interface Rect { x: number; y: number; width: number; height: number }
export interface Guides { vertical: number[]; horizontal: number[] }
export interface SnapResult { dx: number; dy: number; guides: Guides }

const lines = (r: Rect, axis: 'x' | 'y') => {
  const [a, size] = axis === 'x' ? [r.x, r.width] : [r.y, r.height];
  return [a, a + size / 2, a + size];
};

/**
 * Smart Guides: findet für ein bewegtes Rechteck die nächste Ausrichtung (Kante/Mitte) an Seite und anderen
 * Elementen. `threshold` in Dokumentpixeln (bei Zoom: Bildschirmpixel / Zoom). Liefert die Korrektur und die
 * Führungslinien, die nach dem Einrasten aktiv sind.
 */
export function computeSnap(moving: Rect, others: readonly Rect[], page: { width: number; height: number }, threshold: number): SnapResult {
  const targets = (axis: 'x' | 'y') => [...lines({ x: 0, y: 0, width: page.width, height: page.height }, axis), ...others.flatMap((o) => lines(o, axis))];

  const best = (axis: 'x' | 'y') => {
    const mine = lines(moving, axis);
    let delta = 0, dist = Infinity;
    for (const t of targets(axis)) for (const m of mine) {
      const d = t - m;
      if (Math.abs(d) < dist) { dist = Math.abs(d); delta = d; }
    }
    return dist <= threshold ? delta : 0;
  };

  const dx = best('x'), dy = best('y');
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const active = (axis: 'x' | 'y') => {
    const out = new Set<number>();
    for (const t of targets(axis)) for (const m of lines(snapped, axis)) if (Math.abs(t - m) < 0.5) out.add(Math.round(t * 100) / 100);
    return [...out];
  };
  return { dx, dy, guides: { vertical: active('x'), horizontal: active('y') } };
}
