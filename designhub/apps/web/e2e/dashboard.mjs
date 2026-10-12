import { BASE, OUT, launch, register } from './lib.mjs';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
let fails = 0;
const ok = (n, c) => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n); };
const wait = (ms) => p.waitForTimeout(ms);
const eventually = async (f, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await wait(100); } return false; };
const articles = async () => p.locator('article').count();
const email = 'b' + Date.now() + '@example.com';
const text = async (sel) => (await p.textContent(sel).catch(() => '')) ?? '';

// --- Registrieren, Dashboard ---
await p.goto(`${BASE}/register`);
await p.fill('#name', 'Grace Hopper'); await p.fill('#email', email); await p.fill('#password', 'correct-horse-1');
await p.click('button[type=submit]'); await p.waitForURL('**/app');
await p.waitForSelector('text=Was möchtest du gestalten');
ok('Begrüßung mit Vorname', /, Grace\?/.test(await text('h1')));
ok('7 Formate + eigene Größe (zusammen 8)', (await p.locator('section').first().locator('button:has-text("×")').count()) === 8 && await p.locator('section').first().locator('text=Eigene Größe').count() === 1);
ok('Leerer Zustand "Zuletzt bearbeitet"', await p.locator('text=Noch keine Designs').count() === 1);
await p.waitForSelector('main button:has(img)');
const tplCount = await p.locator('main button:has(img)').count();
ok('21 Vorlagen mit Vorschau', tplCount === 21);
const chips = await p.locator('[role=tab]').allTextContents();
ok('Kategorie-Chips mit Zähler (Alle 21)', chips[0].includes('Alle') && chips[0].includes('21') && chips.length === 7);
await p.click('[role=tab]:has-text("Poster")'); await wait(500);
ok('Kategorie-Filter Poster = 3', (await p.locator('main button:has(img)').count()) === 3);
await p.screenshot({ path: OUT + 'b-home.png' });

// --- Design aus Format ---
await p.click('[role=tab]:has-text("Alle")');
await p.click('button:has-text("Instagram Post")'); await p.waitForURL('**/design/*');
await p.waitForSelector('canvas'); await wait(300);
const docSize = () => p.evaluate(() => { const d = window.__designhub.doc.getState().doc; return d && { w: d.width, h: d.height, n: d.pages[0].elements.length }; });
ok('Format-Kachel legt 1080×1080-Design an', (await docSize())?.w === 1080 && (await docSize())?.h === 1080);
const firstUrl = p.url();
await p.goBack(); await p.waitForSelector('article');
ok('Zuletzt bearbeitet zeigt 1 Design', await eventually(async () => (await articles()) === 1));

// --- Design aus Vorlage ---
await p.waitForSelector('main button:has(img)');
await p.locator('main button:has(img)').first().click(); await p.waitForURL('**/design/*');
await p.waitForSelector('canvas'); await wait(300);
const tplTitle = await text('header h1');
ok('Vorlage erzeugt Design mit Vorlagentitel und Inhalt', tplTitle !== 'Unbenanntes Design' && (await docSize()).n > 0, JSON.stringify([tplTitle, await docSize()]));
await p.goto(`${BASE}/app`); await p.waitForSelector('article');
ok('Zuletzt bearbeitet: neueste zuerst', (await p.locator('article h3').first().textContent()) === tplTitle);

// --- Eigene Größe ---
await p.click('button:has-text("Design erstellen")'); await p.waitForSelector('dialog[open]');
await p.click('dialog button:has-text("Eigene Größe")');
await p.fill('dialog input >> nth=0', '10');
ok('Zu kleine Größe deaktiviert Erstellen', await p.locator('dialog button:has-text("Erstellen")').isDisabled());
await p.fill('dialog input >> nth=0', '1200'); await p.fill('dialog input >> nth=1', '800');
await p.click('dialog button:has-text("Erstellen")'); await p.waitForURL('**/design/*');
await p.waitForSelector('canvas'); await wait(300);
ok('Eigene Größe 1200×800', (await docSize())?.w === 1200 && (await docSize())?.h === 800);

// --- Ordner ---
await p.goto(`${BASE}/app/designs`); await p.waitForSelector('article');
await p.click('button[aria-label="Neuer Ordner"]'); await p.fill('dialog input', 'Kunde A'); await p.click('dialog button:has-text("Erstellen")');
await p.waitForURL('**/designs?folder=*');
await p.waitForSelector('h1:has-text("Kunde A")');
ok('Ordner angelegt, Ansicht zeigt leeren Ordner', await p.locator('text=Dieser Ordner ist leer').count() === 1);
await p.click('header >> button:has-text("Design erstellen")'); await p.waitForSelector('dialog[open]');
await p.click('dialog button:has-text("Story")'); await p.waitForURL('**/design/*');
await p.goBack(); await p.waitForSelector('article');
ok('Neues Design aus Ordneransicht landet im Ordner', await eventually(async () => (await articles()) === 1));
ok('Ordner-Zähler in Seitenleiste = 1', /Kunde A\s*1/.test(await text('aside nav')));

// --- Designs verwalten ---
await p.click('aside >> text=Meine Designs'); await p.waitForSelector('article');
const total = await p.locator('article').count();
ok('Meine Designs zeigt alle 4', await eventually(async () => (await articles()) === 4));
await p.click('button[aria-label^="Aktionen für Unbenanntes Design"] >> nth=0'); await p.click('[role=menuitem]:has-text("Umbenennen")');
await p.fill('dialog input', 'Mein Plakat'); await p.click('dialog button:has-text("Speichern")');
await p.waitForSelector('article h3:has-text("Mein Plakat")'); ok('Umbenennen', true);
await p.click('button[aria-label="Aktionen für Mein Plakat"]'); await p.click('[role=menuitem]:has-text("Duplizieren")');
await p.waitForSelector('article h3:has-text("Kopie von Mein Plakat")'); ok('Duplizieren', true);
await p.click('button[aria-label="Aktionen für Mein Plakat"]'); await p.click('[role=menuitem]:has-text("In Ordner verschieben")');
await p.selectOption('dialog select', { label: 'Kunde A' }); await p.click('dialog button:has-text("Verschieben")'); await wait(600);
ok('Verschieben: Ordner-Zähler = 2', /Kunde A\s*2/.test(await text('aside nav')));
await p.selectOption('select >> nth=0', 'title'); await wait(600);
const titles = await p.locator('article h3').allTextContents();
ok('Sortierung A–Z', JSON.stringify(titles) === JSON.stringify([...titles].sort((x, y) => x.localeCompare(y, 'de'))));

// --- Suche ---
await p.fill('input[aria-label=Suche]', 'plakat'); await p.press('input[aria-label=Suche]', 'Enter');
await p.waitForURL('**/search?q=plakat'); await p.waitForSelector('article');
ok('Suche findet eigene Designs (ohne Groß/Klein)', await eventually(async () => (await articles()) === 2));
await p.fill('input[aria-label=Suche]', 'sale'); await p.press('input[aria-label=Suche]', 'Enter');
await p.waitForSelector('h1:has-text("sale")'); await wait(700);
ok('Suche findet Vorlagen per Stichwort', await p.locator('main button:has(img)').count() >= 1);

// --- Papierkorb ---
await p.goto(`${BASE}/app/designs`); await p.waitForSelector('article');
await p.click('button[aria-label="Aktionen für Kopie von Mein Plakat"]'); await p.click('[role=menuitem]:has-text("In den Papierkorb")');
await wait(600); ok('Aus Liste entfernt', await p.locator('article h3:has-text("Kopie von Mein Plakat")').count() === 0);
await p.click('aside >> text=Papierkorb'); await p.waitForSelector('article:has-text("endgültig gelöscht")');
const trashTxt = await text('article'); ok('Papierkorb zeigt 30-Tage-Hinweis', /in 30 Tagen/.test(trashTxt)); if (!/in 30 Tagen/.test(trashTxt)) console.log('   Text war:', JSON.stringify(trashTxt), 'Anzahl articles:', await p.locator('article').count());
await p.click('button:has-text("Wiederherstellen")'); await wait(700);
ok('Wiederherstellen leert Papierkorb', await p.locator('text=Der Papierkorb ist leer').count() === 1);
await p.goto(`${BASE}/app/designs`); await p.waitForSelector('article');
await p.click('button[aria-label="Aktionen für Kopie von Mein Plakat"]'); await p.click('[role=menuitem]:has-text("In den Papierkorb")'); await wait(500);
await p.click('aside >> text=Papierkorb'); await p.waitForSelector('article:has-text("endgültig gelöscht")');
await p.click('button:has-text("Papierkorb leeren")'); await p.click('dialog button:has-text("Alles löschen")');
await p.waitForSelector('text=Der Papierkorb ist leer'); ok('Papierkorb leeren', true);

// --- Ordner löschen ---
await p.click('aside >> text=Kunde A'); await p.waitForSelector('h1:has-text("Kunde A")');
await p.click('button:has-text("Ordner löschen")'); await p.click('dialog button:has-text("Ordner löschen")');
await p.waitForURL('**/app/designs'); await p.waitForSelector('article');
ok('Ordner gelöscht, Designs bleiben', await eventually(async () => (await articles()) >= 3 && await p.locator('aside >> text=Noch keine Ordner').count() === 1));

// --- Fremder Zugriff ---
const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/register`); await p2.fill('#email', 'x' + email); await p2.fill('#password', 'correct-horse-1');
await p2.click('button[type=submit]'); await p2.waitForURL('**/app');
await p2.goto(firstUrl); await p2.waitForSelector('h1');
ok('Fremdes Design: "nicht gefunden"', /nicht gefunden/.test(await p2.textContent('h1')));
await ctx2.close();

// --- Dark Mode + Mobil ---
await p.goto(`${BASE}/app`); await p.waitForSelector('article');
await p.click('button[aria-label=Dunkel]'); await wait(300); await p.screenshot({ path: OUT + 'b-home-dark.png' });
await p.setViewportSize({ width: 390, height: 844 }); await p.reload(); await p.waitForSelector('article');
ok('Mobil: kein horizontaler Scroll', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await p.screenshot({ path: OUT + 'b-mobile.png' });
await p.click('button[aria-label="Menü öffnen"]'); await wait(300);
ok('Mobil: Drawer zeigt Navigation', await p.locator('nav[aria-label=Hauptnavigation] >> visible=true').count() >= 1);
await p.screenshot({ path: OUT + 'b-mobile-drawer.png' });

// --- Session abgelaufen ---
await p.setViewportSize({ width: 1280, height: 800 });
await ctx.clearCookies(); await p.goto(`${BASE}/app/designs`);
await p.waitForURL('**/login'); ok('Ohne Cookie -> /login', true);

ok('Keine Konsolenfehler', errs.length === 0); if (errs.length) console.log(errs);
console.log(fails ? fails + ' FEHLER' : 'ALLES BESTANDEN');
process.exitCode = fails ? 1 : 0;
await b.close();
