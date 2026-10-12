// Speichern, Versionsschutz, Freigabe-Links und Uploads gegen echtes PostgreSQL (übersprungen, wenn keine DB erreichbar ist).
import '../src/env';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { ObjectStore } from '../src/services/storage';
import { prismaUserRepo } from '../src/services/users';
import { testEnv } from './helpers';

const db = new PrismaClient();
const dbUp = process.env.DATABASE_URL ? await db.$queryRaw`select 1`.then(() => true, () => false) : false;
const RUN = `s${Date.now()}`;

const store: ObjectStore = {
  presignUpload: async (key, mime, size) => ({ uploadUrl: `https://s3.test/put/${key}?size=${size}`, headers: { 'Content-Type': mime }, url: `https://cdn.test/${key}` }),
};

const rect = (id: string) => ({ id, type: 'shape', kind: 'rect', x: 10, y: 10, width: 100, height: 80, rotation: 0, opacity: 1, locked: false, visible: true, fill: '#ff0000', stroke: 'transparent', strokeWidth: 0 });
const page = (...ids: string[]) => ({ id: 'p1', background: { type: 'solid', color: '#ffffff' }, elements: ids.map(rect) });
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe.skipIf(!dbUp)('Speichern, Teilen, Uploads (mit Datenbank)', () => {
  const app = createApp({ env: testEnv(), db, users: prismaUserRepo(db), google: null, store });
  const a = request.agent(app);
  const b = request.agent(app);
  const emails = [`a-${RUN}@example.com`, `b-${RUN}@example.com`];
  let id: string;

  beforeAll(async () => {
    for (const [agent, email] of [[a, emails[0]], [b, emails[1]]] as const) {
      expect((await agent.post('/api/auth/register').send({ email, password: 'correct-horse-1' })).status).toBe(201);
    }
    id = (await a.post('/api/designs').send({ width: 800, height: 600 })).body.id;
  });
  afterAll(async () => { await db.user.deleteMany({ where: { email: { in: emails } } }); await db.$disconnect(); });

  const put = (agent: typeof a, body: object, did = id) => agent.put(`/api/designs/${did}`).send(body);
  const body = (version: number, extra: object = {}) => ({ width: 800, height: 600, pages: [page('r1')], version, ...extra });

  describe('PUT /api/designs/:id', () => {
    it('speichert und zählt die Version hoch', async () => {
      expect((await a.get(`/api/designs/${id}`)).body.version).toBe(1);
      const res = await put(a, body(1));
      expect(res.status).toBe(200);
      expect(res.body.version).toBe(2);
      const got = (await a.get(`/api/designs/${id}`)).body;
      expect(got.version).toBe(2);
      expect(got.pages[0].elements).toHaveLength(1);
    });

    it('lehnt eine veraltete Version mit 409 und aktueller Version ab, ohne zu überschreiben', async () => {
      const res = await put(a, body(1, { pages: [page('x1', 'x2')] }));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'conflict', version: 2 });
      expect((await a.get(`/api/designs/${id}`)).body.pages[0].elements).toHaveLength(1);
      expect((await put(a, body(res.body.version, { pages: [page('x1', 'x2')] }))).status).toBe(200); // bewusstes Überschreiben mit aktueller Version
    });

    it('zwei gleichzeitige Speichervorgänge: genau einer gewinnt', async () => {
      const v = (await a.get(`/api/designs/${id}`)).body.version;
      const [r1, r2] = await Promise.all([put(a, body(v)), put(a, body(v))]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    });

    it('prüft das Dokument (Schema) und lässt nichts Gefährliches durch', async () => {
      const v = (await a.get(`/api/designs/${id}`)).body.version;
      const evil = { ...rect('e'), fill: 'red;}</style><script>' };
      for (const pages of [[{ ...page('r'), elements: [evil] }], [{ id: 'p', background: { type: 'solid', color: 'url(x)' }, elements: [] }], [{ id: 'p', background: { type: 'solid', color: '#fff' }, elements: [{ ...rect('i'), type: 'image', src: 'javascript:alert(1)', crop: null }] }]]) {
        const res = await put(a, body(v, { pages }));
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('invalid_document');
      }
      expect((await put(a, { width: 800, height: 600, version: v })).status).toBe(400); // pages fehlt
      expect((await put(a, body(v, { width: 20000 }))).status).toBe(400);
    });

    it('übernimmt eine PNG-Vorschau, ignoriert unpassende', async () => {
      let v = (await a.get(`/api/designs/${id}`)).body.version;
      await put(a, body(v, { thumbnail: PNG }));
      expect((await a.get(`/api/designs/${id}`)).body.thumbnail).toBe(PNG);
      v += 1;
      await put(a, body(v, { thumbnail: 'data:text/html;base64,PHNjcmlwdD4=' }));
      expect((await a.get(`/api/designs/${id}`)).body.thumbnail).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('fremde und gelöschte Designs verhalten sich wie nicht vorhanden', async () => {
      expect((await put(b, body(1))).status).toBe(404);
      const gone = (await a.post('/api/designs').send({ width: 800, height: 600 })).body.id;
      await a.post(`/api/designs/${gone}/trash`);
      expect((await put(a, body(1), gone)).status).toBe(404);
      expect((await request(app).put(`/api/designs/${id}`).send(body(1))).status).toBe(401);
    });
  });

  describe('Freigabe-Links', () => {
    let view: { id: string; token: string }, edit: { id: string; token: string };
    it('Besitzer erzeugt Links je Rolle, idempotent', async () => {
      view = (await a.post(`/api/designs/${id}/shares`).send({ role: 'VIEW' })).body;
      edit = (await a.post(`/api/designs/${id}/shares`).send({ role: 'EDIT' })).body;
      expect(view.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
      expect(view.token).not.toBe(edit.token);
      expect((await a.post(`/api/designs/${id}/shares`).send({ role: 'VIEW' })).body.token).toBe(view.token);
      expect((await a.get(`/api/designs/${id}/shares`)).body.links).toHaveLength(2);
      expect((await a.post(`/api/designs/${id}/shares`).send({ role: 'ADMIN' })).status).toBe(400);
    });
    it('fremde dürfen keine Links erzeugen oder sehen', async () => {
      expect((await b.post(`/api/designs/${id}/shares`).send({ role: 'VIEW' })).status).toBe(404);
      expect((await b.get(`/api/designs/${id}/shares`)).status).toBe(404);
      expect((await b.delete(`/api/designs/${id}/shares/${view.id}`)).status).toBe(404);
    });
    it('Ansehen geht ohne Anmeldung und verrät keine Besitzerdaten', async () => {
      const res = await request(app).get(`/api/share/${view.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ width: 800, height: 600, role: 'VIEW' });
      expect(JSON.stringify(res.body)).not.toMatch(/ownerId|@example\.com/);
    });
    it('VIEW darf nicht speichern, EDIT schon (Format bleibt, Version gilt)', async () => {
      const cur = (await request(app).get(`/api/share/${edit.token}`)).body;
      expect((await request(app).put(`/api/share/${view.token}`).send({ pages: [page('v')], version: cur.version })).status).toBe(403);
      const ok = await request(app).put(`/api/share/${edit.token}`).send({ pages: [page('e1', 'e2')], version: cur.version, width: 1, height: 1 });
      expect(ok.status).toBe(200);
      const got = (await a.get(`/api/designs/${id}`)).body;
      expect(got.pages[0].elements).toHaveLength(2);
      expect([got.width, got.height]).toEqual([800, 600]);
      expect((await request(app).put(`/api/share/${edit.token}`).send({ pages: [page('e1')], version: cur.version })).status).toBe(409);
    });
    it('ungültige und unbekannte Tokens → 404', async () => {
      expect((await request(app).get('/api/share/abc')).status).toBe(404);
      expect((await request(app).get(`/api/share/${'x'.repeat(43)}`)).status).toBe(404);
    });
    it('Widerruf und Papierkorb sperren den Link sofort', async () => {
      expect((await a.delete(`/api/designs/${id}/shares/${view.id}`)).status).toBe(204);
      expect((await request(app).get(`/api/share/${view.token}`)).status).toBe(404);
      await a.post(`/api/designs/${id}/trash`);
      expect((await request(app).get(`/api/share/${edit.token}`)).status).toBe(404);
      await a.post(`/api/designs/${id}/restore`);
      expect((await request(app).get(`/api/share/${edit.token}`)).status).toBe(200);
    });
    it('abgelaufene Links sind ungültig', async () => {
      await db.shareLink.update({ where: { id: edit.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await request(app).get(`/api/share/${edit.token}`)).status).toBe(404);
    });
  });

  describe('Uploads', () => {
    it('vergibt eine signierte URL mit Schlüssel aus UUIDs', async () => {
      const res = await a.post('/api/assets/presign').send({ name: '../../evil.png', mime: 'image/png', size: 1234 });
      expect(res.status).toBe(201);
      expect(res.body.url).toMatch(/^https:\/\/cdn\.test\/u\/[^/]+\/[0-9a-f-]{36}\.png$/);
      expect(res.body.uploadUrl).toContain('size=1234');
      const list = (await a.get('/api/assets')).body.assets;
      expect(list.map((x: { url: string }) => x.url)).toContain(res.body.url);
      expect((await b.get('/api/assets')).body.assets).toHaveLength(0);
      expect((await b.delete(`/api/assets/${res.body.id}`)).status).toBe(404);
      expect((await a.delete(`/api/assets/${res.body.id}`)).status).toBe(204);
    });
    it('lehnt SVG/HTML, zu große und leere Dateien ab', async () => {
      for (const b2 of [{ mime: 'image/svg+xml', size: 100 }, { mime: 'text/html', size: 100 }, { mime: 'image/png', size: 11 * 1024 * 1024 }, { mime: 'image/png', size: 0 }]) {
        expect((await a.post('/api/assets/presign').send(b2)).status).toBe(400);
      }
    });
    it('ohne Objektspeicher: 501', async () => {
      const bare = request.agent(createApp({ env: testEnv(), db, users: prismaUserRepo(db), google: null }));
      await bare.post('/api/auth/login').send({ email: emails[0], password: 'correct-horse-1' });
      expect((await bare.post('/api/assets/presign').send({ mime: 'image/png', size: 10 })).status).toBe(501);
    });
  });
});
