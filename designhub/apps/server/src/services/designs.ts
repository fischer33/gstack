import type { Prisma, PrismaClient } from '@prisma/client';
import { TRASH_RETENTION_DAYS, blankDocument, pageToSvg, svgToDataUrl, type DesignDocument, type DesignSummary, type Page } from '@designhub/shared';

const SUMMARY = { id: true, title: true, width: true, height: true, thumbnail: true, folderId: true, updatedAt: true, deletedAt: true } as const;
type Row = Prisma.DesignGetPayload<{ select: typeof SUMMARY }>;

const toSummary = (r: Row): DesignSummary => ({
  ...r, updatedAt: r.updatedAt.toISOString(), deletedAt: r.deletedAt?.toISOString() ?? null,
});

/** Vorschau aus der ersten Seite. Der Editor ersetzt sie später durch ein echtes PNG. */
export function thumbnailOf(width: number, height: number, pages: Page[]): string | null {
  return pages[0] ? svgToDataUrl(pageToSvg({ width, height }, pages[0])) : null;
}

export interface ListQuery { q?: string; folderId?: string; trash?: boolean; sort?: 'updated' | 'title'; limit?: number }
export interface CreateInput { title?: string; width?: number; height?: number; folderId?: string | null; templateId?: string }

export type Result<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'invalid_folder' | 'invalid_template' };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: Extract<Result<never>, { ok: false }>['error']): Result<never> => ({ ok: false, error });

/** Alle Abfragen sind auf `ownerId` begrenzt; fremde IDs verhalten sich wie nicht vorhanden. */
export function designService(db: PrismaClient) {
  const ownsFolder = async (userId: string, folderId: string) => (await db.folder.count({ where: { id: folderId, ownerId: userId } })) > 0;

  return {
    async list(userId: string, q: ListQuery): Promise<DesignSummary[]> {
      if (q.trash) await this.purgeExpired(userId);
      const where: Prisma.DesignWhereInput = {
        ownerId: userId,
        deletedAt: q.trash ? { not: null } : null,
        ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
        // "root" = ohne Ordner, sonst konkreter Ordner; ohne Angabe alle
        ...(q.folderId === 'root' ? { folderId: null } : q.folderId ? { folderId: q.folderId } : {}),
      };
      const rows = await db.design.findMany({
        where, select: SUMMARY, take: q.limit ?? 60,
        orderBy: q.sort === 'title' ? { title: 'asc' } : q.trash ? { deletedAt: 'desc' } : { updatedAt: 'desc' },
      });
      return rows.map(toSummary);
    },

    async create(userId: string, input: CreateInput): Promise<Result<DesignSummary>> {
      if (input.folderId && !(await ownsFolder(userId, input.folderId))) return fail('invalid_folder');
      let doc: DesignDocument;
      let title = input.title ?? 'Unbenanntes Design';
      if (input.templateId) {
        const t = await db.template.findUnique({ where: { id: input.templateId } });
        if (!t) return fail('invalid_template');
        doc = JSON.parse(JSON.stringify(t.data)) as DesignDocument; // tiefe Kopie, Vorlage bleibt unverändert
        title = input.title ?? t.title;
      } else {
        doc = blankDocument(input.width!, input.height!);
      }
      const row = await db.design.create({
        data: {
          title, width: doc.width, height: doc.height, ownerId: userId, folderId: input.folderId ?? null,
          pages: doc.pages as unknown as Prisma.InputJsonValue, thumbnail: thumbnailOf(doc.width, doc.height, doc.pages),
        },
        select: SUMMARY,
      });
      return ok(toSummary(row));
    },

    /** Vollständiges Design (für den Editor). */
    async get(userId: string, id: string) {
      const row = await db.design.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
      return row ? ok({ ...toSummary(row), pages: row.pages as unknown as Page[], version: row.version }) : fail('not_found');
    },

    async update(userId: string, id: string, patch: { title?: string; folderId?: string | null }): Promise<Result<DesignSummary>> {
      if (patch.folderId && !(await ownsFolder(userId, patch.folderId))) return fail('invalid_folder');
      // updatedAt springt hier absichtlich mit: Umbenennen/Verschieben zählt als Bearbeitung.
      const { count } = await db.design.updateMany({ where: { id, ownerId: userId, deletedAt: null }, data: patch });
      if (!count) return fail('not_found');
      return ok(toSummary((await db.design.findUniqueOrThrow({ where: { id }, select: SUMMARY }))));
    },

    async duplicate(userId: string, id: string): Promise<Result<DesignSummary>> {
      const src = await db.design.findFirst({ where: { id, ownerId: userId, deletedAt: null } });
      if (!src) return fail('not_found');
      const row = await db.design.create({
        data: {
          title: `Kopie von ${src.title}`.slice(0, 120), width: src.width, height: src.height, ownerId: userId,
          folderId: src.folderId, pages: src.pages as Prisma.InputJsonValue, thumbnail: src.thumbnail,
        },
        select: SUMMARY,
      });
      return ok(toSummary(row));
    },

    async trash(userId: string, id: string): Promise<Result<true>> {
      const { count } = await db.design.updateMany({ where: { id, ownerId: userId, deletedAt: null }, data: { deletedAt: new Date() } });
      return count ? ok(true) : fail('not_found');
    },

    async restore(userId: string, id: string): Promise<Result<true>> {
      const { count } = await db.design.updateMany({ where: { id, ownerId: userId, deletedAt: { not: null } }, data: { deletedAt: null } });
      return count ? ok(true) : fail('not_found');
    },

    /** Endgültig löschen: nur Designs, die bereits im Papierkorb liegen. */
    async removeForever(userId: string, id: string): Promise<Result<true>> {
      const { count } = await db.design.deleteMany({ where: { id, ownerId: userId, deletedAt: { not: null } } });
      return count ? ok(true) : fail('not_found');
    },

    async emptyTrash(userId: string): Promise<number> {
      return (await db.design.deleteMany({ where: { ownerId: userId, deletedAt: { not: null } } })).count;
    },

    async purgeExpired(userId: string): Promise<number> {
      const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000);
      return (await db.design.deleteMany({ where: { ownerId: userId, deletedAt: { lt: cutoff } } })).count;
    },
  };
}
