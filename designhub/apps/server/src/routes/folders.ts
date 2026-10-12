import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import type { FolderSummary } from '@designhub/shared';
import { userIdOf } from '../middleware/requireAuth';
import { ah } from '../middleware/security';

const body = z.object({ name: z.string().trim().min(1, 'Name darf nicht leer sein').max(60) });

/** Flache Ordnerstruktur (das Schema kennt `parentId`, die UI nutzt es noch nicht). */
export function foldersRouter(db: PrismaClient) {
  const r = Router();
  const taken = async (ownerId: string, name: string, exceptId?: string) =>
    (await db.folder.count({ where: { ownerId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) } })) > 0;

  r.get('/', ah(async (_req, res) => {
    const rows = await db.folder.findMany({
      where: { ownerId: userIdOf(res) }, orderBy: { name: 'asc' },
      include: { _count: { select: { designs: { where: { deletedAt: null } } } } },
    });
    const folders: FolderSummary[] = rows.map((f) => ({ id: f.id, name: f.name, designCount: f._count.designs }));
    res.json({ folders });
  }));

  r.post('/', ah(async (req, res) => {
    const { name } = body.parse(req.body);
    const ownerId = userIdOf(res);
    if (await taken(ownerId, name)) return void res.status(409).json({ error: 'folder_exists' });
    const f = await db.folder.create({ data: { name, ownerId } });
    res.status(201).json({ id: f.id, name: f.name, designCount: 0 } satisfies FolderSummary);
  }));

  r.patch('/:id', ah(async (req, res) => {
    const { name } = body.parse(req.body);
    const ownerId = userIdOf(res);
    if (await taken(ownerId, name, req.params.id)) return void res.status(409).json({ error: 'folder_exists' });
    const { count } = await db.folder.updateMany({ where: { id: req.params.id, ownerId }, data: { name } });
    if (!count) return void res.status(404).json({ error: 'not_found' });
    res.json({ id: req.params.id, name });
  }));

  // Designs im Ordner bleiben erhalten und landen wieder im Hauptbereich (onDelete: SetNull).
  r.delete('/:id', ah(async (req, res) => {
    const { count } = await db.folder.deleteMany({ where: { id: req.params.id, ownerId: userIdOf(res) } });
    count ? res.status(204).end() : res.status(404).json({ error: 'not_found' });
  }));
  return r;
}
