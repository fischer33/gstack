// Lineale und Hilfslinien: Anzeige, Erzeugen per Ziehen, Einrasten, Verschieben, Löschen, Ein-/Ausblenden.
import { BASE, OUT, addTextKind, editorKit, launch, register, watchErrors } from './lib.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = watchErrors(p);
let fails = 0;
const ok = (n, c, extra) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra ?? '')); };
const k = editorKit(p);
const { wait, state, els, get, put, select, rect, toScreen, centerOf, drag } = k;
const ui = () => p.evaluate(() => { const u = window.__designhub.ui.getState(); return { guides: u.guides, rulers: u.rulers, zoom: u.zoom, pan: u.pan }; });
const guideLines = () => p.evaluate(() => window.__designhub.getStage().find('.guide').length);

await register(p, { name: 'Ada' });
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(700);

// ---- Anzeige ----
const main = await p.locator('main').boundingBox();
let wrap = await k.wrapBox();
ok('Lineale oben und links sind sichtbar', await p.locator('[data-testid=ruler-top]').isVisible() && await p.locator('[data-testid=ruler-left]').isVisible());
ok('Der Canvas beginnt unterhalb/rechts der Lineale (20 px Versatz)', Math.abs(wrap.x - main.x - 20) < 1 && Math.abs(wrap.y - main.y - 20) < 1, JSON.stringify([wrap, main]));
const rulerPixels = (id) => p.evaluate((id) => { const c = document.querySelector(`[data-testid=${id}]`); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return { colors: set.size, w: c.width, h: c.height }; }, id);
const rt = await rulerPixels('ruler-top'), rl = await rulerPixels('ruler-left');
ok('Lineale sind beschriftet gezeichnet (mehrere Farben: Fläche, Seitenbereich, Striche, Text)', rt.colors >= 3 && rl.colors >= 3, JSON.stringify([rt, rl]));
ok('Linealbreite entspricht der Arbeitsfläche', Math.abs(rt.w - wrap.width) <= 2 && Math.abs(rl.h - wrap.height) <= 2, JSON.stringify([rt.w, wrap.width]));
const before = await p.locator('[data-testid=ruler-top]').screenshot();
await p.click('button[aria-label="Vergrößern"]'); await wait(250);
const after = await p.locator('[data-testid=ruler-top]').screenshot();
ok('Zoomen zeichnet das Lineal neu (andere Teilung)', !before.equals(after));
await p.keyboard.press('Control+0'); await wait(250);
await p.screenshot({ path: OUT + 'd-rulers.png' });

// ---- Hilfslinien erzeugen ----
wrap = await k.wrapBox();
let u = await ui();
const topBox = await p.locator('[data-testid=ruler-top]').boundingBox();
await drag({ x: topBox.x + 300, y: topBox.y + 10 }, { x: wrap.x + 300, y: wrap.y + 200 });
u = await ui();
ok('Aus dem oberen Lineal wird eine waagerechte Hilfslinie (axis y) gezogen', u.guides.length === 1 && u.guides[0].axis === 'y');
const expectedY = Math.round(((wrap.y + 200 - wrap.y - u.pan.y) / u.zoom) * 2) / 2;
ok('Position stimmt (Mausposition in Dokumentpixeln, auf halbe Pixel gerundet)', Math.abs(u.guides[0].pos - expectedY) <= 1, JSON.stringify([u.guides[0].pos, expectedY]));
const leftBox = await p.locator('[data-testid=ruler-left]').boundingBox();
await drag({ x: leftBox.x + 10, y: leftBox.y + 300 }, { x: wrap.x + 400, y: wrap.y + 300 });
u = await ui();
ok('Aus dem linken Lineal wird eine senkrechte Hilfslinie (axis x) gezogen', u.guides.length === 2 && u.guides[1].axis === 'x');
ok('Beide Hilfslinien werden gezeichnet', await guideLines() === 2);
await drag({ x: topBox.x + 100, y: topBox.y + 10 }, { x: topBox.x + 100, y: topBox.y + 12 }); // zurück ins Lineal: verworfen
ok('Loslassen auf dem Lineal erzeugt keine Hilfslinie', (await ui()).guides.length === 2);
await p.screenshot({ path: OUT + 'd-guides.png' });

// ---- Einrasten an Hilfslinien ----
await p.evaluate(() => { const u = window.__designhub.ui.getState(); for (const g of [...u.guides]) u.removeGuide(g.id); const s = window.__designhub.ui.getState(); s.addGuide('x', 700); s.addGuide('y', 800); });
await put(rect('a', 100, 100, 100, 100)); await wait(150);
const z = (await ui()).zoom;
const ca = await centerOf('a');
await p.mouse.move(ca.x, ca.y); await p.mouse.down();
await p.mouse.move(ca.x + (703 - 100) * z, ca.y + (700 - 100) * z, { steps: 14 }); // linke Kante 703 → 700, Unterkante 800 → 800 (direkt)
const activeGuides = await p.evaluate(() => window.__designhub.getStage().find('Line').filter((l) => l.stroke() === '#ff3d8b').length);
await p.mouse.up(); await wait(200);
let a = await get('a');
ok('Element rastet an der senkrechten Hilfslinie ein (linke Kante = 700)', a.x === 700, 'x=' + a.x);
ok('… und an der waagerechten (Unterkante = 800)', a.y + a.height === 800, 'y=' + a.y);
ok('Einrast-Linien waren während des Ziehens sichtbar', activeGuides >= 1, String(activeGuides));

// ---- Hilfslinie verschieben und löschen ----
await select([]); await wait(100);
u = await ui();
const gx = u.guides.find((g) => g.axis === 'x');
const onScreen = await toScreen(gx.pos, 300); // Punkt auf der senkrechten Linie, weit weg vom Element
await p.mouse.move(onScreen.x, onScreen.y); await wait(100);
ok('Cursor über der Hilfslinie zeigt die Verschiebe-Richtung', (await p.evaluate(() => window.__designhub.getStage().container().style.cursor)) === 'col-resize');
await p.mouse.down(); await p.mouse.move(onScreen.x - 60, onScreen.y, { steps: 8 }); await p.mouse.up(); await wait(200);
u = await ui();
const moved = u.guides.find((g) => g.id === gx.id);
ok('Hilfslinie lässt sich verschieben (um ≈ −60 Bildschirmpixel)', Math.abs(moved.pos - (gx.pos - 60 / u.zoom)) <= 1, JSON.stringify([gx.pos, moved.pos]));
ok('Ziehen an der Hilfslinie wählt nichts aus und startet keinen Aufziehrahmen', (await state()).sel.length === 0);
const pos2 = await toScreen(moved.pos, 300);
const wrapNow = await k.wrapBox();
await p.mouse.move(pos2.x, pos2.y); await p.mouse.down(); await p.mouse.move(wrapNow.x - 10, pos2.y, { steps: 8 }); await p.mouse.up(); await wait(200);
ok('Zurück auf das Lineal ziehen löscht die Hilfslinie', !(await ui()).guides.some((g) => g.id === gx.id) && (await ui()).guides.length === 1);

// ---- Ein-/Ausblenden ----
await p.keyboard.press('Shift+R'); await wait(250);
wrap = await k.wrapBox(); const main2 = await p.locator('main').boundingBox();
ok('Umschalt+R blendet Lineale aus (Canvas füllt wieder alles)', await p.locator('[data-testid=rulers]').count() === 0 && Math.abs(wrap.x - main2.x) < 1 && (await ui()).rulers === false);
ok('… und die Hilfslinien werden nicht mehr gezeichnet', await guideLines() === 0);
await p.keyboard.press('Shift+R'); await wait(250);
ok('Erneut: wieder da, Hilfslinien bleiben erhalten', await p.locator('[data-testid=rulers]').count() === 1 && await guideLines() === 1);

// ---- Text-Bearbeitung liegt mit Linealen genau über dem Text ----
await addTextKind(p, 'Überschrift'); await p.waitForSelector('textarea[aria-label="Text bearbeiten"]');
await p.keyboard.type('Ausgerichtet'); await p.keyboard.press('Escape'); await wait(250);
const t = (await els()).at(-1);
await p.mouse.dblclick((await centerOf(t.id)).x, (await centerOf(t.id)).y); await p.waitForSelector('textarea[aria-label="Text bearbeiten"]');
const ta = await p.locator('textarea[aria-label="Text bearbeiten"]').boundingBox();
const exp = await toScreen(t.x, t.y);
ok('Textfeld liegt mit eingeblendeten Linealen deckungsgleich über dem Text', Math.abs(ta.x - exp.x) < 3 && Math.abs(ta.y - exp.y) < 3, JSON.stringify([ta, exp]));
await p.keyboard.press('Escape'); await wait(150);

// ---- Ansicht-Menü ----
await p.click('button[aria-label="Ansicht"]');
ok('Ansicht-Menü zeigt die Zahl der Hilfslinien', await p.locator('button:has-text("Alle Hilfslinien löschen (1)")').count() === 1);
await p.click('button:has-text("Alle Hilfslinien löschen (1)")'); await wait(150);
ok('Alle Hilfslinien löschen', (await ui()).guides.length === 0 && await guideLines() === 0);
await p.click('input[type=checkbox]'); await wait(200);
ok('Haken im Ansicht-Menü blendet die Lineale aus', (await ui()).rulers === false);
await p.click('input[type=checkbox]'); await wait(200);
await p.keyboard.press('Escape');

// ---- Hilfslinien gehören zum Design, nicht zur Sitzung der App ----
await p.evaluate(() => window.__designhub.ui.getState().addGuide('x', 123)); 
await k.newDesign();
ok('Neues Design startet ohne Hilfslinien', (await ui()).guides.length === 0);

ok('Keine Konsolenfehler', errs.length === 0, JSON.stringify(errs));
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
await b.close();
process.exitCode = fails ? 1 : 0;
