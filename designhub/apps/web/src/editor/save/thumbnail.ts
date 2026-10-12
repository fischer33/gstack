import type { DesignDocument, Page } from '@designhub/shared';

const MAX_SIDE = 360;
const MAX_CHARS = 380_000; // Server nimmt höchstens 400 000 Zeichen an

/** Vorschaubild der ersten Seite als PNG-Data-URL (bei Fotos zu groß → JPEG). */
export async function makeThumbnail(doc: Pick<DesignDocument, 'width' | 'height'>, page: Page): Promise<string> {
  const { preparePages, renderPageToCanvas } = await import('../export/renderPage');
  await preparePages([page]);
  const scale = Math.min(1, MAX_SIDE / Math.max(doc.width, doc.height));
  const png = (await renderPageToCanvas(doc, page, scale)).toDataURL('image/png');
  if (png.length <= MAX_CHARS) return png;
  const jpg = (await renderPageToCanvas(doc, page, scale, true)).toDataURL('image/jpeg', 0.75);
  if (jpg.length > MAX_CHARS) throw new Error('thumbnail too large');
  return jpg;
}

/** Merkt sich die zuletzt erzeugte Vorschau je Seitenobjekt: Änderungen auf anderen Seiten kosten keinen neuen Render. */
export function thumbnailCache() {
  let last: { page: Page; value: string | undefined } | null = null;
  return async (doc: DesignDocument): Promise<string | undefined> => {
    const first = doc.pages[0];
    if (!first) return undefined;
    if (last?.page === first) return last.value;
    let value: string | undefined;
    try { value = await makeThumbnail(doc, first); } catch { value = undefined; } // ohne Vorschau speichern, der Server setzt eine SVG-Vorschau
    last = { page: first, value };
    return value;
  };
}
