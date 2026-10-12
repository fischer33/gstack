export interface Crop { x: number; y: number; width: number; height: number }

export interface CropFrame {
  width: number; height: number;
  crop?: Crop; naturalWidth: number; naturalHeight: number;
}

/** Ein Bild ohne Zuschnitt zeigt das ganze Bild. */
export const effectiveCrop = (f: CropFrame): Crop => f.crop ?? { x: 0, y: 0, width: f.naturalWidth, height: f.naturalHeight };

const MIN_SOURCE_PX = 8;

/**
 * Zuschneiden durch Verschieben der Rahmenkanten. Das Bild wird dabei nicht gestreckt: Der Rahmen ist ein Fenster
 * auf das Quellbild, die Pixeldichte bleibt gleich.
 *
 * `edges` sind die neuen Kanten relativ zur alten oberen linken Ecke in Dokumentpixeln (links darf negativ sein =
 * wieder mehr vom Bild zeigen). Das Ergebnis ist auf die Bildgrenzen begrenzt und liefert den neuen Ausschnitt,
 * die Verschiebung der Ecke und die tatsächliche neue Rahmengröße.
 */
export function cropByEdges(f: CropFrame, edges: { left: number; top: number; right: number; bottom: number }) {
  const c = effectiveCrop(f);
  const kx = f.width / c.width, ky = f.height / c.height; // Dokumentpixel je Quellpixel
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  let x1 = clamp(c.x + edges.left / kx, 0, f.naturalWidth), x2 = clamp(c.x + edges.right / kx, 0, f.naturalWidth);
  let y1 = clamp(c.y + edges.top / ky, 0, f.naturalHeight), y2 = clamp(c.y + edges.bottom / ky, 0, f.naturalHeight);
  // Mindestgröße: die bewegte Kante wird zurückgeschoben (die gegenüberliegende bleibt)
  if (x2 - x1 < MIN_SOURCE_PX) { if (edges.left !== 0) x1 = x2 - MIN_SOURCE_PX; else x2 = x1 + MIN_SOURCE_PX; }
  if (y2 - y1 < MIN_SOURCE_PX) { if (edges.top !== 0) y1 = y2 - MIN_SOURCE_PX; else y2 = y1 + MIN_SOURCE_PX; }
  x1 = Math.max(0, x1); y1 = Math.max(0, y1); x2 = Math.min(f.naturalWidth, x2); y2 = Math.min(f.naturalHeight, y2);

  return {
    crop: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
    offsetX: (x1 - c.x) * kx, offsetY: (y1 - c.y) * ky,
    width: (x2 - x1) * kx, height: (y2 - y1) * ky,
  };
}
