import { Router } from 'express';
import { z } from 'zod';
import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../lib/env';
import { dummyHash, hashPassword, verifyPassword } from '../lib/password';
import { SESSION_COOKIE, SESSION_DAYS, cookieOptions, readSession, signSession } from '../lib/session';
import { ah, rateLimit } from '../middleware/security';
import type { GoogleClient } from '../services/google';
import { publicUser, type UserRepo } from '../services/users';

const OAUTH_COOKIE = 'dh_oauth';
const DAY = 86_400_000;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Bitte eine gültige E-Mail eingeben').max(254),
  password: z.string().min(8, 'Mindestens 8 Zeichen').max(128),
});
const registerBody = credentials.extend({ name: z.string().trim().min(1).max(80).optional() });

export interface AuthDeps { env: Env; users: UserRepo; google: GoogleClient | null }

export function authRouter({ env, users, google }: AuthDeps) {
  const r = Router();
  const limiter = rateLimit(10, 15 * 60_000);

  const startSession = async (res: import('express').Response, userId: string) =>
    res.cookie(SESSION_COOKIE, await signSession(env, userId), cookieOptions(env, SESSION_DAYS * DAY));

  r.get('/providers', (_req, res) => res.json({ google: google !== null }));

  r.post('/register', limiter, ah(async (req, res) => {
    const body = registerBody.parse(req.body);
    if (await users.findByEmail(body.email)) return void res.status(409).json({ error: 'email_taken' });
    const user = await users.create({ email: body.email, name: body.name ?? null, passwordHash: await hashPassword(body.password) });
    await startSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  }));

  r.post('/login', limiter, ah(async (req, res) => {
    const body = credentials.parse(req.body);
    const user = await users.findByEmail(body.email);
    // Auch ohne Treffer rechnen, damit Antwortzeit nichts über existierende Konten verrät.
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash()));
    if (!user?.passwordHash || !ok) return void res.status(401).json({ error: 'invalid_credentials' });
    await startSession(res, user.id);
    res.json({ user: publicUser(user) });
  }));

  r.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(env, 0), maxAge: undefined });
    res.status(204).end();
  });

  r.get('/me', ah(async (req, res) => {
    const id = await readSession(env, req.cookies?.[SESSION_COOKIE]);
    const user = id ? await users.findById(id) : null;
    if (!user) return void res.status(401).json({ error: 'unauthenticated' });
    res.json({ user: publicUser(user) });
  }));

  // --- Google OAuth ---------------------------------------------------------------
  const key = new TextEncoder().encode(env.JWT_SECRET);
  const fail = (res: import('express').Response) => res.redirect(`${env.WEB_ORIGIN}/login?error=google`);

  r.get('/google', ah(async (_req, res) => {
    if (!google) return void res.status(501).json({ error: 'google_not_configured' });
    const { url, state, verifier } = google.start();
    // State + PKCE-Verifier signiert im kurzlebigen Cookie: kein Server-Speicher nötig.
    const token = await new SignJWT({ state, verifier }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(key);
    res.cookie(OAUTH_COOKIE, token, cookieOptions(env, 10 * 60_000)).redirect(url);
  }));

  r.get('/google/callback', ah(async (req, res) => {
    if (!google) return void res.status(501).json({ error: 'google_not_configured' });
    const { code, state } = req.query;
    res.clearCookie(OAUTH_COOKIE, { ...cookieOptions(env, 0), maxAge: undefined });
    try {
      if (typeof code !== 'string' || typeof state !== 'string') throw new Error('missing params');
      const { payload } = await jwtVerify(req.cookies?.[OAUTH_COOKIE] ?? '', key, { algorithms: ['HS256'] });
      if (payload.state !== state) throw new Error('state mismatch');
      const profile = await google.finish(code, String(payload.verifier));
      if (!profile.emailVerified) throw new Error('email not verified');

      // Konto finden: erst per Google-ID, dann per (verifizierter) E-Mail verknüpfen, sonst neu anlegen.
      let user = await users.findByGoogleId(profile.sub);
      if (!user) {
        const byEmail = await users.findByEmail(profile.email);
        user = byEmail
          ? await users.update(byEmail.id, { googleId: profile.sub, avatarUrl: byEmail.avatarUrl ?? profile.picture ?? null })
          : await users.create({ email: profile.email, googleId: profile.sub, name: profile.name ?? null, avatarUrl: profile.picture ?? null });
      }
      await startSession(res, user.id);
      res.redirect(`${env.WEB_ORIGIN}/app`);
    } catch (err) {
      console.warn('Google login failed:', err instanceof Error ? err.message : err);
      fail(res);
    }
  }));

  return r;
}
