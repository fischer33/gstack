import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { fakeGoogle, makeApp, testEnv } from './helpers';

const creds = { email: 'Ada@Example.com', password: 'correct-horse' };
const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('dh_session='));

describe('E-Mail/Passwort', () => {
  it('registriert, setzt httpOnly-Cookie und kennt den User über /me', async () => {
    const { app, users } = makeApp();
    const res = await request(app).post('/api/auth/register').send({ ...creds, name: 'Ada' });
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(expect.objectContaining({ email: 'ada@example.com', name: 'Ada' }));
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = cookieOf(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(users.all[0].passwordHash).not.toContain('correct-horse');
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ada@example.com');
  });

  it('lehnt doppelte E-Mail (409) und schwache Eingaben (400) ab', async () => {
    const { app } = makeApp();
    await request(app).post('/api/auth/register').send(creds);
    expect((await request(app).post('/api/auth/register').send({ ...creds, email: 'ada@example.com' })).status).toBe(409);
    const bad = await request(app).post('/api/auth/register').send({ email: 'kaputt', password: 'kurz' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('login: richtige Daten ok, falsches Passwort und unbekannte E-Mail gleich (401)', async () => {
    const { app } = makeApp();
    await request(app).post('/api/auth/register').send(creds);
    expect((await request(app).post('/api/auth/login').send(creds)).status).toBe(200);
    const wrong = await request(app).post('/api/auth/login').send({ ...creds, password: 'wrong-wrong' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever-1' });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('Google-only-Konto kann sich nicht per Passwort anmelden', async () => {
    const { app, users } = makeApp();
    await users.create({ email: 'g@example.com', googleId: 'g1' });
    const res = await request(app).post('/api/auth/login').send({ email: 'g@example.com', password: 'anything-123' });
    expect(res.status).toBe(401);
  });

  it('logout löscht das Cookie; /me ohne oder mit manipuliertem Token ist 401', async () => {
    const { app } = makeApp();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', 'dh_session=abc.def.ghi')).status).toBe(401);
    const forged = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u1')
      .setExpirationTime('1d').sign(new TextEncoder().encode('another-secret-another-secret-123456'));
    expect((await request(app).get('/api/auth/me').set('Cookie', `dh_session=${forged}`)).status).toBe(401);
    const out = await request(app).post('/api/auth/logout');
    expect(out.status).toBe(204);
    expect(cookieOf(out)).toMatch(/dh_session=;/);
  });

  it('blockt schreibende Requests von fremden Origins (CSRF)', async () => {
    const { app } = makeApp();
    const res = await request(app).post('/api/auth/login').set('Origin', 'https://evil.example').send(creds);
    expect(res.status).toBe(403);
  });

  it('Rate-Limit: ab dem 11. Versuch 429', async () => {
    const { app } = makeApp();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await request(app).post('/api/auth/login').send({ email: 'a@b.de', password: 'wrong-wrong' })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe('Google OAuth', () => {
  const profile = { sub: 'g-123', email: 'ada@example.com', emailVerified: true, name: 'Ada G', picture: 'https://img/x.png' };

  /** Startet den Flow und liefert Cookie + state, wie sie der Browser beim Callback mitbringt. */
  async function begin(app: ReturnType<typeof makeApp>['app']) {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(302);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('dh_oauth='))!.split(';')[0];
    return { cookie, state: 'st4te' };
  }

  it('/providers zeigt Konfiguration; ohne Konfiguration 501', async () => {
    expect((await request(makeApp().app).get('/api/auth/providers')).body).toEqual({ google: false });
    expect((await request(makeApp().app).get('/api/auth/google')).status).toBe(501);
    expect((await request(makeApp(fakeGoogle(profile)).app).get('/api/auth/providers')).body).toEqual({ google: true });
  });

  it('legt neues Konto an, setzt Session und leitet in die App', async () => {
    const { app, users } = makeApp(fakeGoogle(profile));
    const { cookie, state } = await begin(app);
    const res = await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${testEnv().WEB_ORIGIN}/app`);
    expect(cookieOf(res)).toBeTruthy();
    expect(users.all[0]).toEqual(expect.objectContaining({ googleId: 'g-123', email: 'ada@example.com', passwordHash: null }));
  });

  it('verknüpft ein bestehendes Passwort-Konto mit gleicher verifizierter E-Mail', async () => {
    const { app, users } = makeApp(fakeGoogle(profile));
    await request(app).post('/api/auth/register').send(creds);
    const { cookie, state } = await begin(app);
    await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie);
    expect(users.all).toHaveLength(1);
    expect(users.all[0].googleId).toBe('g-123');
    expect(users.all[0].passwordHash).toBeTruthy();
  });

  it('lehnt falschen state, fehlendes Cookie und unverifizierte E-Mail ab', async () => {
    const { app, users } = makeApp(fakeGoogle({ ...profile, emailVerified: false }));
    const { cookie, state } = await begin(app);
    const loc = (r: request.Response) => r.headers.location;
    expect(loc(await request(app).get('/api/auth/google/callback?code=abc&state=evil').set('Cookie', cookie))).toContain('error=google');
    expect(loc(await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`))).toContain('error=google');
    expect(loc(await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie))).toContain('error=google');
    expect(users.all).toHaveLength(0);
  });

  it('Fehler beim Token-Tausch führen zurück zum Login statt zu 500', async () => {
    const { app } = makeApp(fakeGoogle(new Error('boom')));
    const { cookie, state } = await begin(app);
    const res = await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie);
    expect(res.headers.location).toContain('/login?error=google');
  });
});
