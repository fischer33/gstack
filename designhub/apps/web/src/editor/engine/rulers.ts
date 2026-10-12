/** Teilungen, die ein Lineal verwenden darf (× 10^n): 1, 2, 5. */
const MANTISSAS = [1, 2, 5];

/** Kleinster „schöner“ Abstand (1, 2, 5, 10, 20, 50, 100 …) in Dokumentpixeln, der auf dem Bildschirm mindestens `minPx` breit ist. */
export function niceStep(zoom: number, minPx = 70): number {
  if (!(zoom > 0)) return 100;
  for (let exp = -2; exp < 8; exp++) {
    for (const m of MANTISSAS) {
      const step = m * 10 ** exp;
      if (step * zoom >= minPx) return step;
    }
  }
  return 10 ** 8;
}

/** In wie viele Teile ein Hauptabstand für die kleinen Striche zerlegt wird (1→5, 2→4, 5→5). */
export const minorDivisions = (step: number): number => {
  const mantissa = Math.round(step / 10 ** Math.floor(Math.log10(step)));
  return mantissa === 2 ? 4 : 5;
};

export interface Tick { /** Position im Dokument */ pos: number; /** Position auf dem Bildschirm entlang des Lineals */ screen: number; major: boolean; label?: string }

/**
 * Teilstriche für ein Lineal.
 * @param zoom   Zoomfaktor
 * @param pan    Bildschirmposition des Dokument-Nullpunkts entlang dieser Achse
 * @param length sichtbare Länge des Lineals in Bildschirmpixeln
 */
export function rulerTicks(zoom: number, pan: number, length: number): { step: number; ticks: Tick[] } {
  const step = niceStep(zoom);
  const minor = step / minorDivisions(step);
  const from = Math.floor((0 - pan) / zoom / minor) * minor - minor, to = (length - pan) / zoom + minor;
  const ticks: Tick[] = [];
  // Zählen statt Addieren: vermeidet Fließkomma-Drift bei kleinen Schritten
  for (let i = Math.round(from / minor); i * minor <= to; i++) {
    const pos = Math.round(i * minor * 1e6) / 1e6;
    const major = Math.abs(pos / step - Math.round(pos / step)) < 1e-9;
    ticks.push({ pos, screen: pos * zoom + pan, major, label: major ? formatTick(pos) : undefined });
    if (ticks.length > 2000) break; // Schutz vor ungültigen Eingaben
  }
  return { step, ticks };
}

export const formatTick = (pos: number) => String(Math.round(pos * 100) / 100).replace('.', ',');

/** Größe der Lineale in Bildschirmpixeln. */
export const RULER_SIZE = 20;

/**
 * Bildschirmposition (Mauszeiger) → Position einer Hilfslinie im Dokument.
 * @param client  Mausposition entlang der Achse (clientX bzw. clientY)
 * @param origin  Bildschirmposition des Canvas-Ursprungs entlang der Achse
 * Auf halbe Pixel gerundet, damit Linien nicht auf krummen Werten landen.
 */
export const guidePosition = (client: number, origin: number, pan: number, zoom: number): number =>
  Math.round(((client - origin - pan) / zoom) * 2) / 2;
