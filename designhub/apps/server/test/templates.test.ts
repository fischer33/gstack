import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORMATS, parseDesignDocument } from '@designhub/shared';

const dir = join(__dirname, '..', 'prisma', 'templates');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const all = files.map((f) => ({ f, t: JSON.parse(readFileSync(join(dir, f), 'utf8')) }));

describe('gestaltete Vorlagen (JSON)', () => {
  it('es gibt mindestens zwölf', () => expect(all.length).toBeGreaterThanOrEqual(12));
  it('IDs sind eindeutig und passen zum Dateinamen', () => {
    expect(new Set(all.map((x) => x.t.id)).size).toBe(all.length);
    for (const { f, t } of all) expect(f).toBe(`${t.id}.json`);
  });
  it.each(all.map((x) => [x.f, x.t]))('%s ist ein gültiges Dokument in einem bekannten Format', (_f, t) => {
    const r = parseDesignDocument(t.data);
    expect(r.ok, JSON.stringify(r.ok ? [] : r.issues)).toBe(true);
    expect(Object.values(FORMATS).some((fm) => fm.width === t.width && fm.height === t.height)).toBe(true);
    if (r.ok) {
      expect(r.doc.width).toBe(t.width);
      expect(r.doc.height).toBe(t.height);
      expect(r.doc.pages.length).toBeGreaterThan(0);
      expect(r.doc.pages.every((p) => p.elements.length >= 3)).toBe(true);
    }
    expect(t.title.length).toBeGreaterThan(2);
    expect(t.tags.length).toBeGreaterThan(0);
  });
  it('mehrseitige Vorlagen sind dabei', () => expect(all.some((x) => x.t.data.pages.length > 1)).toBe(true));
});
