// Gemeinsame Helfer für die Ende-zu-Ende-Skripte. Voraussetzung: `npm run dev` läuft (Web :5173, API :4000, DB migriert + geseedet).
// Empfohlen: API mit AUTH_RATE_LIMIT_MAX=1000 starten, sonst greift das Rate-Limit der Registrierung nach ~10 Testläufen.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

export const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
export const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** Startet Chromium. Auf Rechnern mit anderer Browser-Version: E2E_CHROMIUM_PATH setzen. */
export async function launch() {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
  return browser;
}

export function reporter() {
  let fails = 0;
  return {
    ok(name, cond, extra) { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : (extra ?? '')); },
    finish(errs = []) {
      if (errs.length) { fails++; console.log('FAIL Konsolenfehler', JSON.stringify(errs)); }
      console.log(fails ? `${fails} FEHLER` : 'ALLES BESTANDEN');
      process.exitCode = fails ? 1 : 0;
    },
  };
}

/** Seite mit Fehler-Sammler (Konsole + Exceptions). */
export function watchErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  return errs;
}

export const uniqueEmail = (tag) => `${tag}${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

export async function register(page, { email = uniqueEmail('e2e'), name = '' } = {}) {
  await page.goto(`${BASE}/register`);
  if (name) await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', 'correct-horse-1');
  await page.click('button[type=submit]');
  await page.waitForURL('**/app');
  return email;
}

/** Linken Tab (Vorlagen, Elemente, Text, Uploads, Hintergrund, Ebenen) öffnen, falls nicht schon offen. */
export async function openTab(page, name) {
  const btn = page.locator(`nav[aria-label=Werkzeuge] button[aria-label="${name}"]`);
  if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
  await page.waitForSelector(`section[aria-label="${name}"]`);
}

/** Text über das Text-Panel hinzufügen ("Überschrift", "Unterüberschrift", "Fließtext"). */
export async function addTextKind(page, kind) {
  await openTab(page, 'Text');
  await page.locator(`section[aria-label=Text] button:text-is("${kind}")`).click();
}

/** Farbe über den Farbwähler setzen: Auslöser (aria-label) anklicken, Hex eintragen. */
export async function setColor(page, label, hex) {
  await page.click(`button[aria-label="${label}"]`);
  const input = page.locator(`input[aria-label="${label}: Hex"]`);
  await input.fill(hex);
  await input.press('Enter');
}

/** Einfarbiges PNG erzeugen (ohne Abhängigkeiten): für Upload-, Filter- und Zuschnitt-Tests. */
import { deflateSync } from 'node:zlib';
export function makePng(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), len = Buffer.alloc(4), c = Buffer.alloc(4); len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 Bit, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Hilfsfunktionen zum Lesen/Setzen des Editor-Zustands über window.__designhub (nur im Dev-Modus vorhanden). */
export function editorKit(p) {
  const wait = (ms) => p.waitForTimeout(ms);
  const state = () => p.evaluate(() => {
    const d = window.__designhub.doc.getState(), u = window.__designhub.ui.getState();
    const page = d.doc.pages.find((x) => x.id === d.activePageId) ?? d.doc.pages[0];
    return { els: page.elements, bg: page.background, pages: d.doc.pages.map((x) => ({ id: x.id, n: x.elements.length, ids: x.elements.map((e) => e.id) })), active: d.activePageId, sel: u.selectedIds, zoom: u.zoom, pan: u.pan, past: d.past.length, future: d.future.length, cropping: u.croppingId, doc: { w: d.doc.width, h: d.doc.height } };
  });
  const els = async () => (await state()).els;
  const kit = {
    wait, state, els,
    get: async (id) => (await els()).find((e) => e.id === id),
    last: async () => (await els()).at(-1),
    eventually: async (f, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await wait(100); } return false; },
    wrapBox: () => p.locator('[data-testid=canvas-wrap]').boundingBox(),
    toScreen: async (x, y) => { const s = await state(), w = await kit.wrapBox(); return { x: w.x + s.pan.x + x * s.zoom, y: w.y + s.pan.y + y * s.zoom }; },
    centerOf: async (id) => { const e = await kit.get(id); return kit.toScreen(e.x + e.width / 2, e.y + e.height / 2); },
    drag: async (a, c, steps = 10) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps }); await p.mouse.up(); await wait(200); },
    put: (el) => p.evaluate((el) => { window.__designhub.doc.getState().addElement(el); window.__designhub.ui.getState().select([el.id]); }, el),
    select: (ids) => p.evaluate((ids) => window.__designhub.ui.getState().select(ids), ids),
    clear: () => p.evaluate(() => { const d = window.__designhub.doc.getState(); d.removeElements(d.doc.pages[0].elements.map((e) => e.id)); }),
    rect: (id, x, y, w = 150, h = 100, fill = '#7d2ae8') => ({ id, type: 'shape', kind: 'rect', x, y, width: w, height: h, rotation: 0, opacity: 1, locked: false, visible: true, fill, stroke: 'transparent', strokeWidth: 0 }),
    toolbar: (label) => p.locator(`[role=toolbar] [aria-label="${label}"]`),
    newDesign: async () => {
      await p.goto(`${BASE}/app`); await p.waitForSelector('main button:has-text("Instagram Post")');
      await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(500);
    },
    /** Farbe eines Pixels der Zeichenfläche (Bildschirmkoordinaten relativ zur Arbeitsfläche) */
    pixel: (x, y) => p.evaluate(({ x, y }) => { const c = window.__designhub.getStage().toCanvas(); const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2]]; }, { x, y }),
    /** Pixel an einem Punkt der Seite (Dokumentkoordinaten) */
    pagePixel: async (x, y) => { const s = await state(); return kit.pixel(s.pan.x + x * s.zoom, s.pan.y + y * s.zoom); },
  };
  return kit;
}
