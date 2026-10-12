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

/** Verschiebt ein Element eines Arrays an eine neue Position (neues Array). Ungültige Indizes werden begrenzt. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const out = [...items];
  const [item] = out.splice(from, 1);
  out.splice(Math.min(Math.max(to, 0), out.length), 0, item);
  return out;
}

/**
 * Setzt die gewählten Elemente als Block an einen Index. Der Index zählt in der Liste *ohne* die gewählten Elemente
 * (0 = ganz hinten, Länge = ganz vorne). Die relative Reihenfolge der gewählten bleibt erhalten.
 */
export function reorderToIndex<T extends { id: string }>(items: readonly T[], ids: readonly string[], index: number): T[] {
  const picked = items.filter((e) => ids.includes(e.id));
  if (!picked.length) return [...items];
  const rest = items.filter((e) => !ids.includes(e.id));
  const at = Math.min(Math.max(index, 0), rest.length);
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}
