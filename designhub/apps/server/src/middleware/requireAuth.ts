import type { RequestHandler } from 'express';
import type { Env } from '../lib/env';
import { SESSION_COOKIE, readSession } from '../lib/session';
import type { UserRepo } from '../services/users';

/** Setzt `res.locals.userId` oder antwortet 401. Der User wird bei jedem Request neu geladen (gelöschte Konten sperren sofort). */
export const requireAuth = (env: Env, users: UserRepo): RequestHandler => (req, res, next) => {
  readSession(env, req.cookies?.[SESSION_COOKIE])
    .then((id) => (id ? users.findById(id) : null))
    .then((user) => {
      if (!user) return void res.status(401).json({ error: 'unauthenticated' });
      res.locals.userId = user.id;
      next();
    })
    .catch(next);
};

export const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.userId as string;
