import { DOCUMENT_VERSION, type DesignDocument, type Page } from './document';

export const MIN_SIZE = 50;
export const MAX_SIZE = 8000;

export const newId = (): string => globalThis.crypto.randomUUID();

export const blankPage = (): Page => ({ id: newId(), background: { type: 'solid', color: '#ffffff' }, elements: [] });

export const blankDocument = (width: number, height: number): DesignDocument => ({
  version: DOCUMENT_VERSION, width, height, pages: [blankPage()],
});

/** Unterstützt "1080 x 1080", "1080×1080" usw. Liefert null bei ungültigen oder unzulässigen Maßen. */
export function parseSize(input: string): { width: number; height: number } | null {
  const m = input.trim().match(/^(\d{2,5})\s*[x×*]\s*(\d{2,5})$/i);
  if (!m) return null;
  const [width, height] = [Number(m[1]), Number(m[2])];
  return width >= MIN_SIZE && width <= MAX_SIZE && height >= MIN_SIZE && height <= MAX_SIZE ? { width, height } : null;
}
