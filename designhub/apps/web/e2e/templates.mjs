// Etappe (e): Vorlagengalerie. Wendet jede Vorlage an, prüft Zeichnung ohne Konsolenfehler und mehrseitige Vorlagen.
import { OUT, editorKit, launch, register, reporter, watchErrors } from './lib.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = watchErrors(p);
const { ok, finish } = reporter();
const k = editorKit(p);
const { wait, state, eventually } = k;

await register(p, { name: 'Ada' });
const api = (path) => p.evaluate(async (path) => (await fetch('/api' + path, { credentials: 'include' })).json(), path);
const all = await api('/templates');
const list = Array.isArray(all) ? all : all.items ?? all.templates;
ok('Mindestens 20 Vorlagen in der Datenbank', list.length >= 20, String(list.length));
const cats = new Set(list.map((t) => t.category));
ok('Mehrere Kategorien', cats.size >= 5, [...cats].join());

// Je Format eine neue Gestaltung, dann alle passenden Vorlagen anwenden
const FORMATS = [['Instagram Post', 1080, 1080], ['Story', 1080, 1920], ['Präsentation', 1920, 1080], ['Poster', 1587, 2245], ['Flyer', 1240, 1754], ['Visitenkarte', 1050, 600], ['Logo', 500, 500]];
let shot = 0;
for (const [label, w, h] of FORMATS) {
  await p.goto('http://localhost:5173/app'); await p.waitForSelector(`main button:has-text("${label}")`);
  await p.click(`main button:has-text("${label}")`); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(600);
  const mine = list.filter((t) => t.width === w && t.height === h);
  for (const t of mine) {
    const res = await p.evaluate(async (id) => {
      const d = await (await fetch('/api/templates/' + id, { credentials: 'include' })).json();
      return d.data.pages.length;
    }, t.id);
    await p.evaluate(async (id) => {
      const doc = window.__designhub.doc.getState();
      const t = await (await fetch('/api/templates/' + id, { credentials: 'include' })).json();
      doc.applyTemplatePages(t.data.pages.map((pg) => ({ background: pg.background, elements: pg.elements })));
    }, t.id);
    await wait(900);
    const s = await state();
    ok(`${t.id}: ${res} Seite(n) angewendet, Elemente vorhanden`, s.pages.length >= res && s.els.length >= 3, JSON.stringify(s.pages));
    if (t.id.startsWith('tpl-j-')) await p.screenshot({ path: `${OUT}tpl-${String(++shot).padStart(2, '0')}-${t.id}.png`, clip: { x: 0, y: 56, width: 1440, height: 844 } });
    await p.keyboard.press('Control+z'); await wait(150);
  }
}

// Echter Klickweg im Panel mit mehrseitiger Vorlage
await p.goto('http://localhost:5173/app'); await p.waitForSelector('main button:has-text("Präsentation")');
await p.click('main button:has-text("Präsentation")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(600);
await p.click('button:has-text("Vorlagen")'); await wait(500);
await p.click('text=Pitch-Deck (3 Folien)'); await eventually(async () => (await state()).pages.length === 3, 8000);
ok('Mehrseitige Vorlage über das Panel: 3 Seiten', (await state()).pages.length === 3);
await p.keyboard.press('Control+z'); await wait(200);
ok('Ein Undo nimmt die ganze Vorlage zurück', (await state()).pages.length === 1);

await b.close();
finish(errs);
