/**
 * Umrechnung zwischen Dokumentmodell und Konva-Knoten.
 *
 * Modell: (x, y) = obere linke Ecke des *unrotierten* Rahmens, Drehung um die Rahmenmitte.
 * Konva-Knoten mit Ursprung oben links drehen dagegen um (x, y) selbst. Wir halten die Knoten bewusst
 * ohne `offset`, weil der Transformer damit beim Skalieren und Drehen zuverlässig arbeitet, und rechnen
 * nur an den Grenzen (Rendern, Drag-Ende, Transform-Ende) um.
 */
export interface Box { x: number; y: number; width: number; height: number; rotation: number }
export interface NodePose { x: number; y: number; rotation: number }

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Mittelpunkt des (ggf. gedrehten) Rahmens in Seitenkoordinaten. */
export const centerOf = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Modell → Knoten mit Ursprung oben links. */
export function toNodePose(b: Box): NodePose {
  const c = centerOf(b), r = rad(b.rotation), cos = Math.cos(r), sin = Math.sin(r);
  return { x: c.x - ((b.width / 2) * cos - (b.height / 2) * sin), y: c.y - ((b.width / 2) * sin + (b.height / 2) * cos), rotation: b.rotation };
}

/** Knoten mit Ursprung oben links (inkl. neuer Größe) → Modell. */
export function fromNodePose(pose: NodePose, width: number, height: number): Box {
  const r = rad(pose.rotation), cos = Math.cos(r), sin = Math.sin(r);
  const cx = pose.x + ((width / 2) * cos - (height / 2) * sin);
  const cy = pose.y + ((width / 2) * sin + (height / 2) * cos);
  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation: pose.rotation };
}

/** Rotation auf (-180, 180] normalisieren, damit sich Werte nach vielen Drehungen nicht aufsummieren. */
export function normalizeRotation(deg: number): number {
  const r = ((((deg + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : Math.round(r * 100) / 100;
}

/** Gedrehter Rahmen → achsenparalleles Umschlag-Rechteck (für Auswahlrahmen/Schnittprüfung). */
export function boundingRect(b: Box) {
  const c = centerOf(b), r = rad(b.rotation), cos = Math.abs(Math.cos(r)), sin = Math.abs(Math.sin(r));
  const w = b.width * cos + b.height * sin, h = b.width * sin + b.height * cos;
  return { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h };
}

export const intersects = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
