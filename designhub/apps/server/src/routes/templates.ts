import type { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { pageToSvg, svgToDataUrl, type DesignDocument, type TemplateCategory, type TemplateDetail, type TemplateSummary } from '@designhub/shared';
import { ah } from '../middleware/security';

const query = z.object({ category: z.string().trim().max(60).optional(), q: z.string().trim().max(100).optional() });

export function templatesRouter(db: PrismaClient) {
  const r = Router();

  r.get('/', ah(async (req, res) => {
    const { category, q } = query.parse(req.query);
    const rows = await db.template.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }, { tags: { has: q.toLowerCase() } }] } : {}),
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    // Vorschau aus den Vorlagendaten; bei sehr vielen Vorlagen stattdessen beim Seed speichern.
    const templates: TemplateSummary[] = rows.map((t) => {
      const doc = t.data as unknown as DesignDocument;
      return {
        id: t.id, title: t.title, category: t.category, tags: t.tags, width: t.width, height: t.height,
        thumbnail: t.thumbnail ?? svgToDataUrl(pageToSvg(t, doc.pages[0])),
      };
    });
    res.json({ templates });
  }));

  r.get('/categories', ah(async (_req, res) => {
    const groups = await db.template.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } });
    const categories: TemplateCategory[] = groups.map((g) => ({ name: g.category, count: g._count._all }));
    res.json({ categories });
  }));

  // Nach `/categories` registriert, sonst würde "categories" als ID gelesen.
  r.get('/:id', ah(async (req, res) => {
    const t = await db.template.findUnique({ where: { id: req.params.id } });
    if (!t) return void res.status(404).json({ error: 'not_found' });
    const detail: TemplateDetail = { id: t.id, title: t.title, category: t.category, tags: t.tags, width: t.width, height: t.height, data: t.data as unknown as DesignDocument };
    res.json(detail);
  }));
  return r;
}
