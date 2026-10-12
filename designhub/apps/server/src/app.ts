import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Env } from './lib/env';
import { originCheck } from './middleware/security';
import type { PrismaClient } from '@prisma/client';
import { requireAuth } from './middleware/requireAuth';
import { authRouter } from './routes/auth';
import { assetsRouter } from './routes/assets';
import { designsRouter } from './routes/designs';
import { foldersRouter } from './routes/folders';
import { imagesRouter } from './routes/images';
import { shareRouter } from './routes/share';
import { templatesRouter } from './routes/templates';
import type { BackgroundRemover } from './services/backgroundRemoval';
import type { GoogleClient } from './services/google';
import type { ObjectStore } from './services/storage';
import type { UserRepo } from './services/users';

/** `db` ist optional, damit die Auth-Tests ohne Datenbank laufen; ohne `db` gibt es keine Daten-Routen. */
export interface AppDeps { env: Env; users: UserRepo; google: GoogleClient | null; db?: PrismaClient; remover?: BackgroundRemover | null; store?: ObjectStore | null }

/** Fabrik statt Singleton: Tests übergeben In-Memory-Repo und Google-Stub. */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: deps.env.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  // Designs sind große JSON-Dokumente; Uploads laufen später per Presigned-URL direkt zu S3.
  // 15 MB: ein 10-MB-Bild als Base64 ist ~13,4 MB groß (Hintergrund entfernen).
  app.use(express.json({ limit: '15mb' }));
  app.use(originCheck(deps.env));

  // `db` zeigt, ob die Datenbank antwortet. Das Frontend nutzt es, um bei Server-Fehlern die Ursache zu nennen.
  app.get('/api/health', async (_req, res) => {
    if (!deps.db) return void res.json({ ok: true });
    const db = await deps.db.$queryRaw`select 1`.then(() => true, () => false);
    res.json({ ok: db, db });
  });
  app.use('/api/auth', authRouter(deps));

  if (deps.db) {
    const guard = requireAuth(deps.env, deps.users);
    app.use('/api/designs', guard, designsRouter(deps.db));
    app.use('/api/folders', guard, foldersRouter(deps.db));
    app.use('/api/templates', guard, templatesRouter(deps.db));
    app.use('/api/assets', guard, assetsRouter(deps.db, deps.store ?? null));
    app.use('/api/share', shareRouter(deps.db));
    app.use('/api/images', guard, imagesRouter(deps.remover ?? null));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const fields = Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message]));
      return void res.status(400).json({ error: 'validation', fields });
    }
    if ((err as { type?: string }).type === 'entity.too.large') return void res.status(413).json({ error: 'too_large' });
    console.error(err);
    res.status(500).json({ error: 'internal' });
  };
  app.use(onError);
  return app;
}
