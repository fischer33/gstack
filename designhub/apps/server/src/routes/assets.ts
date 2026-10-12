import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { userIdOf } from '../middleware/requireAuth';
import { ah, rateLimit } from '../middleware/security';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, type ObjectStore } from '../services/storage';

const presignBody = z.object({
  name: z.string().trim().max(200).optional(),
  mime: z.enum(Object.keys(IMAGE_TYPES) as [keyof typeof IMAGE_TYPES, ...(keyof typeof IMAGE_TYPES)[]]),
  size: z.number().int().min(1).max(MAX_UPLOAD_BYTES, 'Das Bild ist größer als 10 MB'),
});

/** Bild-Uploads: der Browser lädt direkt in den Objektspeicher, der Server vergibt nur Schlüssel und URL. */
export function assetsRouter(db: PrismaClient, store: ObjectStore | null) {
  const r = Router();
  const limiter = rateLimit(60, 60_000);

  r.get('/', ah(async (_req, res) => {
    const rows = await db.asset.findMany({ where: { ownerId: userIdOf(res), type: 'IMAGE' }, orderBy: { createdAt: 'desc' }, take: 60 });
    res.json({ assets: rows.map((a) => ({ id: a.id, url: a.url, mime: a.mime, size: a.size, createdAt: a.createdAt.toISOString() })) });
  }));

  r.post('/presign', limiter, ah(async (req, res) => {
    if (!store) return void res.status(501).json({ error: 'not_configured' });
    const body = presignBody.parse(req.body);
    const userId = userIdOf(res);
    // Schlüssel enthalten nur UUIDs: der Dateiname des Nutzers fließt nie in den Pfad ein.
    const key = `u/${userId}/${randomUUID()}.${IMAGE_TYPES[body.mime]}`;
    const signed = await store.presignUpload(key, body.mime, body.size);
    const asset = await db.asset.create({ data: { url: signed.url, key, type: 'IMAGE', mime: body.mime, size: body.size, ownerId: userId } });
    res.status(201).json({ id: asset.id, uploadUrl: signed.uploadUrl, headers: signed.headers, url: signed.url });
  }));

  r.delete('/:id', ah(async (req, res) => {
    const { count } = await db.asset.deleteMany({ where: { id: req.params.id, ownerId: userIdOf(res) } });
    count ? res.status(204).end() : res.status(404).json({ error: 'not_found' });
  }));
  return r;
}
