/**
 * Drag-Sortierung im Ebenenpanel. Das Panel zeigt oben das vorderste Element; die Liste `display` ist also von
 * vorne nach hinten sortiert (umgekehrt zur Z-Reihenfolge im Dokument).
 *
 * `slot` ist die Einfügemarke zwischen den Zeilen (0 = ganz oben, display.length = ganz unten).
 * Rückgabe: Index für `reorderToIndex` (zählt in der Dokumentreihenfolge ohne die verschobenen Elemente).
 */
export function layerDropIndex(display: readonly { id: string }[], movedIds: readonly string[], slot: number): number {
  const moved = new Set(movedIds);
  const restAbove = display.slice(0, Math.max(0, slot)).filter((e) => !moved.has(e.id)).length;
  const restTotal = display.filter((e) => !moved.has(e.id)).length;
  return restTotal - restAbove;
}
