import type { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { TRASH_RETENTION_DAYS, blankDocument, pageToSvg, parseDesignDocument, svgToDataUrl, type DesignDocument, type DesignSummary, type Page, type SaveResult, type ShareLinkSummary, type ShareRole, type SharedDesign } from '@designhub/shared';

const SUMMARY = { id: true, title: true, width: true, height: true, thumbnail: true, folderId: true, updatedAt: true, deletedAt: true } as const;
type Row = Prisma.DesignGetPayload<{ select: typeof SUMMARY }>;

const toSummary = (r: Row): DesignSummary => ({
  ...r, updatedAt: r.updatedAt.toISOString(), deletedAt: r.deletedAt?.toISOString() ?? null,
});

/** Vorschau aus der ersten Seite. Der Editor ersetzt sie später durch ein echtes PNG. */
export function thumbnailOf(width: number, height: number, pages: Page[]): string | null {
  return pages[0] ? svgToDataUrl(pageToSvg({ width, height }, pages[0])) : null;
}

/** Vorschau vom Editor (PNG/JPEG/WebP als data:-URL, höchstens ~300 KB). Alles andere wird ignoriert, dann gilt die SVG-Vorschau. */
const THUMB = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_THUMBNAIL_CHARS = 400_000;
export const isValidThumbnail = (t: unknown): t is string => typeof t === 'string' && t.length <= MAX_THUMBNAIL_CHARS && THUMB.test(t);

export interface SaveInput { width: number; height: number; pages: unknown; version: number; thumbnail?: string }
export type SaveOutcome =
  | { ok: true; value: SaveResult }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'conflict'; version: number }
  | { ok: false; error: 'invalid_document'; issues: string[] };

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

    /**
     * Speichern mit Optimistic Locking: gelingt nur, wenn die Version des Clients der gespeicherten entspricht.
     * Zwei Tabs oder Geräte überschreiben sich so nie unbemerkt (409 mit der aktuellen Version).
     */
    async save(where: Prisma.DesignWhereInput, input: SaveInput): Promise<SaveOutcome> {
      const parsed = parseDesignDocument({ version: 1, width: input.width, height: input.height, pages: input.pages });
      if (!parsed.ok) return { ok: false, error: 'invalid_document', issues: parsed.issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`) };
      const { doc } = parsed;
      const thumbnail = isValidThumbnail(input.thumbnail) ? input.thumbnail : thumbnailOf(doc.width, doc.height, doc.pages);
      const { count } = await db.design.updateMany({
        where: { ...where, deletedAt: null, version: input.version },
        data: { width: doc.width, height: doc.height, pages: doc.pages as unknown as Prisma.InputJsonValue, thumbnail, version: { increment: 1 } },
      });
      if (!count) {
        const current = await db.design.findFirst({ where: { ...where, deletedAt: null }, select: { version: true } });
        return current ? { ok: false, error: 'conflict', version: current.version } : { ok: false, error: 'not_found' };
      }
      const row = await db.design.findFirstOrThrow({ where, select: { version: true, updatedAt: true } });
      return { ok: true, value: { version: row.version, updatedAt: row.updatedAt.toISOString() } };
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

type ResolvedLink = Prisma.ShareLinkGetPayload<{ include: { design: true } }>;

const toLink = (l: { id: string; token: string; role: ShareRole; expiresAt: Date | null; createdAt: Date }): ShareLinkSummary =>
  ({ id: l.id, token: l.token, role: l.role, expiresAt: l.expiresAt?.toISOString() ?? null, createdAt: l.createdAt.toISOString() });

/** Freigabe-Links: der Token ist das Zugangsrecht (256 Bit Zufall); Besitzer können ihn jederzeit widerrufen. */
export function shareService(db: PrismaClient) {
  const ownsDesign = async (userId: string, designId: string) => (await db.design.count({ where: { id: designId, ownerId: userId, deletedAt: null } })) > 0;
  return {
    async list(userId: string, designId: string): Promise<Result<ShareLinkSummary[]>> {
      if (!(await ownsDesign(userId, designId))) return fail('not_found');
      const rows = await db.shareLink.findMany({ where: { designId }, orderBy: { createdAt: 'desc' } });
      return ok(rows.map(toLink));
    },
    /** Pro Design und Rolle gibt es einen Link; ein zweites Anfordern liefert denselben (idempotent). */
    async create(userId: string, designId: string, role: ShareRole): Promise<Result<ShareLinkSummary>> {
      if (!(await ownsDesign(userId, designId))) return fail('not_found');
      const existing = await db.shareLink.findFirst({ where: { designId, role, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
      if (existing) return ok(toLink(existing));
      return ok(toLink(await db.shareLink.create({ data: { designId, role, token: randomBytes(32).toString('base64url') } })));
    },
    async revoke(userId: string, designId: string, linkId: string): Promise<Result<true>> {
      const { count } = await db.shareLink.deleteMany({ where: { id: linkId, designId, design: { ownerId: userId } } });
      return count ? ok(true) : fail('not_found');
    },
    /** Link auflösen. Abgelaufene Links, Links auf gelöschte Designs und unbekannte Tokens sehen alle gleich aus (null). */
    async resolve(token: string): Promise<ResolvedLink | null> {
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
      const link = await db.shareLink.findUnique({ where: { token }, include: { design: true } });
      if (!link || link.design.deletedAt || (link.expiresAt && link.expiresAt < new Date())) return null;
      return link;
    },
    toShared(link: ResolvedLink): SharedDesign {
      const d = link.design;
      return { title: d.title, width: d.width, height: d.height, pages: d.pages as unknown as Page[], version: d.version, role: link.role };
    },
  };
}
