import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../lib/env';

export interface GoogleProfile { sub: string; email: string; emailVerified: boolean; name?: string; picture?: string }

/** Austauschbar, damit Tests ohne Netzwerk laufen. */
export interface GoogleClient {
  /** Neuer Login-Versuch: URL für den Redirect + Werte, die bis zum Callback geprüft werden müssen. */
  start(): { url: string; state: string; verifier: string };
  /** Code gegen Profil tauschen. Wirft bei jedem Fehler. */
  finish(code: string, verifier: string): Promise<GoogleProfile>;
}

const b64url = (b: Buffer) => b.toString('base64url');

/** Authorization-Code-Flow mit PKCE und State; Profil über den OpenID-Userinfo-Endpoint. */
export function createGoogleClient(env: Env): GoogleClient | null {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret, GOOGLE_REDIRECT_URI: redirect } = env;
  if (!id || !secret) return null;
  return {
    start() {
      const state = b64url(randomBytes(16));
      const verifier = b64url(randomBytes(32));
      const params = new URLSearchParams({
        client_id: id, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile',
        state, code_challenge: b64url(createHash('sha256').update(verifier).digest()),
        code_challenge_method: 'S256', prompt: 'select_account',
      });
      return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state, verifier };
    },
    async finish(code, verifier) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code, client_id: id, client_secret: secret, redirect_uri: redirect,
          grant_type: 'authorization_code', code_verifier: verifier,
        }),
      });
      if (!tokenRes.ok) throw new Error(`Google token exchange failed: ${tokenRes.status}`);
      const { access_token } = (await tokenRes.json()) as { access_token: string };
      const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!infoRes.ok) throw new Error(`Google userinfo failed: ${infoRes.status}`);
      const i = (await infoRes.json()) as { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };
      return { sub: i.sub, email: i.email.toLowerCase(), emailVerified: i.email_verified, name: i.name, picture: i.picture };
    },
  };
}
