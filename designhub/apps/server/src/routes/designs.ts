import { Router } from 'express';
import { z } from 'zod';
import { MAX_SIZE, MIN_SIZE } from '@designhub/shared';
import { ah } from '../middleware/security';
import { userIdOf } from '../middleware/requireAuth';
import type { Result } from '../services/designs';
import { designService } from '../services/designs';
import type { PrismaClient } from '@prisma/client';

const size = z.number().int().min(MIN_SIZE).max(MAX_SIZE);
const title = z.string().trim().min(1, 'Titel darf nicht leer sein').max(120);

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  folderId: z.string().max(40).optional(),
  trash: z.enum(['1', 'true']).optional().transform((v) => !!v),
  sort: z.enum(['updated', 'title']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Entweder aus Vorlage (Maße kommen von dort) oder leer mit Maßen.
const createBody = z.object({ title: title.optional(), folderId: z.string().max(40).nullable().optional(), templateId: z.string().max(60).optional(), width: size.optional(), height: size.optional() })
  .refine((b) => b.templateId || (b.width && b.height), { message: 'Entweder templateId oder width und height angeben', path: ['width'] });

const patchBody = z.object({ title: title.optional(), folderId: z.string().max(40).nullable().optional() })
  .refine((b) => b.title !== undefined || b.folderId !== undefined, { message: 'Nichts zu ändern' });

const STATUS = { not_found: 404, invalid_folder: 400, invalid_template: 400 } as const;

export function designsRouter(db: PrismaClient) {
  const svc = designService(db);
  const r = Router();
  /** Result → HTTP: Erfolg als JSON, Fehler mit passendem Status. */
  const send = <T>(res: import('express').Response, result: Result<T>, okStatus = 200) =>
    result.ok ? res.status(okStatus).json(result.value) : res.status(STATUS[result.error]).json({ error: result.error });

  r.get('/', ah(async (req, res) => { res.json({ designs: await svc.list(userIdOf(res), listQuery.parse(req.query)) }); }));
  r.post('/', ah(async (req, res) => { send(res, await svc.create(userIdOf(res), createBody.parse(req.body)), 201); }));

  // Vor `/:id`, sonst würde "trash" als ID gelesen.
  r.delete('/trash', ah(async (_req, res) => { res.json({ deleted: await svc.emptyTrash(userIdOf(res)) }); }));

  r.get('/:id', ah(async (req, res) => { send(res, await svc.get(userIdOf(res), req.params.id)); }));
  r.patch('/:id', ah(async (req, res) => { send(res, await svc.update(userIdOf(res), req.params.id, patchBody.parse(req.body))); }));
  r.post('/:id/duplicate', ah(async (req, res) => { send(res, await svc.duplicate(userIdOf(res), req.params.id), 201); }));
  r.post('/:id/trash', ah(async (req, res) => { const x = await svc.trash(userIdOf(res), req.params.id); x.ok ? res.status(204).end() : send(res, x); }));
  r.post('/:id/restore', ah(async (req, res) => { const x = await svc.restore(userIdOf(res), req.params.id); x.ok ? res.status(204).end() : send(res, x); }));
  r.delete('/:id', ah(async (req, res) => { const x = await svc.removeForever(userIdOf(res), req.params.id); x.ok ? res.status(204).end() : send(res, x); }));
  return r;
}
