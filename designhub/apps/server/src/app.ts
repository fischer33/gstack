import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Env } from './lib/env';
import { originCheck } from './middleware/security';
import { authRouter } from './routes/auth';
import type { GoogleClient } from './services/google';
import type { UserRepo } from './services/users';

export interface AppDeps { env: Env; users: UserRepo; google: GoogleClient | null }

/** Fabrik statt Singleton: Tests übergeben In-Memory-Repo und Google-Stub. */
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: deps.env.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  // Designs sind große JSON-Dokumente; Uploads laufen später per Presigned-URL direkt zu S3.
  app.use(express.json({ limit: '10mb' }));
  app.use(originCheck(deps.env));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter(deps));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const fields = Object.fromEntries(err.issues.map((i) => [i.path.join('.'), i.message]));
      return void res.status(400).json({ error: 'validation', fields });
    }
    console.error(err);
    res.status(500).json({ error: 'internal' });
  };
  app.use(onError);
  return app;
}
