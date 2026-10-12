import { BASE, OUT, launch, register } from './lib.mjs';
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (x ?? '')); };
const wait = (ms) => p.waitForTimeout(ms);
const state = () => p.evaluate(() => { const d = window.__designhub.doc.getState(), u = window.__designhub.ui.getState(); const page = d.doc.pages[0]; return { els: page.elements, sel: u.selectedIds, zoom: u.zoom, pan: u.pan }; });
const wrapBox = () => p.locator('[data-testid=canvas-wrap]').boundingBox();
const toScreen = async (x, y) => { const s = await state(), w = await wrapBox(); return { x: w.x + s.pan.x + x * s.zoom, y: w.y + s.pan.y + y * s.zoom }; };
const drag = async (a, c, steps = 10) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps }); await p.mouse.up(); await wait(200); };
const get = async (id) => (await state()).els.find(e => e.id === id);
const corner = (e, fx, fy) => { const r = e.rotation * Math.PI / 180, cx = e.x + e.width / 2, cy = e.y + e.height / 2, lx = (fx - 0.5) * e.width, ly = (fy - 0.5) * e.height; return { x: cx + lx * Math.cos(r) - ly * Math.sin(r), y: cy + lx * Math.sin(r) + ly * Math.cos(r) }; };
const email = 'c2' + Date.now() + '@example.com';
await p.goto(`${BASE}/register`); await p.fill('#email', email); await p.fill('#password', 'correct-horse-1');
await p.click('button[type=submit]'); await p.waitForURL('**/app'); await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(400);
const put = (el) => p.evaluate((el) => { const d = window.__designhub.doc.getState(); d.addElement(el); window.__designhub.ui.getState().select([el.id]); }, el);
const base = { rotation: 0, opacity: 1, locked: false, visible: true };

// --- gedrehtes Rechteck: gegenüberliegende Ecke bleibt fest ---
await put({ ...base, id: 'r', type: 'shape', kind: 'rect', x: 300, y: 300, width: 300, height: 200, rotation: 30, fill: '#7d2ae8', stroke: 'transparent', strokeWidth: 0 }); await wait(200);
let e = await get('r'); const fixedBefore = corner(e, 0, 0);
const handle = corner(e, 1, 1); const hs = await toScreen(handle.x, handle.y);
await drag(hs, { x: hs.x + 70, y: hs.y + 30 });
e = await get('r'); const fixedAfter = corner(e, 0, 0);
ok('Gedrehtes Rechteck: Skalieren am Eckgriff', e.width > 300 || e.height > 200, JSON.stringify([e.width, e.height]));
ok('Gedrehtes Rechteck: gegenüberliegende Ecke bleibt fest', Math.hypot(fixedAfter.x - fixedBefore.x, fixedAfter.y - fixedBefore.y) < 1.5, JSON.stringify([fixedBefore, fixedAfter]));
ok('Gedrehtes Rechteck: Drehwinkel bleibt', Math.abs(e.rotation - 30) < 0.5, 'rot=' + e.rotation);

// --- Kreis (mittig verankert) ---
await put({ ...base, id: 'c', type: 'shape', kind: 'ellipse', x: 100, y: 700, width: 200, height: 200, fill: '#00b8c4', stroke: 'transparent', strokeWidth: 0 }); await wait(200);
e = await get('c'); let h = await toScreen(e.x + e.width, e.y + e.height / 2);
await drag(h, { x: h.x + 60, y: h.y });
let c2 = await get('c');
ok('Kreis: Seitengriff verbreitert zur Ellipse, linker Rand fest', c2.width > 230 && Math.abs(c2.height - 200) < 1 && Math.abs(c2.x - 100) < 1.5, JSON.stringify(c2));

// --- Stern: Breite kommt aus dem Modell, nicht 0 ---
await put({ ...base, id: 's', type: 'shape', kind: 'star', x: 700, y: 100, width: 200, height: 200, fill: '#ffbd59', stroke: 'transparent', strokeWidth: 0, points: 5 }); await wait(200);
e = await get('s'); h = await toScreen(e.x + e.width, e.y + e.height);
await drag(h, { x: h.x + 50, y: h.y + 50 });
const s2 = await get('s');
ok('Stern: Skalieren funktioniert (Größe > Original, nicht auf Minimum gefallen)', s2.width > 220 && s2.height > 220, JSON.stringify([s2.width, s2.height]));

// --- Linie: nur Seitengriffe, Länge ändert sich ---
await put({ ...base, id: 'l', type: 'shape', kind: 'line', x: 100, y: 500, width: 300, height: 24, fill: 'transparent', stroke: '#1e2030', strokeWidth: 6 }); await wait(200);
e = await get('l'); h = await toScreen(e.x + e.width, e.y + e.height / 2);
await drag(h, { x: h.x + 80, y: h.y });
const l2 = await get('l');
ok('Linie: Seitengriff verlängert, Höhe bleibt (Trefferfläche)', l2.width > 340 && Math.abs(l2.height - 24) < 1, JSON.stringify([l2.width, l2.height]));

// --- Text: Seitengriff = Breite, Eckgriff = Schriftgröße ---
await put({ ...base, id: 't', type: 'text', x: 100, y: 850, width: 400, height: 60, text: 'Hallo Welt, dies ist ein längerer Text zum Umbrechen', fontFamily: 'Inter', fontSize: 40, fontWeight: 400, italic: false, underline: false, align: 'left', fill: '#1e2030', lineHeight: 1.2, letterSpacing: 0 }); await wait(300);
e = await get('t'); const hBefore = e.height;
h = await toScreen(e.x + e.width, e.y + e.height / 2);
await drag(h, { x: h.x - 100 * 0.45, y: h.y });
let t2 = await get('t');
ok('Text: Seitengriff ändert nur die Breite (Schriftgröße gleich)', t2.fontSize === 40 && t2.width < e.width - 20, JSON.stringify([t2.fontSize, t2.width]));
await wait(300); t2 = await get('t');
ok('Text: schmaler = mehr Zeilen, gemessene Höhe wächst', t2.height > hBefore, JSON.stringify([hBefore, t2.height]));
e = t2; h = await toScreen(e.x + e.width, e.y + e.height);
await drag(h, { x: h.x + 60, y: h.y + 60 });
t2 = await get('t');
ok('Text: Eckgriff skaliert die Schriftgröße', t2.fontSize > 45, 'fontSize=' + t2.fontSize);
await p.screenshot({ path: OUT + 'c-transforms.png' });

// --- Undo über die ganze Sitzung ---
for (let i = 0; i < 40; i++) await p.keyboard.press('Control+z');
await wait(200);
ok('40× Strg+Z leert das Dokument vollständig', (await state()).els.length === 0);
ok('Keine Konsolenfehler', errs.length === 0, JSON.stringify(errs));
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
process.exitCode = fails ? 1 : 0;
await b.close();
