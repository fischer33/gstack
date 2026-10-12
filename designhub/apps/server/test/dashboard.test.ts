// Integrationstests gegen echtes PostgreSQL (DATABASE_URL aus designhub/.env). Ohne erreichbare DB werden sie übersprungen.
import '../src/env';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prismaUserRepo } from '../src/services/users';
import { testEnv } from './helpers';

const db = new PrismaClient();
const dbUp = process.env.DATABASE_URL ? await db.$queryRaw`select 1`.then(() => true, () => false) : false;
const RUN = `t${Date.now()}`;
const CATEGORY = `Testkategorie-${RUN}`;

describe.skipIf(!dbUp)('Dashboard-API (mit Datenbank)', () => {
  const app = createApp({ env: testEnv(), db, users: prismaUserRepo(db), google: null });
  const a = request.agent(app);
  const b = request.agent(app);
  const emails = [`a-${RUN}@example.com`, `b-${RUN}@example.com`];

  beforeAll(async () => {
    for (const [agent, email] of [[a, emails[0]], [b, emails[1]]] as const) {
      expect((await agent.post('/api/auth/register').send({ email, password: 'correct-horse-1' })).status).toBe(201);
    }
    const doc = (title: string) => ({ version: 1, width: 800, height: 600, pages: [{ id: 'p1', background: { type: 'solid', color: '#123456' }, elements: [] }], title });
    for (const [i, t] of [`tpl-${RUN}-1`, `tpl-${RUN}-2`].entries()) {
      await db.template.create({ data: { id: t, title: `Vorlage ${i + 1}`, category: CATEGORY, tags: ['alpha'], width: 800, height: 600, data: doc('x') } });
    }
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: emails } } }); // Cascade räumt Designs/Ordner auf
    await db.template.deleteMany({ where: { category: CATEGORY } });
    await db.$disconnect();
  });

  const create = async (agent: typeof a, body: object = { width: 1080, height: 1080 }) => (await agent.post('/api/designs').send(body)).body;
  const titles = async (agent: typeof a, query = '') => (await agent.get(`/api/designs${query}`)).body.designs.map((d: { title: string }) => d.title);

  it('Health meldet die Datenbank', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true, db: true });
  });

  it('verlangt Anmeldung', async () => {
    expect((await request(app).get('/api/designs')).status).toBe(401);
    expect((await request(app).get('/api/templates')).status).toBe(401);
    expect((await request(app).get('/api/folders')).status).toBe(401);
  });

  describe('Designs anlegen', () => {
    it('leeres Design mit Vorschau', async () => {
      const res = await a.post('/api/designs').send({ width: 1080, height: 1920, title: '  Meine Story  ' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Meine Story', width: 1080, height: 1920, folderId: null, deletedAt: null });
      expect(res.body.thumbnail).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('lehnt fehlende, zu kleine und zu große Maße ab', async () => {
      for (const body of [{}, { width: 1080 }, { width: 10, height: 10 }, { width: 9000, height: 100 }, { width: 100.5, height: 100 }]) {
        expect((await a.post('/api/designs').send(body)).status).toBe(400);
      }
    });

    it('aus Vorlage: Maße und Titel kommen von der Vorlage, Vorlage bleibt unverändert', async () => {
      const res = await a.post('/api/designs').send({ templateId: `tpl-${RUN}-1`, width: 100, height: 100 });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: 'Vorlage 1', width: 800, height: 600 });
      const full = await a.get(`/api/designs/${res.body.id}`);
      expect(full.body.pages[0].background).toEqual({ type: 'solid', color: '#123456' });
      expect((await db.template.findUnique({ where: { id: `tpl-${RUN}-1` } }))!.width).toBe(800);
    });

    it('unbekannte Vorlage und fremder Ordner → 400', async () => {
      expect((await a.post('/api/designs').send({ templateId: 'gibt-es-nicht' })).body.error).toBe('invalid_template');
      const folder = (await b.post('/api/folders').send({ name: 'Bs Ordner' })).body;
      expect((await a.post('/api/designs').send({ width: 500, height: 500, folderId: folder.id })).body.error).toBe('invalid_folder');
    });
  });

  describe('Liste, Suche, Sortierung', () => {
    it('zeigt nur eigene Designs, sucht ohne Groß/Klein und sortiert', async () => {
      await create(a, { width: 500, height: 500, title: 'Zebra Plakat' });
      await create(a, { width: 500, height: 500, title: 'Apfel Flyer' });
      await create(b, { width: 500, height: 500, title: 'Zebra von B' });
      expect(await titles(a, '?q=zEbRa')).toEqual(['Zebra Plakat']);
      expect(await titles(b, '?q=zebra')).toEqual(['Zebra von B']);
      const byTitle = await titles(a, '?sort=title');
      expect(byTitle).toEqual([...byTitle].sort((x, y) => x.localeCompare(y)));
      expect((await titles(a))[0]).toBe('Apfel Flyer'); // zuletzt erstellt zuerst
    });

    it('Limit wird begrenzt und geprüft', async () => {
      expect((await a.get('/api/designs?limit=1')).body.designs).toHaveLength(1);
      expect((await a.get('/api/designs?limit=1000')).status).toBe(400);
    });
  });

  describe('Ordner', () => {
    it('anlegen, doppelten Namen ablehnen, umbenennen, zählen, löschen', async () => {
      const f = (await a.post('/api/folders').send({ name: 'Kunde A' })).body;
      expect(f).toMatchObject({ name: 'Kunde A', designCount: 0 });
      expect((await a.post('/api/folders').send({ name: 'kunde a' })).status).toBe(409);
      expect((await b.post('/api/folders').send({ name: 'Kunde A' })).status).toBe(201); // pro Nutzer eindeutig
      expect((await a.post('/api/folders').send({ name: '   ' })).status).toBe(400);

      const d = await create(a, { width: 500, height: 500, title: 'Im Ordner', folderId: f.id });
      expect((await a.get('/api/folders')).body.folders.find((x: { id: string }) => x.id === f.id).designCount).toBe(1);
      expect(await titles(a, `?folderId=${f.id}`)).toEqual(['Im Ordner']);
      expect(await titles(a, '?folderId=root')).not.toContain('Im Ordner');

      expect((await a.patch(`/api/folders/${f.id}`).send({ name: 'Kunde B' })).body.name).toBe('Kunde B');
      expect((await a.delete(`/api/folders/${f.id}`)).status).toBe(204);
      expect((await a.get(`/api/designs/${d.id}`)).body.folderId).toBeNull(); // Design bleibt erhalten
    });

    it('fremde Ordner sind nicht änder- oder löschbar', async () => {
      const f = (await b.post('/api/folders').send({ name: 'Nur B' })).body;
      expect((await a.patch(`/api/folders/${f.id}`).send({ name: 'Hack' })).status).toBe(404);
      expect((await a.delete(`/api/folders/${f.id}`)).status).toBe(404);
      expect((await b.get('/api/folders')).body.folders.map((x: { name: string }) => x.name)).toContain('Nur B');
    });
  });

  describe('Bearbeiten', () => {
    it('umbenennen und in Ordner verschieben', async () => {
      const d = await create(a, { width: 500, height: 500, title: 'Alt' });
      const f = (await a.post('/api/folders').send({ name: 'Ziel' })).body;
      const res = await a.patch(`/api/designs/${d.id}`).send({ title: 'Neu', folderId: f.id });
      expect(res.body).toMatchObject({ title: 'Neu', folderId: f.id });
      expect((await a.patch(`/api/designs/${d.id}`).send({ folderId: null })).body.folderId).toBeNull();
    });

    it('lehnt leere Änderungen, leeren Titel und fremden Ordner ab', async () => {
      const d = await create(a, { width: 500, height: 500 });
      const foreign = (await b.post('/api/folders').send({ name: 'Fremd' })).body;
      expect((await a.patch(`/api/designs/${d.id}`).send({})).status).toBe(400);
      expect((await a.patch(`/api/designs/${d.id}`).send({ title: ' ' })).status).toBe(400);
      expect((await a.patch(`/api/designs/${d.id}`).send({ folderId: foreign.id })).body.error).toBe('invalid_folder');
    });

    it('duplizieren: Kopie mit gleichem Inhalt und eigenem Titel', async () => {
      const src = await create(a, { templateId: `tpl-${RUN}-2` });
      const copy = (await a.post(`/api/designs/${src.id}/duplicate`)).body;
      expect(copy.id).not.toBe(src.id);
      expect(copy.title).toBe('Kopie von Vorlage 2');
      expect((await a.get(`/api/designs/${copy.id}`)).body.pages).toEqual((await a.get(`/api/designs/${src.id}`)).body.pages);
    });
  });

  describe('Papierkorb', () => {
    it('Lebenszyklus: löschen, wiederherstellen, endgültig löschen', async () => {
      const d = await create(a, { width: 500, height: 500, title: 'Wegwerfen' });
      expect((await a.delete(`/api/designs/${d.id}`)).status).toBe(404); // nur aus dem Papierkorb endgültig löschbar
      expect((await a.post(`/api/designs/${d.id}/trash`)).status).toBe(204);
      expect(await titles(a)).not.toContain('Wegwerfen');
      expect(await titles(a, '?trash=1')).toContain('Wegwerfen');
      expect((await a.get(`/api/designs/${d.id}`)).status).toBe(404); // im Papierkorb nicht öffenbar
      expect((await a.post(`/api/designs/${d.id}/trash`)).status).toBe(404);

      expect((await a.post(`/api/designs/${d.id}/restore`)).status).toBe(204);
      expect(await titles(a)).toContain('Wegwerfen');

      await a.post(`/api/designs/${d.id}/trash`);
      expect((await a.delete(`/api/designs/${d.id}`)).status).toBe(204);
      expect(await titles(a, '?trash=1')).not.toContain('Wegwerfen');
    });

    it('Papierkorb leeren trifft nur eigene Einträge', async () => {
      const mine = await create(a, { width: 500, height: 500, title: 'Meins' });
      const theirs = await create(b, { width: 500, height: 500, title: 'Seins' });
      await a.post(`/api/designs/${mine.id}/trash`);
      await b.post(`/api/designs/${theirs.id}/trash`);
      expect((await a.delete('/api/designs/trash')).body.deleted).toBeGreaterThanOrEqual(1);
      expect(await titles(a, '?trash=1')).toEqual([]);
      expect(await titles(b, '?trash=1')).toContain('Seins');
    });

    it('löscht Einträge nach 30 Tagen automatisch', async () => {
      const d = await create(a, { width: 500, height: 500, title: 'Uralt' });
      await a.post(`/api/designs/${d.id}/trash`);
      await db.design.update({ where: { id: d.id }, data: { deletedAt: new Date(Date.now() - 31 * 86_400_000) } });
      expect(await titles(a, '?trash=1')).not.toContain('Uralt');
      expect(await db.design.count({ where: { id: d.id } })).toBe(0);
    });
  });

  it('fremde Designs sind unsichtbar und unveränderbar (404, nie 403)', async () => {
    const d = await create(a, { width: 500, height: 500, title: 'Geheim' });
    for (const res of [
      await b.get(`/api/designs/${d.id}`),
      await b.patch(`/api/designs/${d.id}`).send({ title: 'Gehackt' }),
      await b.post(`/api/designs/${d.id}/duplicate`),
      await b.post(`/api/designs/${d.id}/trash`),
      await b.delete(`/api/designs/${d.id}`),
    ]) expect(res.status).toBe(404);
    expect(await titles(b)).not.toContain('Geheim');
    expect((await a.get(`/api/designs/${d.id}`)).body.title).toBe('Geheim');
  });

  describe('Vorlagen', () => {
    it('Liste mit Vorschau, Filter nach Kategorie, Suche und Kategorien-Zähler', async () => {
      const all = (await a.get(`/api/templates?category=${CATEGORY}`)).body.templates;
      expect(all).toHaveLength(2);
      expect(all[0]).toMatchObject({ category: CATEGORY, width: 800, height: 600 });
      expect(all[0].thumbnail).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(all[0].data).toBeUndefined(); // Rohdaten bleiben draußen
      expect((await a.get(`/api/templates?category=${CATEGORY}&q=ALPHA`)).body.templates).toHaveLength(2);
      expect((await a.get(`/api/templates?category=${CATEGORY}&q=nichts-davon`)).body.templates).toHaveLength(0);
      const cats = (await a.get('/api/templates/categories')).body.categories;
      expect(cats.find((c: { name: string }) => c.name === CATEGORY)).toEqual({ name: CATEGORY, count: 2 });
    });
  });
});
