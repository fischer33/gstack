// Etappe (f): Bild-Uploads über signierte URLs. Gegen einen kleinen S3-Nachbau (PUT/GET/CORS), weil im Test kein echter Bucket läuft.
// Voraussetzung: API läuft mit den S3_*-Werten aus .env.example (Endpunkt http://localhost:9000, Bucket designhub).
import { createServer } from 'node:http';
import { editorKit, launch, makePng, openTab, register, reporter, watchErrors, BASE } from './lib.mjs';

const store = new Map(); // Pfad → { type, body, headers }
let cors = true;
const mock = createServer((req, res) => {
  const cross = cors ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT', 'Access-Control-Allow-Headers': '*' } : {};
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cross, 'Access-Control-Max-Age': '60' }); return void res.end(); }
  const path = req.url.split('?')[0];
  if (req.method === 'PUT') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c)).on('end', () => {
      const signed = /X-Amz-Signature=[0-9a-f]{64}/.test(req.url) && /X-Amz-SignedHeaders=[^&]*content-type/i.test(req.url);
      store.set(path, { type: req.headers['content-type'], body: Buffer.concat(chunks), signed, cache: req.headers['cache-control'] });
      res.writeHead(200, cross).end();
    });
    return;
  }
  const hit = store.get(path);
  if (!hit) return void res.writeHead(404, cross).end();
  res.writeHead(200, { ...cross, 'Content-Type': hit.type }).end(hit.body);
});
await new Promise((r) => mock.listen(9000, r));

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = watchErrors(p);
const { ok, finish } = reporter();
const k = editorKit(p);
const { wait, state, eventually } = k;

await register(p, { name: 'Ada' });
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(700);
const id = p.url().split('/').pop();
const upload = async (name, color) => { await openTab(p, 'Uploads'); await p.setInputFiles('[data-testid=image-input]', { name, mimeType: 'image/png', buffer: makePng(40, 30, color) }); };

// 1) Normalfall
await upload('rot.png', [255, 0, 0]);
ok('Upload: Bild liegt als URL im Dokument (nicht als Data-URL)', await eventually(async () => (await k.last())?.src?.startsWith('http://localhost:9000/designhub/u/'), 8000), (await k.last())?.src?.slice(0, 40));
const stored = [...store.entries()][0];
ok('Objektspeicher hat die Bytes, den Typ und eine Signatur erhalten', !!stored && stored[1].type === 'image/png' && stored[1].body.length > 50 && stored[1].signed && /immutable/.test(stored[1].cache ?? ''), JSON.stringify(stored?.[1] && { t: stored[1].type, s: stored[1].signed, c: stored[1].cache }));
ok('Pfad enthält Nutzer-ID und UUID, nicht den Dateinamen', !!stored && /^\/designhub\/u\/[^/]+\/[0-9a-f-]{36}\.png$/.test(stored[0]), stored?.[0]);
await p.keyboard.press('Control+s');
await p.waitForSelector('[data-testid=save-status][data-status=saved]', { timeout: 8000 });
const doc = await p.evaluate(async (id) => (await (await fetch('/api/designs/' + id)).json()), id);
ok('Gespeichertes Design enthält die URL (kleines Dokument)', JSON.stringify(doc).length < 20000 && doc.pages[0].elements.some((e) => e.src?.startsWith('http://localhost:9000')));

// „Meine Bilder“ nach Neuladen
await p.reload(); await p.waitForSelector('canvas'); await wait(700);
await openTab(p, 'Uploads');
ok('„Meine Bilder“ zeigt das hochgeladene Bild nach Neuladen', await eventually(async () => (await p.locator('[data-testid=saved-assets] img').count()) === 1, 6000));
const before = (await state()).els.length;
await p.locator('[data-testid=saved-assets] button').click();
ok('Klick darauf fügt es ein', await eventually(async () => (await state()).els.length === before + 1, 4000));
ok('Exportiert/gezeichnet ohne Fehler: Bild ist geladen', await p.evaluate(() => !!window.__designhub.getStage().find('Image').length));

// 2) Bucket ohne CORS → Fallback auf eingebettetes Bild
cors = false;
await upload('gruen.png', [0, 255, 0]);
ok('Ohne CORS: Bild wird eingebettet statt zu fehlen', await eventually(async () => (await k.last())?.src?.startsWith('data:image/png'), 8000), (await k.last())?.src?.slice(0, 30));
const assets = await p.evaluate(async () => (await (await fetch('/api/assets')).json()).assets.length);
ok('… und der Asset-Eintrag wurde wieder aufgeräumt', assets === 1, String(assets));

// 3) Speicher nicht erreichbar → Fallback
cors = true;
await new Promise((r) => mock.close(r));
const n0 = (await state()).els.length;
await upload('blau.png', [0, 0, 255]);
ok('Speicher offline: Bild wird eingebettet', await eventually(async () => (await state()).els.length === n0 + 1 && (await k.last()).src.startsWith('data:image/png'), 10000), String((await state()).els.length));

await b.close();
finish(errs.filter((e) => !/CORS|ERR_CONNECTION_REFUSED|Failed to fetch|has been blocked|net::/i.test(String(e))));
