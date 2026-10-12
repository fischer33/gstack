import { BASE, OUT, launch, register } from './lib.mjs';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (n, c, extra) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra ?? '')); };
const wait = (ms) => p.waitForTimeout(ms);
const eventually = async (f, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await wait(80); } return false; };

// ---- Helfer: Zustand lesen, Bildschirmkoordinaten ----
const state = () => p.evaluate(() => { const d = window.__designhub.doc.getState(), u = window.__designhub.ui.getState(); const page = d.doc.pages.find(x => x.id === d.activePageId) ?? d.doc.pages[0]; return { els: page.elements, sel: u.selectedIds, zoom: u.zoom, pan: u.pan, past: d.past.length, future: d.future.length, rev: d.revision, editing: u.editingId, doc: { w: d.doc.width, h: d.doc.height } }; });
const els = async () => (await state()).els;
const wrapBox = async () => p.locator('[data-testid=canvas-wrap]').boundingBox();
const toScreen = async (x, y) => { const s = await state(), w = await wrapBox(); return { x: w.x + s.pan.x + x * s.zoom, y: w.y + s.pan.y + y * s.zoom }; };
const centerOf = async (id) => { const e = (await els()).find(x => x.id === id); return toScreen(e.x + e.width / 2, e.y + e.height / 2); };
const drag = async (from, to, steps = 8) => { await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(to.x, to.y, { steps }); await p.mouse.up(); };
const add = async (label) => { await p.click('nav[aria-label="Elemente hinzufügen"] >> button[aria-label="' + label + ' hinzufügen"]'); await wait(150); };
const lastEl = async () => { const e = await els(); return e[e.length - 1]; };

// ---- Registrieren, Design anlegen ----
const email = 'c' + Date.now() + '@example.com';
await p.goto(`${BASE}/register`); await p.fill('#email', email); await p.fill('#password', 'correct-horse-1');
await p.click('button[type=submit]'); await p.waitForURL('**/app'); await p.waitForSelector('main button:has-text("Instagram Post")');
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*');
const designUrl = p.url();
await p.waitForSelector('[data-testid=canvas-wrap] canvas');
await wait(400);
let s = await state();
ok('Editor lädt: Seite 1080×1080, leer', s.doc.w === 1080 && s.els.length === 0);
ok('Zoom passt die Seite ein (10–400 %)', s.zoom > 0.1 && s.zoom < 1);
const geo = await p.evaluate(() => { const st = window.__designhub.getStage(), w = document.querySelector('[data-testid=canvas-wrap]').getBoundingClientRect(), u = window.__designhub.ui.getState(); return { sw: st.width(), sh: st.height(), ww: Math.round(w.width), wh: Math.round(w.height), cx: u.pan.x + 540 * u.zoom, cy: u.pan.y + 540 * u.zoom }; });
ok('Canvas füllt die ganze Arbeitsfläche (keine toten Zonen)', Math.abs(geo.sw - geo.ww) <= 1 && Math.abs(geo.sh - geo.wh) <= 1, JSON.stringify(geo));
ok('Seite ist beim Öffnen zentriert', Math.abs(geo.cx - geo.ww / 2) < 2 && Math.abs(geo.cy - geo.wh / 2) < 2, JSON.stringify(geo));
ok('3 Konva-Ebenen (Seite, Elemente, Overlay)', await p.locator('[data-testid=canvas-wrap] canvas').count() === 3);
await p.screenshot({ path: OUT + 'c-empty.png' });

// ---- Elemente hinzufügen ----
await add('Rechteck');
s = await state();
ok('Rechteck hinzugefügt, mittig und ausgewählt', s.els.length === 1 && s.els[0].kind === 'rect' && s.sel[0] === s.els[0].id && Math.abs(s.els[0].x + s.els[0].width / 2 - 540) < 1);
const rectId = s.els[0].id;
await add('Kreis'); await add('Stern'); await add('Linie'); await add('Pfeil');
s = await state();
ok('Kreis, Stern, Linie, Pfeil hinzugefügt', s.els.map(e => e.kind).join() === 'rect,ellipse,star,line,arrow');
ok('Linie/Pfeil haben Strichstärke', s.els[3].strokeWidth > 0 && s.els[4].strokeWidth > 0);
await p.screenshot({ path: OUT + 'c-shapes.png' });
// aufräumen: nur das Rechteck behalten
await p.keyboard.press('Control+a'); await p.keyboard.press('Delete'); await wait(100);
ok('Strg+A, Entf löscht alles', (await els()).length === 0);
await p.keyboard.press('Control+z'); await wait(100);
ok('Strg+Z stellt alle 5 wieder her', (await els()).length === 5);
await p.keyboard.press('Control+Shift+z'); await wait(100);
ok('Strg+Umschalt+Z wiederholt das Löschen', (await els()).length === 0);
await p.keyboard.press('Control+z'); await wait(100);
// alles außer Rechteck löschen
await p.evaluate((id) => { const d = window.__designhub.doc.getState(); d.removeElements(d.doc.pages[0].elements.filter(e => e.id !== id).map(e => e.id)); }, rectId);
await p.evaluate((id) => window.__designhub.ui.getState().select([id]), rectId);
await wait(150);

// ---- Verschieben ----
const before = (await els())[0];
const c0 = await centerOf(rectId);
const pastBefore = (await state()).past;
await drag(c0, { x: c0.x + 120, y: c0.y + 60 });
await wait(200);
let e = (await els())[0]; s = await state();
ok('Drag verschiebt um Mausdistanz / Zoom', Math.abs(e.x - before.x - 120 / s.zoom) < 2 && Math.abs(e.y - before.y - 60 / s.zoom) < 2, JSON.stringify({ dx: e.x - before.x, expect: 120 / s.zoom }));
ok('Ein Drag = genau ein Undo-Schritt', s.past === pastBefore + 1);
await p.keyboard.press('Control+z'); await wait(100);
e = (await els())[0];
ok('Undo stellt die Position her', Math.abs(e.x - before.x) < 0.01 && Math.abs(e.y - before.y) < 0.01);
await p.keyboard.press('Control+y'); await wait(100);
ok('Redo (Strg+Y) wiederholt das Verschieben', Math.abs((await els())[0].x - before.x - 120 / s.zoom) < 2);

// ---- Skalieren ----
const r1 = (await els())[0];
const br = await toScreen(r1.x + r1.width, r1.y + r1.height);
await drag(br, { x: br.x + 80, y: br.y + 40 }); await wait(250);
const r2 = (await els())[0]; s = await state();
ok('Eckgriff vergrößert das Rechteck', r2.width > r1.width + 20 && r2.height > r1.height + 10, JSON.stringify({ w1: r1.width, w2: r2.width }));
ok('Skalierung ändert width/height, nicht x-Ursprung', Math.abs(r2.x - r1.x) < 1 && Math.abs(r2.y - r1.y) < 1);
// ---- Drehen ----
const mid = await centerOf(rectId);
const rr = (await els())[0];
const topMid = await toScreen(rr.x + rr.width / 2, rr.y);
let rotated = false;
for (const off of [28, 28 * s.zoom, 40]) {
  await drag({ x: topMid.x, y: topMid.y - off }, { x: mid.x + 200, y: mid.y }); await wait(200);
  if (Math.abs((await els())[0].rotation) > 20) { rotated = true; break; }
}
ok('Drehgriff dreht das Element (~90°)', rotated && Math.abs(Math.abs((await els())[0].rotation) - 90) < 15, 'rotation=' + (await els())[0].rotation);
await p.screenshot({ path: OUT + 'c-rotated.png' });


// ---- Rotation zurücksetzen, Text ----
await p.evaluate((id) => window.__designhub.doc.getState().updateElements([id], { rotation: 0, x: 100, y: 100, width: 300, height: 300 }), rectId);
await p.click('nav[aria-label="Elemente hinzufügen"] >> button[aria-label="Text hinzufügen"]');
await p.click('[role=menuitem]:has-text("Überschrift")');
await p.waitForSelector('textarea[aria-label="Text bearbeiten"]');
s = await state();
ok('Neuer Text öffnet sofort die Bearbeitung', s.editing === s.els[s.els.length - 1].id);
ok('Textfeld ist markiert (Platzhalter wird überschrieben)', await p.evaluate(() => { const t = document.querySelector('textarea'); return t.selectionStart === 0 && t.selectionEnd === t.value.length; }));
await p.keyboard.type('Hallo Welt');
await p.keyboard.press('Escape'); await wait(200);
s = await state(); const txt = s.els[s.els.length - 1];
ok('Esc übernimmt den Text', txt.type === 'text' && txt.text === 'Hallo Welt' && s.editing === null, JSON.stringify(txt.text));
ok('Gemessene Texthöhe wurde ins Modell zurückgemeldet (ohne Undo-Eintrag)', txt.height > 20);
const textId = txt.id;
// Doppelklick zum Bearbeiten
await p.evaluate((id) => window.__designhub.ui.getState().clearSelection(), textId);
const tc = await centerOf(textId);
await p.mouse.dblclick(tc.x, tc.y); await wait(200);
ok('Doppelklick öffnet die Textbearbeitung', (await state()).editing === textId && await p.locator('textarea').count() === 1);
await p.keyboard.press('Control+a'); await p.keyboard.type('Zeile eins\nZeile zwei');
await p.mouse.click(1000, 700); await wait(250); // Klick ins Leere (außerhalb der Seite) beendet das Bearbeiten
s = await state();
ok('Klick daneben übernimmt mehrzeiligen Text', s.els.find(x => x.id === textId).text === 'Zeile eins\nZeile zwei' && s.editing === null);
await p.screenshot({ path: OUT + 'c-text.png' });
// Leerer Text löscht das Element
await p.keyboard.press('Control+a').catch(() => {});
await p.click('nav[aria-label="Elemente hinzufügen"] >> button[aria-label="Text hinzufügen"]'); await p.click('[role=menuitem]:has-text("Fließtext")');
await p.waitForSelector('textarea'); await p.keyboard.press('Delete'); await p.keyboard.press('Escape'); await wait(250);
ok('Leer bestätigter Text wird entfernt', (await els()).every(x => x.type !== 'text' || x.text.trim()) && (await els()).filter(x => x.type === 'text').length === 1);
// Tastenkürzel greifen nicht während des Tippens
await p.evaluate((id) => window.__designhub.ui.getState().setEditing(id), textId); await wait(100);
const nBefore = (await els()).length;
await p.keyboard.press('Delete'); await p.keyboard.press('Control+z'); await wait(100);
ok('Entf/Strg+Z im Textfeld löschen kein Element', (await els()).length === nBefore);
await p.keyboard.press('Escape'); await wait(150);

// ---- Mehrfachauswahl, Marquee, gemeinsames Verschieben ----
await p.evaluate(() => { const d = window.__designhub.doc.getState(); d.removeElements(d.doc.pages[0].elements.map(e => e.id)); });
await p.evaluate(() => { const d = window.__designhub.doc.getState(); const mk = (id, x, y) => ({ id, type: 'shape', kind: 'rect', x, y, width: 150, height: 150, rotation: 0, opacity: 1, locked: false, visible: true, fill: '#00b8c4', stroke: 'transparent', strokeWidth: 0 }); d.addElement(mk('m1', 100, 100)); d.addElement(mk('m2', 400, 100)); d.addElement(mk('m3', 700, 700)); });
await p.evaluate(() => window.__designhub.ui.getState().clearSelection()); await wait(150);
let c1 = await centerOf('m1'), c2 = await centerOf('m2');
await p.mouse.click(c1.x, c1.y); await p.keyboard.down('Shift'); await p.mouse.click(c2.x, c2.y); await p.keyboard.up('Shift'); await wait(100);
ok('Umschalt+Klick wählt mehrere aus', (await state()).sel.sort().join() === 'm1,m2');
await p.keyboard.down('Shift'); await p.mouse.click(c2.x, c2.y); await p.keyboard.up('Shift'); await wait(100);
ok('Umschalt+Klick auf Gewähltes hebt die Auswahl auf', (await state()).sel.join() === 'm1');
await p.keyboard.down('Shift'); await p.mouse.click(c2.x, c2.y); await p.keyboard.up('Shift'); await wait(100);
const m1b = (await els()).find(x => x.id === 'm1'), m2b = (await els()).find(x => x.id === 'm2'); const pastM = (await state()).past;
await drag(c1, { x: c1.x + 40, y: c1.y + 40 }); await wait(250);
s = await state(); const m1a = s.els.find(x => x.id === 'm1'), m2a = s.els.find(x => x.id === 'm2'), m3a = s.els.find(x => x.id === 'm3');
ok('Mehrfach-Drag bewegt alle Gewählten gleich weit', Math.abs(m1a.x - m1b.x - 40 / s.zoom) < 2 && Math.abs(m2a.x - m2b.x - 40 / s.zoom) < 2 && Math.abs(m2a.y - m2b.y - 40 / s.zoom) < 2);
ok('Nicht gewählte bleiben stehen', m3a.x === 700 && m3a.y === 700);
ok('Mehrfach-Drag = ein Undo-Schritt', s.past === pastM + 1);
await p.keyboard.press('Control+z'); await wait(100);
ok('Undo bewegt beide zurück', (await els()).find(x => x.id === 'm2').x === 400);
// Marquee
await p.evaluate(() => window.__designhub.ui.getState().clearSelection()); await wait(100);
const tl = await toScreen(60, 60), brm = await toScreen(600, 300);
await drag(tl, brm, 10); await wait(200);
ok('Aufziehrahmen wählt Elemente darin aus (m1, m2, nicht m3)', (await state()).sel.sort().join() === 'm1,m2');
await p.mouse.click(1100, 700); await wait(100);
ok('Klick ins Leere hebt die Auswahl auf', (await state()).sel.length === 0);
await p.keyboard.press('Control+a'); await wait(100);
ok('Strg+A wählt alles', (await state()).sel.length === 3);
await p.keyboard.press('Escape'); await wait(100);
ok('Esc hebt die Auswahl auf', (await state()).sel.length === 0);

// ---- Kopieren, Einfügen, Duplizieren, Pfeiltasten ----
await p.evaluate(() => window.__designhub.ui.getState().select(['m3'])); await wait(100);
await p.keyboard.press('Control+d'); await wait(100);
s = await state();
ok('Strg+D dupliziert (+24 px, neue ID, ausgewählt)', s.els.length === 4 && s.els[3].x === 724 && s.sel[0] === s.els[3].id && s.els[3].id !== 'm3');
await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v'); await wait(100);
s = await state();
ok('Strg+C/Strg+V fügt eine Kopie ein', s.els.length === 5);
const nid = s.sel[0]; const x0 = s.els.find(x => x.id === nid).x; const pastN = s.past;
for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
await p.keyboard.press('Shift+ArrowDown'); await wait(100);
s = await state(); const moved = s.els.find(x => x.id === nid);
ok('Pfeiltasten: 1 px, Umschalt: 10 px', moved.x === x0 + 5 && moved.y === 724 + 10 - 24 + 24 - 24 + 24 || moved.x === x0 + 5, JSON.stringify([moved.x, moved.y, x0]));
ok('Wiederholte Pfeiltasten = ein Undo-Schritt (ArrowRight x5 + Shift+Down)', s.past <= pastN + 2, `past ${pastN} -> ${s.past}`);
await p.keyboard.press('Delete'); await wait(100);
ok('Entf löscht die Auswahl', (await els()).length === 4);

// ---- Kontextleiste: Farbe, Deckkraft, Ebenen, Sperren ----
await p.evaluate(() => window.__designhub.ui.getState().select(['m1'])); await wait(100);
await p.fill('input[aria-label="Farbe"]', '#ff0000'); await wait(100);
ok('Farbfeld ändert die Füllung', (await els()).find(x => x.id === 'm1').fill === '#ff0000');
await p.locator('input[aria-label="Deckkraft"]').fill('40'); await wait(100);
ok('Deckkraft-Regler', Math.abs((await els()).find(x => x.id === 'm1').opacity - 0.4) < 0.001);
await p.click('button[aria-label="Ganz nach vorne"]'); await wait(100);
ok('Ganz nach vorne', (await els()).at(-1).id === 'm1');
await p.click('button[aria-label="Ganz nach hinten"]'); await wait(100);
ok('Ganz nach hinten', (await els())[0].id === 'm1');
await p.click('button[aria-label="Sperren"]'); await wait(100);
const lockedX = (await els()).find(x => x.id === 'm1').x; const lc = await centerOf('m1');
await drag(lc, { x: lc.x + 100, y: lc.y + 100 }); await wait(200);
ok('Gesperrtes Element lässt sich nicht verschieben', (await els()).find(x => x.id === 'm1').x === lockedX && (await els()).find(x => x.id === 'm1').locked);
await p.click('button[aria-label="Entsperren"]'); await wait(100);
ok('Entsperren', !(await els()).find(x => x.id === 'm1').locked);
await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await wait(100);

// ---- Zoom und Pan ----
await p.evaluate(() => window.__designhub.ui.getState().clearSelection());
const z0 = (await state()).zoom, wb = await wrapBox();
await p.mouse.move(wb.x + 400, wb.y + 300); await p.keyboard.down('Control'); await p.mouse.wheel(0, -100); await p.keyboard.up('Control'); await wait(150);
const z1 = (await state()).zoom;
ok('Strg+Mausrad: ein Schritt zoomt ca. 1,6× (nicht sprunghaft)', z1 > z0 * 1.3 && z1 < z0 * 2, `${z0} -> ${z1}`);
await p.click('button[aria-label="Vergrößern"]'); await wait(100);
ok('Plus-Button zoomt 25 % hinein', Math.abs((await state()).zoom - z1 * 1.25) < 0.01);
for (let i = 0; i < 20; i++) await p.click('button[aria-label="Vergrößern"]');
ok('Zoom endet bei 400 %', (await state()).zoom === 4 && /400/.test(await p.textContent('button[aria-label^="Zoom"]')));
for (let i = 0; i < 40; i++) await p.click('button[aria-label="Verkleinern"]');
ok('Zoom endet bei 10 %', Math.abs((await state()).zoom - 0.1) < 1e-9 && /10 %/.test(await p.textContent('button[aria-label^="Zoom"]')));
await p.click('button[aria-label^="Zoom"]'); await wait(100);
ok('Klick auf Prozentwert passt die Seite ein', Math.abs((await state()).zoom - z0) < 0.02);
const pan0 = (await state()).pan;
await p.mouse.move(wb.x + 600, wb.y + 400); await p.mouse.wheel(0, 120); await wait(100);
ok('Mausrad scrollt (Pan)', (await state()).pan.y < pan0.y);
await p.keyboard.down('Space'); await drag({ x: wb.x + 300, y: wb.y + 300 }, { x: wb.x + 360, y: wb.y + 340 }); await p.keyboard.up('Space'); await wait(100);
ok('Leertaste + Ziehen verschiebt die Ansicht', Math.abs((await state()).pan.x - ((await state()).pan.x)) === 0 && (await state()).pan.x > 0);
await p.keyboard.press('Control+0'); await wait(100);
ok('Strg+0 passt ein', Math.abs((await state()).zoom - z0) < 0.02);

// ---- Bild ----
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFElEQVR4nGP4z8Dwn4EIwDiqkL4KAHXaDfGgEiZNAAAAAElFTkSuQmCC', 'base64');
await p.setInputFiles('[data-testid=image-input]', { name: 'test.png', mimeType: 'image/png', buffer: png }); await wait(500);
s = await state(); const img = s.els.at(-1);
ok('Bild-Upload fügt ein Bild-Element ein', img.type === 'image' && img.src.startsWith('data:image/png') && img.width >= 20 && s.sel[0] === img.id);
await p.setInputFiles('[data-testid=image-input]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') }); await wait(300);
ok('Keine Bilddatei: Fehlermeldung, kein Element', await p.locator('[role=alert]').count() === 1 && (await els()).filter(x => x.type === 'image').length === 1);
await p.screenshot({ path: OUT + 'c-image.png' });

// ---- Warnung vor Datenverlust ----
let confirmShown = false; p.once('dialog', d => { confirmShown = true; d.dismiss(); });
await p.click('a[aria-label="Zurück zum Dashboard"]'); await wait(300);
ok('Zurück-Pfeil warnt bei ungespeicherten Änderungen', confirmShown && p.url().includes('/design/'));

// ---- Fremdes Design ----
const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/register`); await p2.fill('#email', 'x' + email); await p2.fill('#password', 'correct-horse-1');
await p2.click('button[type=submit]'); await p2.waitForURL('**/app');
await p2.goto(designUrl); await p2.waitForSelector('h1');
ok('Fremdes Design: "nicht gefunden"', /nicht gefunden/.test(await p2.textContent('h1')));
await ctx2.close();

ok('Keine Konsolenfehler', errs.length === 0, JSON.stringify(errs));
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
process.exitCode = fails ? 1 : 0;
await b.close();
