import type { Element, Page } from './document';

/**
 * Skaliert ein Element um (sx, sy). Positionen und Maße folgen den Faktoren einzeln; Größen ohne eigene Achse
 * (Schrift, Linienstärke, Rundung, Schatten) folgen dem geometrischen Mittel, damit gleichmäßige Skalierung exakt bleibt.
 * Gruppen skalieren ihre Kinder mit (deren Koordinaten sind relativ zur Gruppe).
 */
export function scaleElement<T extends Element>(el: T, sx: number, sy: number): T {
  const k = Math.sqrt(Math.abs(sx * sy));
  const out = { ...el, x: el.x * sx, y: el.y * sy, width: el.width * sx, height: el.height * sy } as Element;
  switch (out.type) {
    case 'text':
      out.fontSize *= k;
      out.letterSpacing *= sx;
      if (out.strokeWidth) out.strokeWidth *= k;
      if (out.shadow) out.shadow = { ...out.shadow, blur: out.shadow.blur * k, offsetX: out.shadow.offsetX * sx, offsetY: out.shadow.offsetY * sy };
      break;
    case 'shape':
      out.strokeWidth *= k;
      if (out.cornerRadius) out.cornerRadius *= k;
      break;
    case 'image':
      if (out.cornerRadius) out.cornerRadius *= k;
      break;
    case 'group':
      out.children = out.children.map((c) => scaleElement(c, sx, sy));
      break;
  }
  return out as T;
}

/**
 * Passt den Inhalt einer Seite auf ein anderes Format an: gleichmäßig so skaliert, dass alles hineinpasst,
 * und mittig platziert (z. B. Vorlage für 1080×1080 auf ein 1920×1080-Dokument).
 */
export function fitPageToSize(page: Page, from: { width: number; height: number }, to: { width: number; height: number }): Page {
  const k = Math.min(to.width / from.width, to.height / from.height);
  const dx = (to.width - from.width * k) / 2, dy = (to.height - from.height * k) / 2;
  const elements = page.elements.map((e) => {
    const s = scaleElement(e, k, k);
    return { ...s, x: s.x + dx, y: s.y + dy };
  });
  return { ...page, elements };
}
