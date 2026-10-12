import { SignJWT, jwtVerify } from 'jose';
import type { CookieOptions } from 'express';
import type { Env } from './env';

export const SESSION_COOKIE = 'dh_session';
export const SESSION_DAYS = 7;

const key = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

export async function signSession(env: Env, userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
    .setIssuedAt().setExpirationTime(`${SESSION_DAYS}d`).sign(key(env));
}

/** Liefert die User-ID oder `null` bei fehlendem/abgelaufenem/manipuliertem Token. */
export async function readSession(env: Env, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(env), { algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export const cookieOptions = (env: Env, maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax', // Lax erlaubt den Redirect zurück vom Google-Login
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeMs,
});
