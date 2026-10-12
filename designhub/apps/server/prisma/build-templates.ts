// Erzeugt die handgestalteten Vorlagen als JSON (prisma/templates/*.json). Die JSON-Dateien sind die Quelle für den
// Seed; dieses Skript ist nur das bequeme Werkzeug, sie zu pflegen: `npm run db:templates -w @designhub/server`.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DOCUMENT_VERSION, FORMATS, parseDesignDocument,
  type Background, type DesignDocument, type Element, type FormatKey, type IconElement, type ShapeElement, type TextElement,
} from '@designhub/shared';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'templates');

let seq = 0;
const base = (x: number, y: number, width: number, height: number, opacity = 1) => ({
  id: `e${++seq}`, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height), rotation: 0, opacity, locked: false, visible: true,
});

const rect = (x: number, y: number, w: number, h: number, fill: string, o: { r?: number; opacity?: number; rotation?: number; stroke?: string; sw?: number } = {}): ShapeElement =>
  ({ ...base(x, y, w, h, o.opacity), rotation: o.rotation ?? 0, type: 'shape', kind: 'rect', fill, stroke: o.stroke ?? 'transparent', strokeWidth: o.sw ?? 0, cornerRadius: o.r ?? 0 });
const circle = (x: number, y: number, d: number, fill: string, o: { opacity?: number; stroke?: string; sw?: number } = {}): ShapeElement =>
  ({ ...base(x, y, d, d, o.opacity), type: 'shape', kind: 'ellipse', fill, stroke: o.stroke ?? 'transparent', strokeWidth: o.sw ?? 0 });
const star = (x: number, y: number, d: number, fill: string, points = 5, rotation = 0): ShapeElement =>
  ({ ...base(x, y, d, d), rotation, type: 'shape', kind: 'star', fill, stroke: 'transparent', strokeWidth: 0, points });
const line = (x: number, y: number, w: number, color: string, sw = 4): ShapeElement =>
  ({ ...base(x, y, w, sw * 3), type: 'shape', kind: 'line', fill: 'transparent', stroke: color, strokeWidth: sw });
const icon = (path: string, x: number, y: number, size: number, fill: string): IconElement =>
  ({ ...base(x, y, size, size), type: 'icon', path, viewBox: 24, fill });
const HEART = 'M12 21C5 15.5 2 12 2 8.5 2 5.5 4.3 3.5 7 3.5c1.9 0 3.7 1 5 2.8 1.3-1.8 3.1-2.8 5-2.8 2.7 0 5 2 5 5C22 12 19 15.5 12 21Z';
const CHECK = 'M9.2 17.6 4 12.4l1.9-1.9 3.3 3.3 8.9-8.9 1.9 1.9Z';

interface TextOpts { font?: string; weight?: 400 | 700; align?: TextElement['align']; ls?: number; lh?: number; italic?: boolean; opacity?: number; rotation?: number }
const text = (value: string, x: number, y: number, w: number, size: number, fill: string, o: TextOpts = {}): TextElement => {
  const lh = o.lh ?? 1.2;
  return {
    ...base(x, y, w, size * lh * value.split('\n').length, o.opacity), rotation: o.rotation ?? 0, type: 'text', text: value, fontFamily: o.font ?? 'Inter', fontSize: size,
    fontWeight: o.weight ?? 400, italic: o.italic ?? false, underline: false, align: o.align ?? 'left', fill, lineHeight: lh, letterSpacing: o.ls ?? 0,
  };
};

const solid = (color: string): Background => ({ type: 'solid', color });
const grad = (angle: number, ...colors: string[]): Background => ({ type: 'gradient', angle, stops: colors.map((color, i) => ({ offset: i / (colors.length - 1), color })) });

interface Tpl { id: string; title: string; category: string; format: FormatKey; tags: string[]; pages: { bg: Background; els: (w: number, h: number) => Element[] }[] }

const TEMPLATES: Tpl[] = [
  {
    id: 'tpl-j-01-quote', title: 'Zitat auf Verlauf', category: 'Social Media', format: 'instagramPost', tags: ['zitat', 'verlauf', 'motivation'],
    pages: [{ bg: grad(135, '#3a1c71', '#d76d77', '#ffaf7b'), els: (w, h) => [
      text('„', 90, 80, 200, 360, '#ffffff', { font: 'Playfair Display', weight: 700, opacity: 0.35, lh: 1 }),
      text('Mut ist nicht die Abwesenheit von Angst, sondern der Entschluss, dass etwas anderes wichtiger ist.', 100, 330, w - 200, 68, '#ffffff', { font: 'Playfair Display', weight: 700, lh: 1.25 }),
      line(100, h - 230, 160, '#ffffff', 5),
      text('AMBROSE REDMOON', 100, h - 190, w - 200, 30, '#ffffff', { ls: 6, weight: 700 }),
    ] }],
  },
  {
    id: 'tpl-j-02-launch', title: 'Produkt-Launch', category: 'Social Media', format: 'instagramPost', tags: ['launch', 'produkt', 'neu'],
    pages: [{ bg: solid('#fff4e6'), els: (w, h) => [
      circle(w - 620, h - 620, 760, '#ff6b35'),
      circle(w - 480, h - 480, 480, '#ffd23f', { opacity: 0.9 }),
      text('NEU', 90, 100, 300, 40, '#ff6b35', { font: 'Poppins', weight: 700, ls: 10 }),
      text('Frisch.\nMutig.\nDeins.', 90, 170, 620, 150, '#1b1b1e', { font: 'Poppins', weight: 700, lh: 1.05 }),
      text('Ab 1. November im Shop', 90, 640, 520, 36, '#1b1b1e', { font: 'Poppins' }),
      star(w - 330, 110, 190, '#1b1b1e', 12, 12),
      text('-20 %', w - 318, 175, 166, 54, '#fff4e6', { font: 'Poppins', weight: 700, align: 'center', rotation: 12 }),
    ] }],
  },
  {
    id: 'tpl-j-03-recipe', title: 'Rezept des Tages', category: 'Social Media', format: 'instagramPost', tags: ['rezept', 'essen', 'food'],
    pages: [{ bg: solid('#f7efe2'), els: (w, h) => [
      rect(60, 60, w - 120, h - 120, 'transparent', { stroke: '#7a4e2d', sw: 4 }),
      text('REZEPT DES TAGES', 0, 130, w, 30, '#7a4e2d', { font: 'Montserrat', weight: 700, ls: 8, align: 'center' }),
      text('Cremige\nTomatensuppe', 100, 210, w - 200, 120, '#3b2a1a', { font: 'Lora', weight: 700, align: 'center', lh: 1.1 }),
      line(w / 2 - 80, 520, 160, '#c1440e', 5),
      text('25 Min.   ·   2 Personen   ·   Vegetarisch', 100, 590, w - 200, 34, '#7a4e2d', { font: 'Montserrat', align: 'center' }),
      text('Zutaten und Zubereitung\nfindest du in der Beschreibung', 100, 700, w - 200, 38, '#3b2a1a', { font: 'Lora', italic: true, align: 'center' }),
      icon(HEART, w / 2 - 36, h - 220, 72, '#c1440e'),
    ] }],
  },
  {
    id: 'tpl-j-04-carousel', title: 'Karussell: 3 Tipps', category: 'Social Media', format: 'instagramPost', tags: ['karussell', 'tipps', 'mehrseitig'],
    pages: [
      { bg: solid('#0b132b'), els: (w, h) => [
        circle(w - 380, -160, 600, '#5bc0be', { opacity: 0.25 }),
        text('3 TIPPS FÜR', 90, 330, w - 180, 44, '#5bc0be', { font: 'Montserrat', weight: 700, ls: 8 }),
        text('besseren\nSchlaf', 90, 400, w - 180, 170, '#ffffff', { font: 'Montserrat', weight: 700, lh: 1.05 }),
        text('Wische weiter  →', 90, h - 150, 500, 36, '#5bc0be', { font: 'Montserrat' }),
      ] },
      { bg: solid('#f2f4f8'), els: (w, h) => [
        text('1', 90, 120, 300, 340, '#5bc0be', { font: 'Montserrat', weight: 700, lh: 1 }),
        text('Feste Zeiten', 90, 520, w - 180, 90, '#0b132b', { font: 'Montserrat', weight: 700 }),
        text('Geh jeden Tag zur gleichen Zeit ins Bett und steh zur gleichen Zeit auf, auch am Wochenende.', 90, 650, w - 180, 42, '#3a506b', { font: 'Montserrat', lh: 1.4 }),
        rect(0, h - 24, w * 0.33, 24, '#5bc0be'),
      ] },
      { bg: solid('#5bc0be'), els: (w, h) => [
        text('Gefällt dir das?', 90, 330, w - 180, 100, '#0b132b', { font: 'Montserrat', weight: 700, align: 'center' }),
        text('Speichern, teilen und folgen\nfür mehr Tipps.', 90, 500, w - 180, 44, '#0b132b', { font: 'Montserrat', align: 'center', lh: 1.4 }),
        icon(HEART, w / 2 - 50, 700, 100, '#0b132b'),
      ] },
    ],
  },
  {
    id: 'tpl-j-05-event-story', title: 'Event-Einladung (Story)', category: 'Social Media', format: 'story', tags: ['event', 'einladung', 'party'],
    pages: [{ bg: grad(180, '#0f0c29', '#302b63', '#24243e'), els: (w, h) => [
      star(w - 330, 160, 220, '#ffd166', 4, 15), star(110, 1380, 120, '#ef476f', 4, -10), star(w - 250, 1500, 80, '#06d6a0', 4),
      text('DU BIST EINGELADEN', 90, 360, w - 180, 36, '#ffd166', { font: 'Montserrat', weight: 700, ls: 8, align: 'center' }),
      text('SOMMER\nFEST', 90, 460, w - 180, 200, '#ffffff', { font: 'Bebas Neue', align: 'center', lh: 0.95 }),
      line(w / 2 - 100, 1000, 200, '#ef476f', 6),
      text('SA, 19. JULI · 18 UHR', 90, 1060, w - 180, 52, '#ffffff', { font: 'Montserrat', weight: 700, align: 'center', ls: 2 }),
      text('Gartenstraße 12, Berlin', 90, 1140, w - 180, 40, '#c9c6e8', { font: 'Montserrat', align: 'center' }),
      text('Bitte bis 1. Juli zusagen', 90, 1700, w - 180, 36, '#c9c6e8', { font: 'Montserrat', italic: true, align: 'center' }),
    ] }],
  },
  {
    id: 'tpl-j-06-question-story', title: 'Frage des Tages (Story)', category: 'Social Media', format: 'story', tags: ['frage', 'umfrage', 'interaktion'],
    pages: [{ bg: solid('#ffd23f'), els: (w, h) => [
      circle(-200, 1300, 700, '#ff6b35'),
      text('FRAGE DES TAGES', 90, 300, w - 180, 40, '#1b1b1e', { font: 'Poppins', weight: 700, ls: 8, align: 'center' }),
      text('Kaffee oder\nTee?', 90, 400, w - 180, 170, '#1b1b1e', { font: 'Poppins', weight: 700, align: 'center', lh: 1.05 }),
      rect(120, 1000, w - 240, 170, '#ffffff', { r: 85 }),
      text('Deine Antwort …', 120, 1058, w - 240, 54, '#9a9a9a', { font: 'Poppins', align: 'center' }),
      text('Tippe auf das Feld unten', 90, 1560, w - 180, 38, '#ffffff', { font: 'Poppins', weight: 700, align: 'center' }),
    ] }],
  },
  {
    id: 'tpl-j-07-pitch', title: 'Pitch-Deck (3 Folien)', category: 'Präsentation', format: 'presentation', tags: ['pitch', 'startup', 'mehrseitig'],
    pages: [
      { bg: solid('#101828'), els: (w, h) => [
        rect(0, 0, 24, h, '#7c5cff'),
        text('PITCH 2026', 140, 280, 800, 34, '#7c5cff', { font: 'DM Sans', weight: 700, ls: 8 }),
        text('Die Zukunft\nbeginnt hier', 140, 350, 1400, 190, '#ffffff', { font: 'DM Sans', weight: 700, lh: 1.05 }),
        text('Dein Team · Dein Name · Datum', 140, 880, 1000, 40, '#98a2b3', { font: 'DM Sans' }),
        circle(w - 620, h - 620, 900, '#7c5cff', { opacity: 0.2 }),
      ] },
      { bg: solid('#ffffff'), els: (w, h) => [
        text('Das Problem, die Lösung, der Markt', 140, 110, w - 280, 76, '#101828', { font: 'DM Sans', weight: 700 }),
        ...[['01', 'Problem', 'Was nervt Kundinnen und Kunden heute?'], ['02', 'Lösung', 'Wie löst euer Produkt das elegant?'], ['03', 'Markt', 'Wie groß ist die Chance, in Zahlen?']].flatMap(([n, t, d], i) => [
          rect(140 + i * 560, 300, 520, 560, '#f4f1ff', { r: 28 }),
          text(n!, 190 + i * 560, 350, 200, 90, '#7c5cff', { font: 'DM Sans', weight: 700 }),
          text(t!, 190 + i * 560, 500, 420, 56, '#101828', { font: 'DM Sans', weight: 700 }),
          text(d!, 190 + i * 560, 590, 420, 34, '#475467', { font: 'DM Sans', lh: 1.4 }),
        ]),
      ] },
      { bg: solid('#7c5cff'), els: (w, h) => [
        text('Danke!', 140, 330, w - 280, 220, '#ffffff', { font: 'DM Sans', weight: 700 }),
        text('Fragen? Schreib uns:\nhallo@beispiel.de', 140, 620, 1000, 56, '#ece9ff', { font: 'DM Sans', lh: 1.4 }),
        star(w - 520, 220, 300, '#ffd166', 5, 10),
      ] },
    ],
  },
  {
    id: 'tpl-j-08-agenda', title: 'Agenda', category: 'Präsentation', format: 'presentation', tags: ['agenda', 'ablauf', 'meeting'],
    pages: [{ bg: solid('#f6f1e7'), els: (w, h) => [
      rect(0, 0, 640, h, '#1d3557'),
      text('Agenda', 80, 120, 500, 110, '#ffffff', { font: 'Playfair Display', weight: 700 }),
      text('Teamtreffen\nMontag, 9 Uhr', 80, 760, 500, 44, '#a8dadc', { font: 'Lora', lh: 1.4 }),
      ...['Begrüßung und Ziele', 'Rückblick auf den letzten Monat', 'Neue Projekte', 'Offene Fragen'].flatMap((t, i) => [
        text(`0${i + 1}`, 760, 170 + i * 200, 120, 64, '#e63946', { font: 'Playfair Display', weight: 700 }),
        text(t, 900, 182 + i * 200, 900, 50, '#1d3557', { font: 'Lora' }),
        line(760, 255 + i * 200, 1060, '#d9cfc0', 3),
      ]),
    ] }],
  },
  {
    id: 'tpl-j-09-festival', title: 'Festival-Poster', category: 'Poster', format: 'poster', tags: ['festival', 'musik', 'konzert'],
    pages: [{ bg: grad(160, '#ff0080', '#ff8c00', '#ffd400'), els: (w, h) => [
      circle(w / 2 - 520, 520, 1040, '#1a1a2e', { opacity: 0.92 }),
      text('LIVE 2026', 0, 140, w, 56, '#1a1a2e', { font: 'Oswald', weight: 700, ls: 16, align: 'center' }),
      text('SUN\nBEAT', 0, 660, w, 330, '#ffd400', { font: 'Bebas Neue', align: 'center', lh: 0.9 }),
      text('FESTIVAL', 0, 1290, w, 110, '#ffffff', { font: 'Bebas Neue', ls: 24, align: 'center' }),
      line(w / 2 - 120, 1450, 240, '#ff0080', 8),
      text('12.–14. JUNI · STADTPARK', 0, 1580, w, 60, '#1a1a2e', { font: 'Oswald', weight: 700, ls: 4, align: 'center' }),
      text('Tickets: sunbeat.example', 0, 2050, w, 44, '#1a1a2e', { font: 'Oswald', align: 'center', ls: 3 }),
      star(150, 240, 150, '#1a1a2e', 5, -12), star(w - 300, 1850, 160, '#1a1a2e', 5, 15),
    ] }],
  },
  {
    id: 'tpl-j-10-typo', title: 'Typografie-Poster', category: 'Poster', format: 'poster', tags: ['typografie', 'minimal', 'kunst'],
    pages: [{ bg: solid('#efe9dd'), els: (w, h) => [
      text('LESS\nIS\nMORE', 90, 150, w - 180, 440, '#111111', { font: 'Oswald', weight: 700, lh: 0.88, ls: -6 }),
      rect(90, 1760, 330, 330, '#e63946'),
      line(480, 1925, w - 570, '#111111', 6),
      text('Ludwig Mies van der Rohe\nGestaltung seit 1929', 480, 1960, w - 570, 38, '#111111', { font: 'Lora', italic: true, lh: 1.4 }),
    ] }],
  },
  {
    id: 'tpl-j-11-sale', title: 'Sale-Flyer', category: 'Flyer', format: 'flyer', tags: ['sale', 'angebot', 'rabatt'],
    pages: [{ bg: solid('#e63946'), els: (w, h) => [
      circle(w - 560, 120, 760, '#ffffff', { opacity: 0.12 }),
      text('SOMMER', 80, 140, w - 160, 150, '#ffffff', { font: 'Bebas Neue', ls: 8 }),
      text('SALE', 80, 270, w - 160, 400, '#ffffff', { font: 'Bebas Neue', lh: 0.9 }),
      star(w - 450, 880, 340, '#ffd166', 16, 8),
      text('bis zu\n50 %', w - 430, 970, 300, 90, '#e63946', { font: 'Bebas Neue', align: 'center', lh: 0.95, rotation: 8 }),
      rect(80, 1250, w - 160, 6, '#ffffff'),
      text('Alles muss raus – nur solange der Vorrat reicht.', 80, 1310, w - 160, 50, '#ffffff', { font: 'Montserrat', weight: 700, lh: 1.3 }),
      text('Mo–Sa 10–19 Uhr · Hauptstraße 5', 80, 1620, w - 160, 36, '#ffe5e8', { font: 'Montserrat' }),
    ] }],
  },
  {
    id: 'tpl-j-12-workshop', title: 'Workshop-Flyer', category: 'Flyer', format: 'flyer', tags: ['workshop', 'kurs', 'bildung'],
    pages: [{ bg: solid('#fdfcf8'), els: (w, h) => [
      rect(0, 0, w, 760, '#2a9d8f'),
      circle(w - 400, -200, 640, '#e9c46a', { opacity: 0.9 }),
      text('WORKSHOP', 90, 150, w - 180, 36, '#ffffff', { font: 'Montserrat', weight: 700, ls: 10 }),
      text('Aquarell\nfür Anfänger', 90, 230, w - 180, 120, '#ffffff', { font: 'Playfair Display', weight: 700, lh: 1.1 }),
      text('Samstag, 21. September\n10–16 Uhr · Atelier Farbraum', 90, 860, w - 180, 44, '#264653', { font: 'Montserrat', weight: 700, lh: 1.5 }),
      ...['Material inklusive', 'Maximal 8 Teilnehmende', 'Keine Vorkenntnisse nötig'].flatMap((t, i) => [
        icon(CHECK, 90, 1120 + i * 90, 48, '#2a9d8f'),
        text(t, 160, 1124 + i * 90, w - 260, 40, '#264653', { font: 'Montserrat' }),
      ]),
      rect(90, 1500, 440, 110, '#264653', { r: 55 }),
      text('Jetzt anmelden', 90, 1530, 440, 40, '#ffffff', { font: 'Montserrat', weight: 700, align: 'center' }),
    ] }],
  },
  {
    id: 'tpl-j-13-card', title: 'Visitenkarte Vorder-/Rückseite', category: 'Visitenkarte', format: 'businessCard', tags: ['visitenkarte', 'zweiseitig', 'studio'],
    pages: [
      { bg: solid('#14213d'), els: (w, h) => [
        circle(60, 190, 220, '#fca311'),
        text('M', 60, 235, 220, 130, '#14213d', { font: 'Playfair Display', weight: 700, align: 'center' }),
        text('Mara Klein', 340, 200, 640, 80, '#ffffff', { font: 'Playfair Display', weight: 700 }),
        text('GRAFIKDESIGN', 340, 305, 640, 28, '#fca311', { font: 'Montserrat', weight: 700, ls: 8 }),
      ] },
      { bg: solid('#fca311'), els: (w, h) => [
        rect(0, 0, 36, h, '#14213d'),
        text('mara@beispiel.de\n+49 30 1234567\nwww.maraklein.de', 90, 170, w - 180, 44, '#14213d', { font: 'Montserrat', lh: 1.6 }),
        text('Atelierstraße 7 · 10115 Berlin', 90, h - 130, w - 180, 28, '#14213d', { font: 'Montserrat', weight: 700 }),
      ] },
    ],
  },
  {
    id: 'tpl-j-14-logo', title: 'Kreis-Monogramm', category: 'Logo', format: 'logo', tags: ['monogramm', 'kreis', 'minimal'],
    pages: [{ bg: solid('#ffffff'), els: (w, h) => [
      circle(90, 60, 320, '#1f2a44'),
      circle(106, 76, 288, 'transparent', { stroke: '#f2c14e', sw: 4 }),
      text('NB', 90, 160, 320, 130, '#f2c14e', { font: 'Playfair Display', weight: 700, align: 'center' }),
      text('NORDBLICK STUDIO', 0, 410, w, 28, '#1f2a44', { font: 'Montserrat', weight: 700, ls: 6, align: 'center' }),
    ] }],
  },
];

function build(t: Tpl): DesignDocument {
  seq = 0;
  const { width, height } = FORMATS[t.format];
  return {
    version: DOCUMENT_VERSION, width, height,
    pages: t.pages.map((p, i) => ({ id: `p${i + 1}`, background: p.bg, elements: p.els(width, height) })),
  };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const t of TEMPLATES) {
  const doc = build(t);
  const parsed = parseDesignDocument(doc);
  if (!parsed.ok) throw new Error(`${t.id}: ${JSON.stringify(parsed.issues)}`);
  const { width, height } = FORMATS[t.format];
  writeFileSync(join(OUT, `${t.id}.json`), JSON.stringify({ id: t.id, title: t.title, category: t.category, tags: t.tags, width, height, data: parsed.doc }, null, 2) + '\n');
}
console.log(`${TEMPLATES.length} Vorlagen geschrieben nach ${OUT}`);
