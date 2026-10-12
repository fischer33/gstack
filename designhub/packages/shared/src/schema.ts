import { z } from 'zod';
import { DOCUMENT_VERSION, isSafePathData, type DesignDocument, type Element } from './document';
import { MAX_SIZE, MIN_SIZE } from './document-utils';

/**
 * Strenge Prüfung von Dokument-JSON (Vorlagen, später beim Speichern auf dem Server).
 * Ziele: keine kaputten Zahlen (NaN, riesige Werte), keine Einschleusung in SVG/CSS (Farben, Schriftnamen, Bildquellen)
 * und feste Obergrenzen, damit ein einzelnes Dokument den Server nicht überlastet. Unbekannte Felder werden verworfen.
 */
export const LIMITS = { pages: 100, elementsPerPage: 1000, groupDepth: 4, textLength: 20_000, srcLength: 15_000_000 } as const;

const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const coord = num(-100_000, 100_000);
const id = z.string().min(1).max(64);

/** Hex, rgb()/hsl() und Farbnamen (inkl. transparent). Keine Anführungszeichen, Klammern außer in rgb()/hsl(), kein url(). */
const color = z.string().max(64).regex(/^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\(\s*[\d.,%\s/]+\)|[a-zA-Z]{3,24})$/, 'Ungültige Farbe');

/** Nur Bilddaten als data:-URL (kein SVG, kein Skript), https oder – für die lokale Entwicklung mit eigenem Speicher – http://localhost. */
const src = z.string().max(LIMITS.srcLength).refine(
  (v) => /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) || /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/)[^\s"'<>]{1,2000}$/.test(v),
  'Bildquelle muss ein PNG/JPEG/WebP/GIF als data:-URL oder eine https-Adresse sein (lokal auch http://localhost)',
);

/** Schriftname: keine Zeichen, mit denen man aus CSS/XML ausbrechen könnte. */
const fontFamily = z.string().min(1).max(100).regex(/^[^<>"'{};\\]+$/, 'Ungültiger Schriftname');

const base = {
  id, name: z.string().max(100).optional(), x: coord, y: coord, width: num(0, 100_000), height: num(0, 100_000),
  rotation: num(-360, 360), opacity: num(0, 1), locked: z.boolean(), visible: z.boolean(),
};

const shadow = z.object({ color, blur: num(0, 200), offsetX: num(-500, 500), offsetY: num(-500, 500), opacity: num(0, 1) });
const filters = z.object({ brightness: num(-100, 100), contrast: num(-100, 100), saturation: num(-100, 100), blur: num(0, 100) });

const shape = z.object({
  ...base, type: z.literal('shape'), kind: z.enum(['rect', 'ellipse', 'line', 'arrow', 'star']),
  fill: color, stroke: color, strokeWidth: num(0, 1000), cornerRadius: num(0, 100_000).optional(), points: z.number().int().min(3).max(20).optional(), shadow: shadow.optional(),
});
const text = z.object({
  ...base, type: z.literal('text'), text: z.string().max(LIMITS.textLength), fontFamily, fontSize: num(1, 2000), fontWeight: z.union([z.literal(400), z.literal(700)]),
  italic: z.boolean(), underline: z.boolean(), align: z.enum(['left', 'center', 'right', 'justify']), fill: color, lineHeight: num(0.1, 10), letterSpacing: num(-100, 500),
  stroke: color.optional(), strokeWidth: num(0, 1000).optional(), shadow: shadow.optional(),
});
const image = z.object({
  ...base, type: z.literal('image'), src, naturalWidth: num(1, 100_000).optional(), naturalHeight: num(1, 100_000).optional(),
  crop: z.object({ x: num(0, 100_000), y: num(0, 100_000), width: num(0, 100_000), height: num(0, 100_000) }).optional(),
  flipX: z.boolean(), flipY: z.boolean(), filters, cornerRadius: num(0, 100_000).optional(),
});
const icon = z.object({
  ...base, type: z.literal('icon'), path: z.string().refine(isSafePathData, 'Ungültige Pfaddaten'), viewBox: num(1, 1000), fill: color,
});

/** Gruppen verschachteln sich rekursiv; die Tiefe ist begrenzt, damit das Schema (und jeder Renderer) endet. */
function elementSchema(depth: number): z.ZodType<Element> {
  const leaves = [shape, text, image, icon] as const;
  if (depth <= 0) return z.discriminatedUnion('type', leaves) as unknown as z.ZodType<Element>;
  const group = z.object({ ...base, type: z.literal('group'), children: z.lazy(() => z.array(elementSchema(depth - 1)).max(LIMITS.elementsPerPage)) });
  return z.discriminatedUnion('type', [...leaves, group]) as unknown as z.ZodType<Element>;
}

const background = z.discriminatedUnion('type', [
  z.object({ type: z.literal('solid'), color }),
  z.object({ type: z.literal('gradient'), angle: num(-360, 720), stops: z.array(z.object({ offset: num(0, 1), color })).min(2).max(10) }),
  z.object({ type: z.literal('image'), src, fit: z.enum(['cover', 'contain']) }),
]);

const page = z.object({ id, background, elements: z.array(elementSchema(LIMITS.groupDepth)).max(LIMITS.elementsPerPage) });

export const designDocumentSchema = z.object({
  version: z.literal(DOCUMENT_VERSION), width: z.number().int().min(MIN_SIZE).max(MAX_SIZE), height: z.number().int().min(MIN_SIZE).max(MAX_SIZE),
  pages: z.array(page).min(1).max(LIMITS.pages),
});

export type ParseResult = { ok: true; doc: DesignDocument } | { ok: false; issues: { path: string; message: string }[] };

/** Prüft beliebige Eingaben. Bei Erfolg kommt das bereinigte Dokument zurück (unbekannte Felder entfernt). */
export function parseDesignDocument(input: unknown): ParseResult {
  const r = designDocumentSchema.safeParse(input);
  if (r.success) return { ok: true, doc: r.data as DesignDocument };
  return { ok: false, issues: r.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })) };
}
