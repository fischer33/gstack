import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ah, rateLimit } from '../middleware/security';
import { designService, shareService } from '../services/designs';
import { sendSave } from './designs';

const saveBody = z.object({
  pages: z.array(z.unknown()).min(1).max(100),
  version: z.number().int().min(1),
  thumbnail: z.string().max(400_000).optional(),
});

/** Öffentliche Freigabe-Routen: ohne Anmeldung, der Token ist das Zugangsrecht. Ansehen immer, Speichern nur mit Rolle EDIT. */
export function shareRouter(db: PrismaClient) {
  const shares = shareService(db);
  const designs = designService(db);
  const r = Router();
  r.use(rateLimit(300, 60_000)); // Token raten lohnt nicht: 256 Bit; das Limit bremst trotzdem Scanner

  r.get('/:token', ah(async (req, res) => {
    const link = await shares.resolve(req.params.token);
    if (!link) return void res.status(404).json({ error: 'not_found' });
    res.json(shares.toShared(link));
  }));

  r.put('/:token', ah(async (req, res) => {
    const link = await shares.resolve(req.params.token);
    if (!link) return void res.status(404).json({ error: 'not_found' });
    if (link.role !== 'EDIT') return void res.status(403).json({ error: 'read_only' });
    const body = saveBody.parse(req.body);
    // Maße bleiben die des Designs: Link-Bearbeiter dürfen Inhalte ändern, nicht das Format
    sendSave(res, await designs.save({ id: link.designId }, { ...body, width: link.design.width, height: link.design.height }));
  }));
  return r;
}
