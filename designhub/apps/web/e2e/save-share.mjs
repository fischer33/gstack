// Etappe (f): Autosave, Konflikt, Offline-Wiederholung, Teilen per Link, Einstellungen und Konto löschen.
import { BASE, OUT, editorKit, launch, register, reporter, uniqueEmail, watchErrors } from './lib.mjs';

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = watchErrors(p);
const { ok: ok0, finish } = reporter();
const ok = (n, c, x) => { ok0(n, c, x); if (process.env.TRACE) console.log('   errs:', errs.length); };
const k = editorKit(p);
const { wait, put, rect, eventually } = k;

const apiGet = (page, path) => page.evaluate(async (path) => { const r = await fetch('/api' + path, { credentials: 'include' }); return { status: r.status, body: await r.json().catch(() => null) }; }, path);
const status = (page) => page.locator('[data-testid=save-status]').getAttribute('data-status');
const waitStatus = (page, s, ms = 15000) => page.waitForSelector(`[data-testid=save-status][data-status=${s}]`, { timeout: ms }).then(() => true, () => false);
const newDesign = async (page) => { await page.goto(`${BASE}/app`); await page.click('main button:has-text("Instagram Post")'); await page.waitForURL('**/design/*'); await page.waitForSelector('canvas'); await page.waitForTimeout(700); return page.url().split('/').pop(); };
const putEl = (page, id, x = 100, fill = '#ff0000') => page.evaluate(({ id, x, fill }) => {
  const el = { id, type: 'shape', kind: 'rect', x, y: 100, width: 200, height: 200, rotation: 0, opacity: 1, locked: false, visible: true, fill, stroke: 'transparent', strokeWidth: 0 };
  window.__designhub.doc.getState().addElement(el);
}, { id, x, fill });

await register(p, { name: 'Ada' });
const id = await newDesign(p);

// ---- Autosave
await putEl(p, 'a1');
ok('Nach einer Änderung: „Ungespeicherte Änderungen“', await waitStatus(p, 'dirty', 3000));
const t0 = Date.now();
ok('Autosave speichert nach ca. 5 s', await waitStatus(p, 'saved', 12000));
const dt = Date.now() - t0;
ok('… nicht früher als 4 s (entprellt)', dt >= 4000, `${dt} ms`);
let d = (await apiGet(p, `/designs/${id}`)).body;
ok('Server hat das Element und Version 2', d.pages[0].elements.some((e) => e.id === 'a1') && d.version === 2, `v${d.version}`);
ok('Vorschau ist ein PNG', d.thumbnail?.startsWith('data:image/png;base64,'), d.thumbnail?.slice(0, 30));

// ---- Strg+S speichert sofort
await putEl(p, 'a2', 400, '#00aa44');
await p.keyboard.press('Control+s');
ok('Strg+S speichert sofort (unter 3 s)', await waitStatus(p, 'saved', 3000) && (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.length === 2);

// ---- Reload behält das Design
await p.reload(); await p.waitForSelector('canvas'); await wait(800);
ok('Nach Neuladen sind beide Elemente da', (await k.state()).els.length === 2);

// ---- Umbenennen
await p.click('[data-testid=title-button]');
await p.fill('[data-testid=title-input]', 'Mein Sommerplakat');
await p.keyboard.press('Enter'); await wait(800);
ok('Umbenennen im Kopf speichert den Titel', (await apiGet(p, `/designs/${id}`)).body.title === 'Mein Sommerplakat');
await p.goto(`${BASE}/app/designs`);
await p.waitForSelector('text=Mein Sommerplakat');
ok('Dashboard zeigt Titel und PNG-Vorschau', await p.locator('img[src^="data:image/png"]').count() >= 1);

// ---- Zurück-Knopf speichert vorher
await p.goto(`${BASE}/design/${id}`); await p.waitForSelector('canvas'); await wait(700);
await putEl(p, 'a3', 700, '#0000ff');
await p.click('a[aria-label="Zurück zum Dashboard"]'); await p.waitForURL('**/app');
ok('Zurück zum Dashboard speichert zuerst', (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.length === 3);

// ---- Offline: Fehlerstatus, danach Wiederholung
await p.goto(`${BASE}/design/${id}`); await p.waitForSelector('canvas'); await wait(700);
await ctx.setOffline(true);
await putEl(p, 'off1', 50);
await p.keyboard.press('Control+s');
ok('Offline: Status „Speichern fehlgeschlagen“', await waitStatus(p, 'error', 8000));
await ctx.setOffline(false);
ok('Wieder online: speichert von selbst', await waitStatus(p, 'saved', 15000));
ok('… und die Änderung ist auf dem Server', (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.some((e) => e.id === 'off1'));

// ---- Konflikt: zweiter Tab speichert zuerst
const p2 = await ctx.newPage(); watchErrors(p2);
await p2.goto(`${BASE}/design/${id}`); await p2.waitForSelector('canvas'); await wait(700);
await putEl(p2, 'tab2'); await p2.keyboard.press('Control+s'); await waitStatus(p2, 'saved', 5000);
await putEl(p, 'tab1', 300);
await p.keyboard.press('Control+s');
ok('Zweiter Tab hat Vorrang: Konfliktdialog erscheint', await p.waitForSelector('[data-testid=conflict-dialog]', { timeout: 8000 }).then(() => true, () => false));
let ids = (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.map((e) => e.id);
ok('… der Server wurde nicht überschrieben', ids.includes('tab2') && !ids.includes('tab1'), ids.join());
await p.screenshot({ path: OUT + 'f-conflict.png' });
await p.click('[data-testid=conflict-overwrite]');
ok('„Meine Version behalten“ speichert', await waitStatus(p, 'saved', 8000));
ids = (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.map((e) => e.id);
ok('… Server hat jetzt die Fassung aus Tab 1', ids.includes('tab1') && !ids.includes('tab2'), ids.join());
// Neu laden
await putEl(p2, 'tab2b'); await p2.reload(); await p2.waitForSelector('canvas'); await wait(500); // p2 lädt neu und hat Version
await putEl(p2, 'tab2c', 600); await p2.keyboard.press('Control+s'); await waitStatus(p2, 'saved', 5000);
await putEl(p, 'tab1b', 200); await p.keyboard.press('Control+s');
await p.waitForSelector('[data-testid=conflict-dialog]', { timeout: 8000 });
await Promise.all([p.waitForEvent('load'), p.click('[data-testid=conflict-reload]')]);
await p.waitForSelector('canvas'); await wait(800);
ids = (await k.state()).els.map((e) => e.id);
ok('„Neu laden“ zeigt den gespeicherten Stand ohne die verworfene Änderung', ids.includes('tab2c') && !ids.includes('tab1b'), ids.join());
await p2.close();

// ---- Teilen
await p.click('[data-testid=share-open]');
await p.waitForSelector('[data-testid=share-dialog]');
await p.click('[data-testid=share-create-VIEW]');
const viewUrl = await p.locator('[data-testid=share-url-VIEW]').inputValue();
await p.click('[data-testid=share-create-EDIT]');
const editUrl = await p.locator('[data-testid=share-url-EDIT]').inputValue();
ok('Zwei verschiedene Links', /\/s\/[\w-]{40,}$/.test(viewUrl) && /\/s\/[\w-]{40,}$/.test(editUrl) && viewUrl !== editUrl, `${viewUrl} ${editUrl}`);
await p.screenshot({ path: OUT + 'f-share.png' });
await p.keyboard.press('Escape');

const anon = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const anonErrs = watchErrors(anon);
await anon.goto(viewUrl);
await anon.waitForSelector('[data-testid=viewer-page] svg', { timeout: 10000 });
ok('Ansehen-Link: Betrachter ohne Anmeldung, Titel sichtbar', (await anon.textContent('[data-testid=viewer-title]')) === 'Mein Sommerplakat');
ok('… kein Editor, nur Ansicht', await anon.locator('canvas').count() === 0 && await anon.locator('[data-testid=share-open]').count() === 0);
await anon.screenshot({ path: OUT + 'f-viewer.png' });

const anon2 = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const anon2Errs = watchErrors(anon2);
await anon2.goto(editUrl);
await anon2.waitForSelector('canvas', { timeout: 10000 }); await anon2.waitForTimeout(800);
ok('Bearbeiten-Link öffnet den Editor ohne Anmeldung (ohne Teilen/Umbenennen)', await anon2.locator('[data-testid=share-open]').count() === 0 && await anon2.locator('[data-testid=title-button]').count() === 0);
await putEl(anon2, 'guest1', 800, '#ff00ff'); await anon2.keyboard.press('Control+s');
ok('Gast speichert über den Link', await waitStatus(anon2, 'saved', 8000));
ok('Besitzer sieht die Gast-Änderung in der API', (await apiGet(p, `/designs/${id}`)).body.pages[0].elements.some((e) => e.id === 'guest1'));

// Widerruf
await p.reload(); await p.waitForSelector('canvas');
await p.click('[data-testid=share-open]'); await p.waitForSelector('[data-testid=share-dialog]');
await p.locator('[data-testid=share-VIEW] button:has-text("Link deaktivieren")').click(); await wait(600);
await anon.reload(); await anon.waitForSelector('text=Link nicht gültig', { timeout: 8000 });
ok('Deaktivierter Ansehen-Link zeigt „Link nicht gültig“', true);
ok('Gast-Konsole ohne unerwartete Fehler (nur erwartete 401/404 der Vorlagen-Abfragen ausgenommen)', anon2Errs.filter((e) => !/401|404|Failed to load resource/.test(String(e))).length === 0, JSON.stringify(anon2Errs));

// ---- Einstellungen
await p.goto(`${BASE}/app/settings`);
await p.fill('[data-testid=settings-name]', 'Ada Lovelace');
await p.click('button:has-text("Speichern") >> nth=0'); await wait(600);
await p.reload(); await p.waitForSelector('[data-testid=settings-name]');
ok('Name wird gespeichert', (await p.inputValue('[data-testid=settings-name]')) === 'Ada Lovelace');
await p.fill('[data-testid=pw-current]', 'falsch-falsch'); await p.fill('[data-testid=pw-new]', 'neues-passwort-2'); await p.fill('[data-testid=pw-repeat]', 'neues-passwort-2');
await p.click('button:has-text("Passwort speichern")'); await wait(700);
ok('Falsches altes Passwort wird abgelehnt', await p.locator('text=Das Passwort stimmt nicht').count() >= 1);
await p.fill('[data-testid=pw-current]', 'correct-horse-1');
await p.click('button:has-text("Passwort speichern")'); await wait(700);
const login = await p.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@example.com', password: 'wrong-password' }) })).status);
ok('Passwort geändert (Toast)', await p.locator('text=Passwort geändert').count() >= 1 && login === 401);

// ---- Konto löschen
await p.click('[data-testid=delete-account-open]');
const mail = await p.locator('[data-testid=delete-account-form] p b').textContent();
await p.fill('[data-testid=delete-email]', mail);
await p.fill('[data-testid=delete-password]', 'neues-passwort-2');
await p.click('[data-testid=delete-account-confirm]');
await p.waitForURL((u) => !u.pathname.startsWith('/app'), { timeout: 8000 });
ok('Nach dem Löschen: abgemeldet', true);
const re = await p.evaluate(async (mail) => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail, password: 'neues-passwort-2' }) })).status, mail);
ok('Login mit gelöschtem Konto scheitert', re === 401);
ok('Freigabe-Link des gelöschten Kontos ist tot', (await anon2.evaluate(async (u) => (await fetch('/api/share/' + u.split('/s/')[1])).status, editUrl)) === 404);

await b.close();
finish([...errs.filter((e) => !/offline|Failed to fetch|ERR_INTERNET_DISCONNECTED|401|Failed to load resource/i.test(String(e))), ...anonErrs.filter((e) => !/401|404|Failed to load resource/.test(String(e)))]);
