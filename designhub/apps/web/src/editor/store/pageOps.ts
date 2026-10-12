import type { Element } from '@designhub/shared';

export type ReorderDirection = 'front' | 'back' | 'forward' | 'backward';

/**
 * Ändert die Z-Reihenfolge (Index 0 = ganz hinten). Die gewählten Elemente behalten ihre
 * relative Reihenfolge zueinander. Gibt ein neues Array zurück; unbekannte IDs werden ignoriert.
 */
export function reorder<T extends { id: string }>(items: readonly T[], ids: readonly string[], dir: ReorderDirection): T[] {
  const picked = new Set(ids);
  const out = [...items];
  if (dir === 'front') return [...out.filter((e) => !picked.has(e.id)), ...out.filter((e) => picked.has(e.id))];
  if (dir === 'back') return [...out.filter((e) => picked.has(e.id)), ...out.filter((e) => !picked.has(e.id))];
  // Schrittweise: jedes gewählte Element tauscht mit seinem Nachbarn, sofern der nicht ebenfalls gewählt ist
  // (sonst würde ein zusammenhängender Block an seinem eigenen Ende "hängen bleiben").
  if (dir === 'forward') {
    for (let i = out.length - 2; i >= 0; i--) if (picked.has(out[i].id) && !picked.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  } else {
    for (let i = 1; i < out.length; i++) if (picked.has(out[i].id) && !picked.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]];
  }
  return out;
}

/** Tiefe Kopie mit neuen IDs (auch für Kinder von Gruppen), verschoben um (dx, dy). */
export function cloneElement(el: Element, newId: () => string, dx = 0, dy = 0): Element {
  const copy = JSON.parse(JSON.stringify(el)) as Element;
  copy.id = newId();
  copy.x += dx;
  copy.y += dy;
  if (copy.type === 'group') copy.children = copy.children.map((c) => cloneElement(c, newId));
  return copy;
}
