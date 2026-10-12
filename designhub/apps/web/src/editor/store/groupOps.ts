import { newId, type Element, type GroupElement } from '@designhub/shared';
import { boundingRect, centerOf } from '../engine/geometry';

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Fasst Elemente zu einer Gruppe zusammen. Die Gruppe sitzt an der Stelle des obersten Mitglieds,
 * die Kinder bekommen Koordinaten relativ zur Gruppen-Ecke (oben links des gemeinsamen Umschlags).
 * Weniger als zwei passende Elemente: unverändert.
 */
export function groupElements(elements: readonly Element[], ids: readonly string[]): { elements: Element[]; groupId: string | null } {
  const picked = elements.filter((e) => ids.includes(e.id));
  if (picked.length < 2) return { elements: [...elements], groupId: null };

  const rects = picked.map(boundingRect);
  const left = Math.min(...rects.map((r) => r.x)), top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width)), bottom = Math.max(...rects.map((r) => r.y + r.height));

  const group: GroupElement = {
    id: newId(), type: 'group', name: 'Gruppe', x: left, y: top, width: right - left, height: bottom - top,
    rotation: 0, opacity: 1, locked: false, visible: true,
    children: picked.map((e) => ({ ...e, x: e.x - left, y: e.y - top })), // z-Reihenfolge bleibt erhalten
  };
  const topIndex = Math.max(...picked.map((e) => elements.indexOf(e)));
  const out: Element[] = [];
  elements.forEach((e, i) => {
    if (i === topIndex) out.push(group);
    if (!ids.includes(e.id)) out.push(e);
  });
  return { elements: out, groupId: group.id };
}

/** Löst eine Gruppe auf. Drehung und Position der Gruppe werden in die Kinder eingerechnet. */
export function ungroupElement(elements: readonly Element[], groupId: string): { elements: Element[]; childIds: string[] } {
  const index = elements.findIndex((e) => e.id === groupId);
  const g = elements[index];
  if (!g || g.type !== 'group') return { elements: [...elements], childIds: [] };

  const gc = centerOf(g), r = rad(g.rotation), cos = Math.cos(r), sin = Math.sin(r);
  const children = g.children.map((c): Element => {
    // Kindmitte (relativ zur Gruppen-Ecke) um die Gruppenmitte drehen, dann in Seitenkoordinaten
    const lx = c.x + c.width / 2 - g.width / 2, ly = c.y + c.height / 2 - g.height / 2;
    const cx = gc.x + lx * cos - ly * sin, cy = gc.y + lx * sin + ly * cos;
    return { ...c, x: cx - c.width / 2, y: cy - c.height / 2, rotation: c.rotation + g.rotation, opacity: c.opacity * g.opacity };
  });
  return { elements: [...elements.slice(0, index), ...children, ...elements.slice(index + 1)], childIds: children.map((c) => c.id) };
}
