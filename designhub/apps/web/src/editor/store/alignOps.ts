import type { Element } from '@designhub/shared';
import { boundingRect } from '../engine/geometry';

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type Offsets = Record<string, { dx: number; dy: number }>;

/**
 * Richtet Elemente aus. Bei mehreren Elementen am gemeinsamen Umschlag der Auswahl, bei einem einzelnen an der Seite.
 * Gedrehte Elemente zählen mit ihrem Umschlag. Liefert die nötige Verschiebung je Element.
 */
export function alignOffsets(elements: readonly Element[], mode: AlignMode, page: { width: number; height: number }): Offsets {
  if (!elements.length) return {};
  const rects = elements.map((e) => ({ id: e.id, ...boundingRect(e) }));
  const ref = elements.length === 1
    ? { x: 0, y: 0, width: page.width, height: page.height }
    : (() => {
        const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
        return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
      })();
  const out: Offsets = {};
  for (const r of rects) {
    let dx = 0, dy = 0;
    if (mode === 'left') dx = ref.x - r.x;
    else if (mode === 'right') dx = ref.x + ref.width - (r.x + r.width);
    else if (mode === 'centerX') dx = ref.x + ref.width / 2 - (r.x + r.width / 2);
    else if (mode === 'top') dy = ref.y - r.y;
    else if (mode === 'bottom') dy = ref.y + ref.height - (r.y + r.height);
    else dy = ref.y + ref.height / 2 - (r.y + r.height / 2);
    out[r.id] = { dx, dy };
  }
  return out;
}

/** Verteilt mindestens drei Elemente so, dass die Lücken zwischen ihnen gleich groß sind. Erstes und letztes bleiben stehen. */
export function distributeOffsets(elements: readonly Element[], axis: 'x' | 'y'): Offsets {
  if (elements.length < 3) return {};
  const items = elements.map((e) => ({ id: e.id, r: boundingRect(e) }));
  const start = (r: { x: number; y: number }) => (axis === 'x' ? r.x : r.y);
  const size = (r: { width: number; height: number }) => (axis === 'x' ? r.width : r.height);
  items.sort((a, b) => start(a.r) - start(b.r));
  const first = items[0].r, last = items[items.length - 1].r;
  const span = start(last) + size(last) - start(first);
  const gap = (span - items.reduce((n, i) => n + size(i.r), 0)) / (items.length - 1);
  const out: Offsets = {};
  let cursor = start(first);
  for (const { id, r } of items) {
    const d = cursor - start(r);
    out[id] = axis === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += size(r) + gap;
  }
  return out;
}
