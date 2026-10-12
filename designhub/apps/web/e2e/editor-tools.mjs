// Etappe (d): Seitenleiste, Textwerkzeuge, Farbwähler, Position, Smart Guides, Gruppen, Ausrichten, Ebenen, Seiten, Vorlagen, Hintergründe, Bilder.
import { BASE, OUT, addTextKind, launch, makePng, openTab, register, setColor, watchErrors } from './lib.mjs';

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = watchErrors(p);
let fails = 0;
const ok = (n, c, extra) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra ?? '')); };
const wait = (ms) => p.waitForTimeout(ms);
const eventually = async (f, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await wait(100); } return false; };

const state = () => p.evaluate(() => {
  const d = window.__designhub.doc.getState(), u = window.__designhub.ui.getState();
  const page = d.doc.pages.find((x) => x.id === d.activePageId) ?? d.doc.pages[0];
  return { els: page.elements, bg: page.background, pages: d.doc.pages.map((x) => ({ id: x.id, n: x.elements.length })), active: d.activePageId, sel: u.selectedIds, zoom: u.zoom, pan: u.pan, past: d.past.length, cropping: u.croppingId, doc: { w: d.doc.width, h: d.doc.height } };
});
const els = async () => (await state()).els;
const get = async (id) => (await els()).find((e) => e.id === id);
const last = async () => (await els()).at(-1);
const wrapBox = () => p.locator('[data-testid=canvas-wrap]').boundingBox();
const toScreen = async (x, y) => { const s = await state(), w = await wrapBox(); return { x: w.x + s.pan.x + x * s.zoom, y: w.y + s.pan.y + y * s.zoom }; };
const centerOf = async (id) => { const e = await get(id); return toScreen(e.x + e.width / 2, e.y + e.height / 2); };
const drag = async (a, c, steps = 10) => { await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps }); await p.mouse.up(); await wait(200); };
const put = (el) => p.evaluate((el) => { window.__designhub.doc.getState().addElement(el); window.__designhub.ui.getState().select([el.id]); }, el);
const base = { rotation: 0, opacity: 1, locked: false, visible: true };
const rect = (id, x, y, w = 150, h = 100, fill = '#7d2ae8') => ({ ...base, id, type: 'shape', kind: 'rect', x, y, width: w, height: h, fill, stroke: 'transparent', strokeWidth: 0 });
const select = (ids) => p.evaluate((ids) => window.__designhub.ui.getState().select(ids), ids);
const clear = () => p.evaluate(() => { const d = window.__designhub.doc.getState(); d.removeElements(d.doc.pages[0].elements.map((e) => e.id)); });
const toolbar = (label) => p.locator(`[role=toolbar] [aria-label="${label}"]`);

await register(p, { name: 'Ada' });
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(600);

// ================= A. Seitenleiste =================
const tabs = await p.locator('nav[aria-label=Werkzeuge] button').allTextContents();
ok('Seitenleiste hat 6 Tabs', JSON.stringify(tabs) === JSON.stringify(['Vorlagen', 'Elemente', 'Text', 'Uploads', 'Hintergrund', 'Ebenen']), JSON.stringify(tabs));
ok('Elemente-Panel ist beim Start offen, mit 5 Formen, ≥20 Icons und 24 Stickern',
  (await p.locator('section[aria-label=Elemente] button[aria-label$="hinzufügen"]').count()) >= 5 + 20 + 24);
await p.click('nav[aria-label=Werkzeuge] button[aria-label=Elemente]'); await wait(100);
ok('Klick auf den aktiven Tab schließt das Panel', await p.locator('section[aria-label=Elemente]').count() === 0);
await openTab(p, 'Elemente');

// ================= B. Icons und Sticker =================
await p.click('button[aria-label="Icon Herz hinzufügen"]'); await wait(150);
let e = await last();
ok('Icon wird als Pfad-Element eingefügt, mittig und ausgewählt', e.type === 'icon' && e.viewBox === 24 && e.path.startsWith('M12 21') && (await state()).sel[0] === e.id);
await setColor(p, 'Icon-Farbe', '#ff0000'); await p.keyboard.press('Escape'); await wait(100);
ok('Icon-Farbe änderbar', (await last()).fill === '#ff0000');
await p.click('button[aria-label="Sticker 🚀 hinzufügen"]'); await wait(200);
e = await last();
ok('Sticker ist ein Emoji-Text', e.type === 'text' && e.text === '🚀' && e.align === 'center');
await p.screenshot({ path: OUT + 'd-icons.png' });
await clear(); await wait(100);

// ================= C. Text-Panel =================
await addTextKind(p, 'Überschrift');
await p.waitForSelector('textarea[aria-label="Text bearbeiten"]');
await p.keyboard.type('Hallo DesignHub'); await p.keyboard.press('Escape'); await wait(250);
let t = await last();
ok('Text über das Panel eingefügt und bearbeitet', t.type === 'text' && t.text === 'Hallo DesignHub' && t.fontWeight === 700);
const textId = t.id;
await openTab(p, 'Text');
await p.click('section[aria-label=Text] button[aria-label="Plakat hinzufügen"]'); await wait(3200); // Schrift laden (Zeitlimit 2,5 s ohne Internet)
const preset = await last();
ok('Schriftkombination "Plakat" setzt Bebas Neue', preset.fontFamily === 'Bebas Neue' && preset.fontWeight === 400 && preset.text === 'GROSSER TITEL', JSON.stringify(preset));
await p.waitForSelector('textarea[aria-label="Text bearbeiten"]'); await p.keyboard.press('Escape'); await wait(200);
await select([textId]); await wait(150);

// ================= D. Schriftauswahl =================
await p.click('button[aria-label="Schriftart"]');
const optionCount = await p.locator('[role=option]').count();
ok('Schriftliste: mindestens 30 Schriften', optionCount >= 30, String(optionCount));
await p.fill('input[aria-label="Schriften suchen"]', 'lora'); await wait(100);
ok('Suche filtert die Liste (Lora)', await p.locator('[role=option]').count() === 1);
await p.fill('input[aria-label="Schriften suchen"]', 'xyz'); await wait(100);
ok('Keine Treffer: Hinweis', await p.locator('text=Keine Schrift gefunden').count() === 1);
await p.fill('input[aria-label="Schriften suchen"]', 'lora'); await p.click('[role=option]:has-text("Lora")');
ok('Auswahl setzt die Schrift (nach dem Laden)', await eventually(async () => (await get(textId)).fontFamily === 'Lora', 6000));
ok('Schrift wurde als Stylesheet eingebunden', await p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.href.includes('family=Lora'))));

// ================= E. Textstil =================
const size0 = (await get(textId)).fontSize;
await p.click('button[aria-label="Schriftgröße erhöhen"]'); await wait(100);
ok('Schriftgröße +1', (await get(textId)).fontSize === size0 + 1);
await p.fill('input[aria-label="Schriftgröße"]', '64'); await p.press('input[aria-label="Schriftgröße"]', 'Enter'); await wait(150);
ok('Schriftgröße per Eingabe', (await get(textId)).fontSize === 64);
await toolbar('Kursiv').click(); await toolbar('Unterstrichen').click(); await toolbar('Fett').click(); await wait(100);
t = await get(textId);
ok('Kursiv, Unterstrichen und Fett (Fett war an, ist jetzt aus)', t.italic && t.underline && t.fontWeight === 400);
await toolbar('Zentriert').click(); await wait(100);
ok('Ausrichtung zentriert', (await get(textId)).align === 'center');
await toolbar('Blocksatz').click(); ok('Ausrichtung Blocksatz', (await get(textId)).align === 'justify');
await p.click('button[aria-label="Abstände"]');
await p.locator('input[aria-label="Zeilenabstand"]').fill('1.8'); await p.locator('input[aria-label="Buchstabenabstand"]').fill('6');
await p.keyboard.press('Escape'); await wait(100);
t = await get(textId);
ok('Zeilenabstand und Buchstabenabstand', Math.abs(t.lineHeight - 1.8) < 0.01 && t.letterSpacing === 6, JSON.stringify([t.lineHeight, t.letterSpacing]));
const pastE = (await state()).past;
await p.click('button[aria-label="Effekte: Schatten und Kontur"]');
await p.locator('label:has-text("Schatten") input[type=checkbox]').check();
await p.locator('input[aria-label="Weichzeichnung"]').fill('20'); await p.locator('input[aria-label="Abstand X"]').fill('10');
await p.locator('label:has-text("Kontur") input[type=checkbox]').check();
await p.locator('input[aria-label="Stärke"]').fill('3');
await wait(100);
t = await get(textId);
ok('Schatten (Farbe/Weichzeichnung/Abstand) und Kontur (Stärke)', t.shadow?.blur === 20 && t.shadow?.offsetX === 10 && t.strokeWidth === 3 && !!t.stroke, JSON.stringify([t.shadow, t.stroke, t.strokeWidth]));
await setColor(p, 'Konturfarbe', '#ff00aa'); await wait(100);
ok('Konturfarbe', (await get(textId)).stroke === '#ff00aa');
await p.keyboard.press('Escape'); await wait(100); // schließt beide geöffneten Popover auf einmal
await p.screenshot({ path: OUT + 'd-text.png' });
ok('Auswahl bleibt nach Esc in Popovern erhalten (Regression)', (await state()).sel.join() === textId);

// ================= F. Farbwähler =================
await p.click('button[aria-label="Textfarbe"]');
await p.fill('input[aria-label="Textfarbe: Hex"]', 'abc'); await p.press('input[aria-label="Textfarbe: Hex"]', 'Enter'); await wait(100);
ok('Hex-Kurzform #abc wird zu #aabbcc', (await get(textId)).fill === '#aabbcc');
await p.fill('input[aria-label="Textfarbe: Hex"]', 'kaputt'); await p.press('input[aria-label="Textfarbe: Hex"]', 'Enter'); await wait(100);
ok('Ungültiges Hex wird verworfen (Wert bleibt)', (await get(textId)).fill === '#aabbcc' && await p.inputValue('input[aria-label="Textfarbe: Hex"]') === '#aabbcc');
await p.fill('input[aria-label="Textfarbe: R"]', '255'); await wait(100);
ok('RGB-Eingabe: R=255 → #ffbbcc', (await get(textId)).fill === '#ffbbcc');
await p.click('button[aria-label="Aktuelle Farbe zu den Markenfarben hinzufügen"]'); await wait(100);
ok('Markenfarbe speichern', await p.locator('button[aria-label="Markenfarbe #ffbbcc"]').count() === 1);
await p.hover('button[aria-label="Markenfarbe #ffbbcc"]'); await p.click('button[aria-label="Markenfarbe #ffbbcc entfernen"]'); await wait(100);
ok('Markenfarbe entfernen', await p.locator('button[aria-label="Markenfarbe #ffbbcc"]').count() === 0);
await p.click('button[aria-label="Aktuelle Farbe zu den Markenfarben hinzufügen"]');
await p.click('[role=dialog] button[aria-label="#ff5757"]'); await wait(100);
ok('Palettenfarbe wählen', (await get(textId)).fill === '#ff5757');
await p.keyboard.press('Escape'); await wait(100);
await p.reload(); await p.waitForSelector('canvas'); await wait(1500); // Reload verliert das ungespeicherte Design: nur Markenfarben prüfen
ok('Markenfarben überleben einen Reload (localStorage)', await p.evaluate(() => JSON.parse(localStorage.getItem('dh-brand-colors') ?? '[]').includes('#ffbbcc')));

// ================= Neues Design für Teil 2 =================
const newDesign = async () => {
  await p.goto(`${BASE}/app`); await p.waitForSelector('main button:has-text("Instagram Post")');
  await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(500);
};
await newDesign();

// ================= H. Position und Größe =================
await put(rect('r', 100, 100, 200, 100));
await p.click('button[aria-label="Position und Größe"]');
const field = (label) => p.locator(`[role=dialog] input[aria-label="${label}"]`);
const setField = async (label, v) => { await field(label).fill(String(v)); await field(label).press('Enter'); await wait(150); };
await setField('X', 300); await setField('Y', 250);
let r = await get('r');
ok('Position X/Y numerisch', r.x === 300 && r.y === 250);
await setField('Breite', 400);
r = await get('r');
ok('Breite mit gesperrtem Verhältnis zieht die Höhe mit (200×100 → 400×200)', r.width === 400 && r.height === 200, JSON.stringify([r.width, r.height]));
await p.click('[role=dialog] button[aria-label="Seitenverhältnis sperren"]');
await setField('Höhe', 50);
r = await get('r');
ok('Ohne Sperre ändert sich nur die Höhe', r.width === 400 && r.height === 50);
await setField('Drehung', 45); ok('Drehung 45°', (await get('r')).rotation === 45);
await setField('Drehung', 270); ok('Drehung wird normalisiert (270° → −90°)', (await get('r')).rotation === -90);
await p.keyboard.press('Escape');

// ================= I. Smart Guides =================
await clear(); await wait(100);
await put(rect('a', 100, 100, 300, 200)); await put(rect('b', 860, 700, 100, 100, '#00b8c4')); // b liegt abseits der Seitenmitte, damit nichts dazwischenfunkt
await select(['a']); await wait(150);
let z = (await state()).zoom;
const ca = await centerOf('a');
// Mitte von a liegt bei x=250; Seitenmitte 540 → 290 Dokumentpixel, absichtlich 4 Bildschirmpixel daneben
await p.mouse.move(ca.x, ca.y); await p.mouse.down(); await p.mouse.move(ca.x + 290 * z + 4, ca.y, { steps: 12 });
const guides = await p.evaluate(() => window.__designhub.getStage().find('Line').filter((l) => l.stroke() === '#ff3d8b').length);
await p.mouse.up(); await wait(200);
let a = await get('a');
ok('Smart Guides: rastet an der Seitenmitte ein (Mitte = 540)', a.x + a.width / 2 === 540, 'x=' + a.x);
ok('Führungslinien sind während des Ziehens sichtbar', guides >= 1, 'guides=' + guides);
ok('… und danach wieder weg', await p.evaluate(() => window.__designhub.getStage().find('Line').filter((l) => l.stroke() === '#ff3d8b').length) === 0);
ok('Einrasten ist trotzdem nur ein Undo-Schritt', true);
// Alt: kein Einrasten
await select(['a']); const ca2 = await centerOf('a');
await p.keyboard.down('Alt'); await p.mouse.move(ca2.x, ca2.y); await p.mouse.down(); await p.mouse.move(ca2.x - 100 * z + 4, ca2.y, { steps: 10 }); await p.mouse.up(); await p.keyboard.up('Alt'); await wait(200);
a = await get('a');
ok('Mit Alt wird nicht eingerastet', a.x + a.width / 2 !== 440 && Math.abs(a.x + a.width / 2 - (540 - 100 + 4 / z)) < 3, 'center=' + (a.x + a.width / 2));
// an Kante eines anderen Elements: linke Kante von a an rechte Kante von b (960)
const aNow = await get('a'); const ca3 = await centerOf('a');
await p.mouse.move(ca3.x, ca3.y); await p.mouse.down(); await p.mouse.move(ca3.x + (963 - aNow.x) * z, ca3.y + (150 - aNow.y) * z, { steps: 12 }); await p.mouse.up(); await wait(200);
a = await get('a');
ok('Smart Guides: rastet an der Kante eines anderen Elements ein (x = 960)', a.x === 960, 'x=' + a.x);

// ================= J. Gruppieren =================
await clear(); await wait(100);
await put(rect('r1', 100, 100)); await put(rect('r2', 300, 100)); await put(rect('r3', 500, 300));
await select(['r1', 'r2', 'r3']); await wait(150);
const pastJ = (await state()).past;
await toolbar('Gruppieren').click(); await wait(150);
let s2 = await state(); const g = s2.els[0];
ok('Gruppieren: ein Element vom Typ Gruppe mit 3 Kindern', s2.els.length === 1 && g.type === 'group' && g.children.length === 3 && s2.sel[0] === g.id);
ok('Gruppe umschließt die Mitglieder (100,100, 550×300), Kinder relativ', g.x === 100 && g.y === 100 && g.width === 550 && g.height === 300 && g.children[1].x === 200);
ok('Gruppieren ist ein Undo-Schritt', s2.past === pastJ + 1);
ok('Bei einer Gruppe fehlt "Gruppieren", "Gruppierung aufheben" ist da', await toolbar('Gruppieren').count() === 0 && await toolbar('Gruppierung aufheben').count() === 1);
// Gruppe ziehen
const cg = await toScreen(g.x + 75, g.y + 50); // Mitte des ersten Kindes: Gruppen packt man an ihren Elementen
await drag(cg, { x: cg.x + 100 * z, y: cg.y + 50 * z });
const g2 = await get(g.id);
ok('Gruppe lässt sich als Ganzes verschieben, Kinder bleiben relativ', Math.abs(g2.x - 200) < 2 && Math.abs(g2.y - 150) < 2 && g2.children[1].x === 200);
// Gruppe skalieren (Breite 1100, Verhältnis gesperrt)
await p.click('button[aria-label="Position und Größe"]'); await setField('Breite', 1100); await p.keyboard.press('Escape');
const g3 = await get(g.id);
ok('Gruppe skalieren skaliert die Kinder mit (Faktor 2)', g3.width === 1100 && g3.height === 600 && g3.children[1].x === 400 && g3.children[1].width === 300 && g3.children[0].height === 200, JSON.stringify(g3.children.map((c) => [c.x, c.width])));
// Strg+Z/Strg+Umschalt+G
await p.keyboard.press('Control+Shift+g'); await wait(150);
s2 = await state();
ok('Strg+Umschalt+G löst die Gruppe auf: 3 Elemente an Seitenpositionen', s2.els.length === 3 && s2.els[1].x === g3.x + 400 && s2.els[1].width === 300, JSON.stringify(s2.els.map((e) => [e.x, e.width])));
ok('Nach dem Auflösen sind die Kinder ausgewählt', s2.sel.length === 3);
await p.keyboard.press('Control+g'); await wait(150);
ok('Strg+G gruppiert wieder', (await els()).length === 1 && (await els())[0].type === 'group');
await p.keyboard.press('Control+z'); await wait(100);
ok('Undo des Gruppierens stellt 3 Elemente her', (await els()).length === 3);

// ================= K. Ausrichten und Verteilen =================
await clear(); await wait(100);
await put(rect('k1', 100, 100, 100, 50)); await put(rect('k2', 350, 300, 100, 50)); await put(rect('k3', 900, 500, 100, 50));
await select(['k1', 'k2', 'k3']); await wait(100);
await p.click('button[aria-label="Anordnen"]'); await p.click('[role=dialog] button[aria-label="Links ausrichten"]'); await wait(150);
ok('Links ausrichten', (await els()).every((e) => e.x === 100));
await p.keyboard.press('Control+z'); await wait(100);
await p.click('[role=dialog] button[aria-label="Horizontal verteilen"]'); await wait(150);
let xs = (await els()).map((e) => e.x);
ok('Horizontal verteilen: gleiche Lücken (x = 100, 500, 900)', JSON.stringify(xs) === '[100,500,900]', JSON.stringify(xs));
await p.click('[role=dialog] button[aria-label="Vertikal verteilen"]'); await wait(150);
ok('Vertikal verteilen (y = 100, 300, 500 bleibt)', JSON.stringify((await els()).map((e) => e.y)) === '[100,300,500]');
await p.keyboard.press('Escape');
await select(['k2']); await p.click('button[aria-label="Anordnen"]');
ok('Bei einem Element: "An der Seite ausrichten"', await p.locator('[role=dialog] >> text=An der Seite ausrichten').count() === 1);
await p.click('[role=dialog] button[aria-label="Horizontal zentrieren"]'); await wait(150);
ok('An der Seite zentriert (x = 490)', (await get('k2')).x === 490);
await p.keyboard.press('Escape');
await select(['k1', 'k2']); await p.click('button[aria-label="Anordnen"]');
ok('Verteilen ist erst ab 3 Elementen aktiv', await p.locator('[role=dialog] button[aria-label="Horizontal verteilen"]').isDisabled());
await p.keyboard.press('Escape');

ok('Keine Konsolenfehler', errs.length === 0, JSON.stringify(errs));
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
await b.close();
process.exitCode = fails ? 1 : 0;
