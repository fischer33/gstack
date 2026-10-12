export interface FontInfo { family: string; category: 'Sans' | 'Serif' | 'Handschrift' | 'Display' | 'Mono'; bold: boolean }

/** Schriften aus Google Fonts (offene Lizenzen). `bold: false` = nur ein Schnitt vorhanden. */
export const FONTS: FontInfo[] = [
  ...['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans', 'Rubik', 'Source Sans 3', 'Oswald', 'Quicksand', 'Barlow'].map((family) => ({ family, category: 'Sans' as const, bold: true })),
  ...['Playfair Display', 'Merriweather', 'Lora', 'Libre Baskerville', 'Cormorant Garamond', 'EB Garamond', 'Crimson Text', 'PT Serif'].map((family) => ({ family, category: 'Serif' as const, bold: true })),
  ...['Dancing Script', 'Caveat'].map((family) => ({ family, category: 'Handschrift' as const, bold: true })),
  ...['Pacifico', 'Satisfy', 'Great Vibes', 'Sacramento', 'Lobster'].map((family) => ({ family, category: 'Handschrift' as const, bold: false })),
  ...['Bebas Neue', 'Anton', 'Abril Fatface', 'Righteous', 'Bangers'].map((family) => ({ family, category: 'Display' as const, bold: false })),
  { family: 'Fredoka', category: 'Display', bold: true },
  ...['Roboto Mono', 'Space Mono', 'JetBrains Mono'].map((family) => ({ family, category: 'Mono' as const, bold: true })),
];

export const fontInfo = (family: string) => FONTS.find((f) => f.family === family);

/**
 * CSS-URL für Google Fonts. Es werden bewusst nur aufrechte Schnitte (400/700) angefragt: Kursiv gibt es nicht
 * bei jeder Schrift, und eine unbekannte Anfrage lässt Google mit 400 antworten (dann lädt gar nichts).
 * Der Browser erzeugt Kursiv bei Bedarf selbst.
 */
export function googleFontsUrl(family: string, bold = true): string {
  const name = family.trim().replace(/\s+/g, '+');
  return `https://fonts.googleapis.com/css2?family=${name}${bold ? ':wght@400;700' : ''}&display=swap`;
}

const loading = new Map<string, Promise<void>>();
const TIMEOUT_MS = 2500;

/**
 * Lädt eine Schrift (einmal pro Familie) und wartet, bis sie verfügbar ist oder das Zeitlimit abläuft.
 * Schlägt das Laden fehl (offline, blockiert), läuft der Editor mit der Ersatzschrift weiter.
 * Hinweis Datenschutz: Das lädt von fonts.googleapis.com. Zum Selbst-Hosten die Dateien über @fontsource ausliefern.
 */
export function ensureFont(family: string): Promise<void> {
  const known = loading.get(family);
  if (known) return known;
  const p = (async () => {
    if (typeof document === 'undefined' || family === 'sans-serif') return;
    const info = fontInfo(family);
    if (!info) return; // System-/unbekannte Schrift: nichts zu laden
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsUrl(family, info.bold);
    document.head.appendChild(link);
    const load = Promise.all([document.fonts.load(`400 16px "${family}"`), ...(info.bold ? [document.fonts.load(`700 16px "${family}"`)] : [])]).then(() => undefined);
    await Promise.race([load, new Promise<void>((r) => setTimeout(r, TIMEOUT_MS))]).catch(() => undefined);
  })();
  loading.set(family, p);
  return p;
}

export const ensureFonts = (families: Iterable<string>) => Promise.all([...new Set(families)].map(ensureFont)).then(() => undefined);
