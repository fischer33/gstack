import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { RemovalError, createRemoveBgClient, type BackgroundRemover } from '../src/services/backgroundRemoval';
import { loadEnv } from '../src/lib/env';
import { memoryRepo, testEnv } from './helpers';

// Die Route braucht eine Datenbank-Anbindung nur für Designs; für Bildwerkzeuge genügt ein Stub, daher ein minimales db-Objekt.
const fakeDb = {} as never;
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function setup(remover: BackgroundRemover | null) {
  const users = memoryRepo();
  const app = createApp({ env: testEnv(), users, google: null, db: fakeDb, remover });
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'img@example.com', password: 'correct-horse-1' });
  return { agent, app };
}

describe('POST /api/images/remove-background', () => {
  it('verlangt Anmeldung', async () => {
    const { app } = await setup(null);
    expect((await request(app).post('/api/images/remove-background').send({ image: PNG_1PX })).status).toBe(401);
  });

  it('ohne Schlüssel: 501 not_configured', async () => {
    const { agent } = await setup(null);
    const res = await agent.post('/api/images/remove-background').send({ image: PNG_1PX });
    expect(res.status).toBe(501);
    expect(res.body.error).toBe('not_configured');
  });

  it('reicht Bild und MIME an den Anbieter und liefert PNG als data-URL', async () => {
    let seen: { size: number; mime: string } | null = null;
    const { agent } = await setup({ remove: async (img, mime) => { seen = { size: img.length, mime }; return Buffer.from('PNGDATA'); } });
    const res = await agent.post('/api/images/remove-background').send({ image: PNG_1PX });
    expect(res.status).toBe(200);
    expect(res.body.image).toBe(`data:image/png;base64,${Buffer.from('PNGDATA').toString('base64')}`);
    expect(seen).toMatchObject({ mime: 'image/png' });
    expect(seen!.size).toBeGreaterThan(10);
  });

  it('lehnt Nicht-Bilder, fremde Typen und kaputtes Base64 ab, ohne den Anbieter zu fragen', async () => {
    let calls = 0;
    const { agent } = await setup({ remove: async () => { calls++; return Buffer.alloc(1); } });
    for (const image of ['hallo', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=', 'https://example.com/a.png', 'data:image/png;base64,%%%%']) {
      expect((await agent.post('/api/images/remove-background').send({ image })).status).toBe(400);
    }
    expect((await agent.post('/api/images/remove-background').send({})).status).toBe(400);
    expect(calls).toBe(0);
  });

  it('Anbieterfehler werden in passende Status übersetzt', async () => {
    for (const [code, status, error] of [['quota', 402, 'quota'], ['invalid_image', 422, 'invalid_image'], ['provider', 502, 'provider_error']] as const) {
      const { agent } = await setup({ remove: async () => { throw new RemovalError(code, 'x'); } });
      const res = await agent.post('/api/images/remove-background').send({ image: PNG_1PX });
      expect([res.status, res.body.error]).toEqual([status, error]);
    }
  });

  it('unerwartete Fehler werden zu 500, nicht zu einem Absturz', async () => {
    const { agent } = await setup({ remove: async () => { throw new Error('boom'); } });
    expect((await agent.post('/api/images/remove-background').send({ image: PNG_1PX })).status).toBe(500);
  });

  it('Rate-Limit: höchstens 10 Aufrufe pro Minute', async () => {
    const { agent } = await setup({ remove: async () => Buffer.from('x') });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await agent.post('/api/images/remove-background').send({ image: PNG_1PX })).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe('createRemoveBgClient', () => {
  const env = (key?: string) => loadEnv({ NODE_ENV: 'test', DATABASE_URL: 'x', JWT_SECRET: 'test-secret-test-secret-test-secret-123', BG_REMOVAL_API_KEY: key });

  it('ohne Schlüssel: kein Client', () => expect(createRemoveBgClient(env())).toBeNull());

  it('sendet den Schlüssel im Header, das Bild als Datei und gibt das Ergebnis zurück', async () => {
    let captured: { url: string; key: string | null; hasFile: boolean } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      captured = { url, key: new Headers(init.headers).get('x-api-key'), hasFile: (init.body as FormData).has('image_file') };
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await createRemoveBgClient(env('secret-key'), fake)!.remove(Buffer.from('img'), 'image/png');
    expect([...out]).toEqual([1, 2, 3]);
    expect(captured).toEqual({ url: 'https://api.remove.bg/v1.0/removebg', key: 'secret-key', hasFile: true });
  });

  it('übersetzt Statuscodes und Netzwerkfehler', async () => {
    const as = (status: number) => createRemoveBgClient(env('k'), (async () => new Response('x', { status })) as unknown as typeof fetch)!.remove(Buffer.from('i'), 'image/png');
    await expect(as(402)).rejects.toMatchObject({ code: 'quota' });
    await expect(as(400)).rejects.toMatchObject({ code: 'invalid_image' });
    await expect(as(403)).rejects.toMatchObject({ code: 'provider' });
    await expect(as(500)).rejects.toMatchObject({ code: 'provider' });
    const down = createRemoveBgClient(env('k'), (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch)!;
    await expect(down.remove(Buffer.from('i'), 'image/png')).rejects.toMatchObject({ code: 'provider' });
  });
});
