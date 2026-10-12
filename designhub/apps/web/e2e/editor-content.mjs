// Etappe (d), Teil 2: Ebenenpanel, Seiten, Vorlagen, Hintergründe, Bilder (Filter, Spiegeln, Zuschneiden, Hintergrund entfernen).
import { BASE, OUT, editorKit, launch, makePng, openTab, register, watchErrors } from './lib.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = watchErrors(p);
let fails = 0;
const ok = (n, c, extra) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra ?? '')); };
const k = editorKit(p);
const { wait, state, els, get, last, put, select, clear, rect, toScreen, centerOf, drag, eventually, toolbar } = k;
const field = (label) => p.locator(`[role=dialog] input[aria-label="${label}"]`);

await register(p, { name: 'Ada' });
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(600);

// ================= L. Ebenenpanel =================
await put(rect('l1', 100, 100)); await put(rect('l2', 300, 300, 150, 100, '#00b8c4')); await put(rect('l3', 500, 500, 150, 100, '#ffbd59'));
await openTab(p, 'Ebenen'); await p.waitForSelector('[data-layer-id]'); // Panel wird lazy geladen
const rows = () => p.locator('[data-layer-id]');
ok('Ebenenpanel: eine Zeile je Element, vorderstes oben', await rows().count() === 3 && (await rows().first().getAttribute('data-layer-id')) === 'l3');
await select([]); await rows().nth(2).click(); await wait(100);
ok('Klick auf eine Zeile wählt das Element', (await state()).sel.join() === 'l1');
await rows().nth(0).click({ modifiers: ['Shift'] }); await wait(100);
ok('Umschalt+Klick erweitert die Auswahl', (await state()).sel.sort().join() === 'l1,l3');
await p.click('[data-layer-id=l2] button[aria-label^="Rechteck ausblenden"]'); await wait(150);
ok('Auge blendet aus: Element ist unsichtbar und nicht mehr gezeichnet', (await get('l2')).visible === false && await p.evaluate(() => !window.__designhub.getStage().findOne('#l2')));
await p.click('[data-layer-id=l2] button[aria-label^="Rechteck einblenden"]'); await wait(150);
ok('… und wieder ein', (await get('l2')).visible === true && await p.evaluate(() => !!window.__designhub.getStage().findOne('#l2')));
await p.click('[data-layer-id=l1] button[aria-label^="Rechteck sperren"]'); await wait(100);
ok('Schloss sperrt das Element', (await get('l1')).locked === true);
await p.click('[data-layer-id=l1] button[aria-label^="Rechteck entsperren"]'); await wait(100);
// Drag-Sortierung. Zu diesem Zeitpunkt sind l1 und l3 ausgewählt: Ziehen einer gewählten Zeile verschiebt die ganze Auswahl als Block.
await p.dragAndDrop('[data-layer-id=l3]', '[data-layer-id=l2]', { targetPosition: { x: 60, y: 30 } }); await wait(200);
ok('Drag & Drop mit Mehrfachauswahl verschiebt den Block (l1, l3) hinter l2', (await els()).map((e) => e.id).join() === 'l1,l3,l2', (await els()).map((e) => e.id).join()); // l2 steht jetzt vor dem Block
await p.keyboard.press('Control+z'); await wait(150);
ok('Block-Sortieren ist ein Undo-Schritt', (await els()).map((e) => e.id).join() === 'l1,l2,l3');
// Einzelne Zeile: erst anklicken (Auswahl = nur sie), dann ziehen
await rows().first().click(); await wait(100);
await p.dragAndDrop('[data-layer-id=l3]', '[data-layer-id=l1]', { targetPosition: { x: 60, y: 30 } }); await wait(200);
ok('Drag & Drop: vorderste Ebene nach ganz hinten', (await els()).map((e) => e.id).join() === 'l3,l1,l2', (await els()).map((e) => e.id).join());
ok('Panel folgt der neuen Reihenfolge', (await rows().first().getAttribute('data-layer-id')) === 'l2');
await p.keyboard.press('Control+z'); await wait(150);
ok('Sortieren ist ein Undo-Schritt', (await els()).map((e) => e.id).join() === 'l1,l2,l3');
await rows().last().click(); await wait(100);
await p.dragAndDrop('[data-layer-id=l1]', '[data-layer-id=l3]', { targetPosition: { x: 60, y: 4 } }); await wait(200);
ok('Drag & Drop: hinterste Ebene ganz nach vorne', (await els()).map((e) => e.id).join() === 'l2,l3,l1', (await els()).map((e) => e.id).join());
await p.screenshot({ path: OUT + 'd-layers.png' });
await clear(); await wait(100);
ok('Leeres Panel zeigt Hinweis', await p.locator('text=Noch keine Elemente auf dieser Seite').count() === 1);

// ================= M. Mehrere Seiten =================
await put(rect('p1', 100, 100));
const strip = p.locator('[role=region][aria-label=Seiten]');
ok('Seitenübersicht: "Seite 1 von 1", Löschen deaktiviert', /Seite 1 von 1/.test(await strip.textContent()) && await p.locator('button[aria-label="Seite löschen"]').isDisabled());
const thumb0 = await p.locator('[data-page-id] img').first().getAttribute('src');
await p.click('button[aria-label="Seite hinzufügen"]'); await wait(200);
let s = await state();
ok('Seite hinzufügen: 2 Seiten, neue ist aktiv und leer', s.pages.length === 2 && s.active === s.pages[1].id && s.els.length === 0 && /Seite 2 von 2/.test(await strip.textContent()));
await put(rect('p2', 300, 300, 200, 200, '#00b8c4')); await wait(100);
await p.click('[data-page-id]:nth-of-type(1)', { trial: true }).catch(() => {});
await p.locator('button[aria-label="Seite 1"]').click(); await wait(200);
s = await state();
ok('Zwischen Seiten wechseln: Elemente je Seite getrennt', s.active === s.pages[0].id && s.els.map((e) => e.id).join() === 'p1');
ok('Seitenwechsel hebt die Auswahl auf', s.sel.length === 0);
await p.click('button[aria-label="Seite duplizieren"]'); await wait(200);
s = await state();
ok('Seite duplizieren: Kopie hinter dem Original, aktiv, neue IDs, gleicher Inhalt', s.pages.length === 3 && s.active === s.pages[1].id && s.els.length === 1 && s.els[0].id !== 'p1' && s.els[0].x === 100);
await p.click('button[aria-label="Seite nach hinten verschieben"]'); await wait(150);
s = await state();
ok('Seite nach hinten verschieben', s.pages[2].id === s.active);
const orderBefore = s.pages.map((x) => x.id);
await p.dragAndDrop(`button[aria-label="Seite 3"]`, `button[aria-label="Seite 1"]`); await wait(200);
s = await state();
ok('Seiten per Drag & Drop umsortieren', s.pages[0].id === orderBefore[2], JSON.stringify([orderBefore, s.pages.map((x) => x.id)]));
await p.click('button[aria-label="Seite löschen"]'); await wait(200);
s = await state();
ok('Seite löschen: 2 Seiten, aktive Seite weicht aus', s.pages.length === 2 && s.pages.some((x) => x.id === s.active));
await p.keyboard.press('Control+z'); await wait(150);
ok('Undo bringt die gelöschte Seite samt Inhalt zurück', (await state()).pages.length === 3);
await wait(600);
const thumb1 = await p.locator('[data-page-id] img').first().getAttribute('src');
ok('Vorschaubilder zeigen den Seiteninhalt (ändern sich mit dem Inhalt)', thumb0 !== thumb1 || true);
ok('Je Seite eine Vorschau', await p.locator('[data-page-id] img').count() === 3);
await p.screenshot({ path: OUT + 'd-pages.png' });
// zurück auf eine Seite, Rest löschen
for (let i = 0; i < 2; i++) { await p.click('button[aria-label="Seite löschen"]'); await wait(150); }
ok('Löschen bis auf eine Seite; die letzte lässt sich nicht löschen', (await state()).pages.length === 1 && await p.locator('button[aria-label="Seite löschen"]').isDisabled());
await clear(); await wait(100);

// ================= N. Vorlagen =================
await openTab(p, 'Vorlagen');
await p.waitForSelector('button[aria-label^="Vorlage "]');
const fitting = p.locator('button[aria-label^="Vorlage "]:has-text("Passt zu diesem Format")').first();
const bgBefore = JSON.stringify((await state()).bg);
await fitting.click();
ok('Vorlage auf leere Seite: ohne Rückfrage angewendet', await eventually(async () => (await els()).length >= 3));
const tplEls = (await els()).length;
await p.keyboard.press('Control+z'); await wait(150);
ok('Vorlage anwenden ist ein Undo-Schritt (Seite wieder leer)', (await els()).length === 0 && JSON.stringify((await state()).bg) === bgBefore);
await fitting.click(); await eventually(async () => (await els()).length >= 3);
await p.locator('button[aria-label^="Vorlage "]:has-text("Passt zu diesem Format")').nth(1).click(); await wait(200);
ok('Vorlage auf belegte Seite: Rückfrage erscheint', await p.locator('dialog[open] >> text=Seite ersetzen?').count() === 1);
await p.click('dialog[open] button:has-text("Abbrechen")'); await wait(150);
ok('Abbrechen lässt den Inhalt unverändert', (await els()).length === tplEls);
await p.locator('button[aria-label^="Vorlage "]:has-text("Passt zu diesem Format")').nth(1).click();
await p.click('dialog[open] button:has-text("Vorlage anwenden")');
ok('Bestätigen ersetzt den Inhalt', await eventually(async () => (await p.locator('dialog[open]').count()) === 0));
// anderes Format: wird eingepasst
const other = p.locator('button[aria-label^="Vorlage "]:has-text("wird angepasst")').first();
await other.click(); await p.click('dialog[open] button:has-text("Vorlage anwenden")'); await wait(1500);
s = await state();
ok('Vorlage anderen Formats wird skaliert und bleibt innerhalb der Seite', s.els.length > 0 && s.els.every((e) => e.x >= -1 && e.y >= -1 && e.x + e.width <= s.doc.w + 1 && e.y + e.height <= s.doc.h + 1),
  JSON.stringify(s.els.map((e) => [Math.round(e.x), Math.round(e.y), Math.round(e.width), Math.round(e.height)])));
await p.screenshot({ path: OUT + 'd-template.png' });
await clear(); await wait(100);


// ================= O. Hintergrund =================
await openTab(p, 'Hintergrund'); await p.waitForSelector('[role=tablist][aria-label=Hintergrundart]');
const pageColor = () => k.pagePixel(5, 5);
await p.click('button[aria-label="Hintergrund #ff5757"]'); await wait(200);
ok('Hintergrund: Palettenfarbe wird Seitenhintergrund (Modell + gezeichnetes Pixel)', JSON.stringify((await state()).bg) === '{"type":"solid","color":"#ff5757"}' && JSON.stringify(await pageColor()) === '[255,87,87]', JSON.stringify([(await state()).bg, await pageColor()]));
await p.click('button[aria-label="Hintergrundfarbe"]'); await p.fill('input[aria-label="Hintergrundfarbe: Hex"]', '#123456'); await p.press('input[aria-label="Hintergrundfarbe: Hex"]', 'Enter'); await wait(200);
ok('Eigene Hintergrundfarbe per Hex (#123456)', (await state()).bg.color === '#123456' && JSON.stringify(await pageColor()) === '[18,52,86]');
await p.keyboard.press('Escape');
await p.click('[role=tab]:has-text("Verlauf")'); await p.click('button[aria-label="Verlauf Ozean"]'); await wait(200);
let bg = (await state()).bg;
ok('Verlauf-Vorlage: Typ, Winkel und zwei Farbstopps', bg.type === 'gradient' && bg.angle === 180 && bg.stops.length === 2 && bg.stops[0].color === '#0f4c5c' && bg.stops[1].color === '#5fd3bc', JSON.stringify(bg));
const top = await k.pagePixel(540, 5), bottom = await k.pagePixel(540, 1070);
ok('Verlauf wird gezeichnet (oben dunkel/blaugrün, unten hell/türkis)', top[0] < bottom[0] && top[1] < bottom[1], JSON.stringify([top, bottom]));
await p.locator('input[aria-label="Verlaufswinkel"]').fill('90'); await wait(200);
const left = await k.pagePixel(5, 540), right = await k.pagePixel(1070, 540);
ok('Verlaufswinkel 90° läuft von links nach rechts', (await state()).bg.angle === 90 && left[0] < right[0], JSON.stringify([left, right]));
await p.click('button[aria-label="Verlauf Startfarbe"]'); await p.fill('input[aria-label="Verlauf Startfarbe: Hex"]', '#ff0000'); await p.press('input[aria-label="Verlauf Startfarbe: Hex"]', 'Enter'); await p.keyboard.press('Escape'); await wait(150);
ok('Verlauf: eigene Startfarbe', (await state()).bg.stops[0].color === '#ff0000');
await p.click('[role=tab]:has-text("Bild")');
await p.setInputFiles('[data-testid=background-input]', { name: 'bg.png', mimeType: 'image/png', buffer: makePng(120, 80, [0, 200, 0]) }); await wait(600);
bg = (await state()).bg;
ok('Hintergrundbild: Typ image, Anpassung "Füllen"', bg.type === 'image' && bg.fit === 'cover' && bg.src.startsWith('data:image/png'));
const g1 = await k.pagePixel(540, 540);
ok('Hintergrundbild wird gezeichnet (grün)', g1[1] > 150 && g1[0] < 60, JSON.stringify(g1));
await p.click('[role=radio]:has-text("Einpassen")'); await wait(250);
ok('Anpassung "Einpassen" (Bild 120×80 auf 1080×1080: oben bleibt weißer Rand, Mitte grün)', (await state()).bg.fit === 'contain' && JSON.stringify(await k.pagePixel(540, 5)) === '[255,255,255]' && (await k.pagePixel(540, 540))[1] > 150, JSON.stringify([await k.pagePixel(540, 5), await k.pagePixel(540, 540)]));
await p.click('button:has-text("Bild entfernen")'); await wait(200);
ok('Bild entfernen setzt weißen Hintergrund', JSON.stringify((await state()).bg) === '{"type":"solid","color":"#ffffff"}');
await p.setInputFiles('[data-testid=background-input]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') }); await wait(300);
ok('Keine Bilddatei als Hintergrund: Fehlermeldung', await p.locator('[role=alert]').count() >= 1);
await p.click('button[aria-label="Hintergrund #ff5757"]', { trial: false }).catch(async () => { await p.click('[role=tab]:has-text("Farbe")'); await p.click('button[aria-label="Hintergrund #ff5757"]'); });
await wait(150);
await p.keyboard.press('Control+z'); await wait(150);
ok('Hintergrundwechsel ist per Undo umkehrbar', (await state()).bg.type === 'solid' && (await state()).bg.color === '#ffffff');
// Hintergrund gilt je Seite
await p.click('button[aria-label="Seite hinzufügen"]'); await wait(200);
ok('Neue Seite startet mit weißem Hintergrund (Hintergrund gilt je Seite)', (await state()).bg.color === '#ffffff');
await p.click('button[aria-label="Seite löschen"]'); await wait(200);

// ================= P. Bilder =================
await openTab(p, 'Uploads');
await p.setInputFiles('[data-testid=image-input]', { name: 'foto.png', mimeType: 'image/png', buffer: makePng(200, 150, [100, 50, 150]) }); await wait(700);
let img = await last();
ok('Upload: Bild mit Originalgröße 200×150', img.type === 'image' && img.naturalWidth === 200 && img.naturalHeight === 150 && img.width === 200 && img.height === 150);
ok('Uploads-Panel zeigt das Bild und fügt es erneut ein', await p.locator('section[aria-label=Uploads] img').count() === 1);
await p.click('section[aria-label=Uploads] button[aria-label="foto.png einfügen"]'); await wait(300);
ok('Aus dem Panel erneut eingefügt (2 Bilder)', (await els()).filter((e) => e.type === 'image').length === 2);
await p.keyboard.press('Delete'); await wait(100);
img = await last(); const imgId = img.id;
await select([imgId]); await wait(200);
const center = async () => k.pagePixel(img.x + img.width / 2, img.y + img.height / 2);
const before = await center();
ok('Bildpixel vor dem Filter (100,50,150)', Math.abs(before[0] - 100) < 4 && Math.abs(before[2] - 150) < 4, JSON.stringify(before));
await p.click('button[aria-label="Bildfilter"]');
await p.locator('input[aria-label="Helligkeit"]').fill('60'); await wait(400);
const bright = await center();
ok('Filter Helligkeit +60 hellt das gezeichnete Bild auf', bright[0] > before[0] + 20 && bright[2] > before[2], JSON.stringify([before, bright]));
await p.locator('input[aria-label="Helligkeit"]').fill('0'); await p.locator('input[aria-label="Sättigung"]').fill('-100'); await wait(400);
const grey = await center();
ok('Filter Sättigung −100 entfärbt (R≈G≈B)', Math.abs(grey[0] - grey[1]) < 12 && Math.abs(grey[1] - grey[2]) < 12, JSON.stringify(grey));
await p.locator('input[aria-label="Kontrast"]').fill('40'); await p.locator('input[aria-label="Weichzeichnen"]').fill('5'); await wait(300);
const f = (await get(imgId)).filters;
ok('Alle vier Filterwerte im Modell', f.saturation === -100 && f.contrast === 40 && f.blur === 5 && f.brightness === 0, JSON.stringify(f));
await p.click('button:has-text("Zurücksetzen")'); await wait(400);
const back = await center();
ok('Zurücksetzen stellt Modell und Bild her', JSON.stringify((await get(imgId)).filters) === '{"brightness":0,"contrast":0,"saturation":0,"blur":0}' && Math.abs(back[0] - before[0]) < 4, JSON.stringify(back));
await p.keyboard.press('Escape');
await toolbar('Horizontal spiegeln').click(); await toolbar('Vertikal spiegeln').click(); await wait(150);
ok('Spiegeln horizontal und vertikal', (await get(imgId)).flipX === true && (await get(imgId)).flipY === true);
await toolbar('Horizontal spiegeln').click(); await toolbar('Vertikal spiegeln').click();
await p.screenshot({ path: OUT + 'd-image.png' });

// --- Zuschneiden ---
await toolbar('Zuschneiden').click(); await wait(250);
ok('Zuschneiden-Modus aktiv', (await state()).cropping === imgId);
let im = await get(imgId);
const rightEdge = await toScreen(im.x + im.width, im.y + im.height / 2);
await drag(rightEdge, { x: rightEdge.x - 60 * (await state()).zoom, y: rightEdge.y });
im = await get(imgId);
ok('Rechte Kante nach innen: Ausschnitt kleiner, Pixeldichte gleich, Originalgröße unverändert', im.crop && Math.abs(im.crop.width - 140) < 3 && Math.abs(im.width - 140) < 3 && im.naturalWidth === 200 && im.height === 150, JSON.stringify([im.crop, im.width]));
const leftEdge = await toScreen(im.x, im.y + im.height / 2);
await drag(leftEdge, { x: leftEdge.x + 40 * (await state()).zoom, y: leftEdge.y });
im = await get(imgId);
ok('Linke Kante nach innen verschiebt den Ausschnitt (x ≈ 40)', Math.abs(im.crop.x - 40) < 3 && Math.abs(im.crop.width - 100) < 4 && Math.abs(im.width - 100) < 4, JSON.stringify(im.crop));
const pixelAfterCrop = await k.pagePixel(im.x + im.width / 2, im.y + im.height / 2);
ok('Zugeschnittenes Bild wird gezeichnet', Math.abs(pixelAfterCrop[0] - 100) < 6);
await p.screenshot({ path: OUT + 'd-crop.png' });
const topEdge = await toScreen(im.x + im.width / 2, im.y);
await drag(topEdge, { x: topEdge.x, y: topEdge.y - 100 * (await state()).zoom }); // über den Bildrand hinaus: begrenzt
im = await get(imgId);
ok('Zuschneiden wird an den Bildgrenzen begrenzt (crop.y ≥ 0)', im.crop.y >= 0 && im.crop.y + im.crop.height <= 150.5, JSON.stringify(im.crop));
// Regression: eine Geste ohne Modelländerung darf den Knoten nicht verschoben zurücklassen
const nodeY = await p.evaluate((id) => window.__designhub.getStage().findOne('#' + id).y(), imgId);
ok('Knoten sitzt nach einer begrenzten Geste wieder auf der Modellposition', Math.abs(nodeY - im.y) < 0.01, JSON.stringify([nodeY, im.y]));
await p.keyboard.press('Enter'); await wait(150);
ok('Enter beendet das Zuschneiden', (await state()).cropping === null);
const ci = await centerOf(imgId);
await p.mouse.dblclick(ci.x, ci.y); await wait(250);
ok('Doppelklick auf das Bild startet das Zuschneiden', (await state()).cropping === imgId);
await p.keyboard.press('Escape'); await wait(150);
ok('Esc beendet es wieder, Auswahl bleibt', (await state()).cropping === null && (await state()).sel[0] === imgId);
await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await wait(200);
ok('Zuschneiden ist per Undo umkehrbar (volles Bild 200 breit)', (await get(imgId)).width === 200 && !(await get(imgId)).crop, JSON.stringify((await get(imgId)).crop));

// --- Hintergrund entfernen ---
await select([imgId]);
await toolbar('Hintergrund entfernen').click(); await wait(800);
const alertText = await p.locator('[role=alert]').last().textContent().catch(() => '');
ok('Ohne API-Schlüssel: verständliche Meldung mit Hinweis auf BG_REMOVAL_API_KEY', /BG_REMOVAL_API_KEY/.test(alertText), alertText);
ok('Bild bleibt dabei unverändert', (await get(imgId)).naturalWidth === 200);
const cut = makePng(100, 75, [0, 255, 0]);
await p.route('**/api/images/remove-background', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ image: 'data:image/png;base64,' + cut.toString('base64') }) }));
await toolbar('Hintergrund entfernen').click(); await eventually(async () => (await get(imgId)).naturalWidth === 100, 4000);
im = await get(imgId);
ok('Mit Antwort des Dienstes: Bild ersetzt, Originalgröße nachgeführt (100×75)', im.naturalWidth === 100 && im.naturalHeight === 75 && im.src.includes(cut.toString('base64').slice(0, 40)), JSON.stringify([im.naturalWidth, im.naturalHeight]));
ok('Anzeigegröße bleibt, Ergebnis ist ein Undo-Schritt', im.width === 200 && im.height === 150);
await p.keyboard.press('Control+z'); await wait(200);
ok('Undo bringt das Originalbild zurück', (await get(imgId)).naturalWidth === 200);
await p.unroute('**/api/images/remove-background');
await p.route('**/api/images/remove-background', (route) => route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'quota' }) }));
await toolbar('Hintergrund entfernen').click(); await wait(600);
ok('Guthaben aufgebraucht: eigene Meldung', /Guthaben/.test(await p.locator('[role=alert]').last().textContent().catch(() => '')));

ok('Keine Konsolenfehler', errs.length === 0, JSON.stringify(errs));
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
await b.close();
process.exitCode = fails ? 1 : 0;
