import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Env } from '../lib/env';

/** CSRF-Schutz für Cookie-Auth: schreibende Requests dürfen nur von unserer Web-Origin kommen. */
export const originCheck = (env: Env): RequestHandler => (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.WEB_ORIGIN) return void res.status(403).json({ error: 'forbidden_origin' });
  next();
};

/** Einfaches Fenster-Limit pro IP (im Speicher; bei mehreren Instanzen durch Redis ersetzen). */
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const hits = new Map<string, number[]>();
  const handler = ((req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const recent = (hits.get(req.ip ?? '') ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return void res.status(429).json({ error: 'too_many_requests' });
    recent.push(now);
    hits.set(req.ip ?? '', recent);
    next();
  }) as RequestHandler;
  return handler;
}

/** Async-Handler: Fehler landen im zentralen Error-Handler (Express 4 fängt Promises nicht selbst). */
export const ah = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};
