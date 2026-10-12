export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export interface Point { x: number; y: number }

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Zoom, bei dem die ganze Seite mit `padding` Rand in den Viewport passt. */
export function fitZoom(view: { width: number; height: number }, page: { width: number; height: number }, padding = 48): number {
  const z = Math.min((view.width - 2 * padding) / page.width, (view.height - 2 * padding) / page.height);
  return clampZoom(Number.isFinite(z) && z > 0 ? z : MIN_ZOOM);
}

/** Verschiebung (in Bildschirm-Pixeln), die die Seite bei gegebenem Zoom im Viewport zentriert. */
export const centerPan = (view: { width: number; height: number }, page: { width: number; height: number }, zoom: number): Point => ({
  x: (view.width - page.width * zoom) / 2,
  y: (view.height - page.height * zoom) / 2,
});

/** Neuer Pan, damit der Seitenpunkt unter `anchor` (Bildschirmkoordinaten) beim Zoomen stehen bleibt. */
export function zoomAround(pan: Point, zoom: number, nextZoom: number, anchor: Point): Point {
  const k = nextZoom / zoom;
  return { x: anchor.x - (anchor.x - pan.x) * k, y: anchor.y - (anchor.y - pan.y) * k };
}
