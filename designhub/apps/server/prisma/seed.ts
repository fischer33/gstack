// Seed: Vorlagen-Galerie (mind. 20 laut docs/ARCHITECTURE.md).
// Idempotent: feste IDs + upsert, mehrfaches Ausführen erzeugt keine Duplikate.
import { PrismaClient } from '@prisma/client';
import {
  DOCUMENT_VERSION,
  FORMATS,
  type Background,
  type DesignDocument,
  type Element,
  type FormatKey,
  type ShapeElement,
  type TextElement,
} from '@designhub/shared';

const prisma = new PrismaClient();

interface Palette { bg: string; accent: string; text: string; muted: string }

const PALETTES: Record<string, Palette> = {
  ink: { bg: '#14161f', accent: '#f2c14e', text: '#f7f5ef', muted: '#9aa0b0' },
  paper: { bg: '#f6f1e7', accent: '#d9482b', text: '#1d1b18', muted: '#6e665a' },
  sea: { bg: '#0f4c5c', accent: '#5fd3bc', text: '#ffffff', muted: '#b9d9df' },
  bloom: { bg: '#fde8ec', accent: '#c2185b', text: '#2b1a20', muted: '#8a6470' },
  forest: { bg: '#1f3a2e', accent: '#e8d8a8', text: '#f4f1e6', muted: '#a7b8a4' },
};

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

const base = (x: number, y: number, width: number, height: number) => ({
  id: nextId('el'),
  x, y, width, height,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
});

function rect(x: number, y: number, w: number, h: number, fill: string, cornerRadius = 0): ShapeElement {
  return { ...base(x, y, w, h), type: 'shape', kind: 'rect', fill, stroke: 'transparent', strokeWidth: 0, cornerRadius };
}

function ellipse(x: number, y: number, size: number, fill: string, opacity = 1): ShapeElement {
  return { ...base(x, y, size, size), opacity, type: 'shape', kind: 'ellipse', fill, stroke: 'transparent', strokeWidth: 0 };
}

function text(
  value: string,
  x: number, y: number, w: number,
  fontSize: number, fill: string,
  opts: Partial<Pick<TextElement, 'fontWeight' | 'align' | 'letterSpacing' | 'fontFamily'>> = {},
): TextElement {
  const lines = value.split('\n').length;
  return {
    ...base(x, y, w, Math.round(fontSize * 1.25 * lines)),
    type: 'text',
    text: value,
    fontFamily: opts.fontFamily ?? 'Inter',
    fontSize,
    fontWeight: opts.fontWeight ?? 400,
    italic: false,
    underline: false,
    align: opts.align ?? 'left',
    fill,
    lineHeight: 1.2,
    letterSpacing: opts.letterSpacing ?? 0,
  };
}

type Layout = 'centered' | 'split' | 'banner';

/** Baut eine Seite; alle Maße relativ zur Formatgröße, damit jedes Layout in jedes Format passt. */
function buildElements(layout: Layout, w: number, h: number, p: Palette, copy: Copy): Element[] {
  const m = Math.round(Math.min(w, h) * 0.08); // Rand
  const unit = Math.min(w, h);
  const headline = Math.round(unit * 0.11);
  const body = Math.round(unit * 0.04);

  switch (layout) {
    case 'centered':
      return [
        ellipse(w - unit * 0.55, -unit * 0.2, unit * 0.7, p.accent, 0.25),
        text(copy.kicker.toUpperCase(), m, h * 0.3, w - 2 * m, body, p.accent, { align: 'center', letterSpacing: 4, fontWeight: 700 }),
        text(copy.title, m, h * 0.3 + body * 2, w - 2 * m, headline, p.text, { align: 'center', fontWeight: 700 }),
        text(copy.sub, m, h * 0.3 + body * 2 + headline * 2.8, w - 2 * m, body, p.muted, { align: 'center' }),
      ];
    case 'split':
      return [
        rect(0, 0, w * 0.4, h, p.accent),
        text(copy.kicker.toUpperCase(), w * 0.4 + m, m, w * 0.6 - 2 * m, body, p.muted, { letterSpacing: 4, fontWeight: 700 }),
        text(copy.title, w * 0.4 + m, h * 0.35, w * 0.6 - 2 * m, headline, p.text, { fontWeight: 700 }),
        text(copy.sub, w * 0.4 + m, h - m - body * 1.25, w * 0.6 - 2 * m, body, p.muted),
      ];
    case 'banner':
      return [
        rect(0, h * 0.62, w, h * 0.38, p.accent),
        text(copy.title, m, h * 0.2, w - 2 * m, headline, p.text, { fontWeight: 700 }),
        text(copy.kicker.toUpperCase(), m, h * 0.62 + m * 0.6, w - 2 * m, body, p.bg, { letterSpacing: 4, fontWeight: 700 }),
        text(copy.sub, m, h * 0.62 + m * 0.6 + body * 2, w - 2 * m, body, p.bg),
      ];
  }
}

interface Copy { kicker: string; title: string; sub: string }

interface Spec {
  format: FormatKey;
  category: string;
  layout: Layout;
  palette: keyof typeof PALETTES;
  copy: Copy;
  tags: string[];
}

const SPECS: Spec[] = [
  // Instagram Post
  { format: 'instagramPost', category: 'Social Media', layout: 'centered', palette: 'ink', tags: ['launch', 'dunkel'], copy: { kicker: 'Neu', title: 'Jetzt\nverfügbar', sub: 'Link in der Bio' } },
  { format: 'instagramPost', category: 'Social Media', layout: 'split', palette: 'bloom', tags: ['zitat', 'pastell'], copy: { kicker: 'Montag', title: 'Kleine\nSchritte\nzählen.', sub: '@deinkanal' } },
  { format: 'instagramPost', category: 'Social Media', layout: 'banner', palette: 'sea', tags: ['sale', 'angebot'], copy: { kicker: 'Nur dieses Wochenende', title: '-30 %\nauf alles', sub: 'Code: SOMMER30' } },
  // Story
  { format: 'story', category: 'Social Media', layout: 'centered', palette: 'forest', tags: ['event', 'natur'], copy: { kicker: 'Samstag · 10 Uhr', title: 'Wald-\nspaziergang', sub: 'Treffpunkt Parkplatz Nord' } },
  { format: 'story', category: 'Social Media', layout: 'banner', palette: 'paper', tags: ['umfrage'], copy: { kicker: 'Deine Meinung', title: 'Was\nkommt\nals Nächstes?', sub: 'Stimm unten ab' } },
  { format: 'story', category: 'Social Media', layout: 'split', palette: 'ink', tags: ['countdown'], copy: { kicker: 'Noch 3 Tage', title: 'Bald\nist es\nso weit', sub: 'Erinnerung aktivieren' } },
  // Präsentation
  { format: 'presentation', category: 'Präsentation', layout: 'split', palette: 'paper', tags: ['titel', 'business'], copy: { kicker: 'Quartalsbericht', title: 'Q3 im\nÜberblick', sub: 'Team Vertrieb · Oktober' } },
  { format: 'presentation', category: 'Präsentation', layout: 'centered', palette: 'sea', tags: ['kapitel'], copy: { kicker: 'Kapitel 2', title: 'Unsere Strategie', sub: 'Ziele für das kommende Jahr' } },
  { format: 'presentation', category: 'Präsentation', layout: 'banner', palette: 'ink', tags: ['danke', 'abschluss'], copy: { kicker: 'Fragen?', title: 'Vielen Dank', sub: 'kontakt@beispiel.de' } },
  // Poster
  { format: 'poster', category: 'Poster', layout: 'centered', palette: 'bloom', tags: ['konzert', 'musik'], copy: { kicker: 'Live im Stadtgarten', title: 'Sommer-\nkonzert', sub: '21. Juni · Eintritt frei' } },
  { format: 'poster', category: 'Poster', layout: 'banner', palette: 'forest', tags: ['ausstellung', 'kunst'], copy: { kicker: 'Ausstellung', title: 'Formen\nder Stille', sub: 'Galerie am Markt · bis 30. Nov.' } },
  { format: 'poster', category: 'Poster', layout: 'split', palette: 'ink', tags: ['film'], copy: { kicker: 'Filmabend', title: 'Kino\nunter\nSternen', sub: 'Freitag · 21 Uhr · Dachterrasse' } },
  // Flyer
  { format: 'flyer', category: 'Flyer', layout: 'banner', palette: 'paper', tags: ['café', 'eröffnung'], copy: { kicker: 'Neueröffnung', title: 'Café\nam Eck', sub: 'Erster Kaffee geht aufs Haus' } },
  { format: 'flyer', category: 'Flyer', layout: 'centered', palette: 'sea', tags: ['kurs', 'yoga'], copy: { kicker: 'Anfängerkurs', title: 'Yoga am\nMorgen', sub: 'Di & Do · 7:30 Uhr' } },
  { format: 'flyer', category: 'Flyer', layout: 'split', palette: 'forest', tags: ['markt', 'regional'], copy: { kicker: 'Jeden Samstag', title: 'Bauern-\nmarkt', sub: 'Regional · saisonal · frisch' } },
  // Visitenkarte
  { format: 'businessCard', category: 'Visitenkarte', layout: 'split', palette: 'ink', tags: ['minimal'], copy: { kicker: 'Designerin', title: 'Mara Klein', sub: 'mara@beispiel.de' } },
  { format: 'businessCard', category: 'Visitenkarte', layout: 'banner', palette: 'paper', tags: ['klassisch'], copy: { kicker: '+49 30 1234567', title: 'Jonas Weber', sub: 'Schreinerei Weber' } },
  { format: 'businessCard', category: 'Visitenkarte', layout: 'centered', palette: 'bloom', tags: ['kreativ'], copy: { kicker: 'Fotografie', title: 'Lena Roth', sub: 'lenaroth.de' } },
  // Logo
  { format: 'logo', category: 'Logo', layout: 'centered', palette: 'sea', tags: ['monogramm'], copy: { kicker: 'Studio', title: 'NB', sub: 'seit 2024' } },
  { format: 'logo', category: 'Logo', layout: 'banner', palette: 'forest', tags: ['natur'], copy: { kicker: 'Gärtnerei', title: 'Grün', sub: 'aus Leidenschaft' } },
  { format: 'logo', category: 'Logo', layout: 'split', palette: 'ink', tags: ['tech'], copy: { kicker: 'Labs', title: 'Pix', sub: 'digital' } },
];

function toDocument(spec: Spec): DesignDocument {
  const { width, height } = FORMATS[spec.format];
  const p = PALETTES[spec.palette];
  const background: Background = { type: 'solid', color: p.bg };
  return {
    version: DOCUMENT_VERSION,
    width,
    height,
    pages: [{ id: nextId('page'), background, elements: buildElements(spec.layout, width, height, p, spec.copy) }],
  };
}

async function main() {
  for (const [i, spec] of SPECS.entries()) {
    seq = 0; // stabile Element-IDs pro Vorlage
    const id = `tpl-${String(i + 1).padStart(2, '0')}-${spec.format}`;
    const { width, height } = FORMATS[spec.format];
    const fields = {
      title: spec.copy.title.replace(/\n/g, ' ').replace(/- /g, ''),
      category: spec.category,
      tags: spec.tags,
      width,
      height,
      data: toDocument(spec) as unknown as object,
    };
    await prisma.template.upsert({ where: { id }, create: { id, ...fields }, update: fields });
  }
  console.log(`Seed fertig: ${SPECS.length} Vorlagen.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
