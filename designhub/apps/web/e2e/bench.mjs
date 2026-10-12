import { BASE, launch, register } from './lib.mjs';
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const wait = (ms) => p.waitForTimeout(ms);
const email = 'bn' + Date.now() + '@example.com';
await p.goto(`${BASE}/register`); await p.fill('#email', email); await p.fill('#password', 'correct-horse-1');
await p.click('button[type=submit]'); await p.waitForURL('**/app'); await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas');
const url = p.url().split('?')[0];
const rows = [];
for (const n of [100, 300, 1000]) {
  await p.goto(url + (n ? '?bench=' + n : '')); await p.waitForSelector('canvas'); await wait(1200);
  const r = await p.evaluate(async () => {
    const stage = window.__designhub.getStage(), layer = stage.getLayers()[1], d = window.__designhub.doc, u = window.__designhub.ui;
    const count = d.getState().doc.pages[0].elements.length;
    // (a) kompletter Neuzeichnen-Durchlauf der Elemente-Ebene
    const t = []; for (let i = 0; i < 30; i++) { const s = performance.now(); layer.draw(); t.push(performance.now() - s); }
    const redraw = t.reduce((a, c) => a + c, 0) / t.length;
    // (b) Zustandsänderung → React-Render → Konva-Update bis zum nächsten Frame
    const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const id = d.getState().doc.pages[0].elements[0].id; const u1 = [];
    for (let i = 0; i < 20; i++) { const s = performance.now(); d.getState().updateElements([id], { x: 100 + i }); await raf(); u1.push(performance.now() - s); }
    const update = u1.reduce((a, c) => a + c, 0) / u1.length;
    return { count, redraw: +redraw.toFixed(1), update: +update.toFixed(1) };
  });
  // (c) Bildraten beim echten Ziehen eines Elements
  const el = await p.evaluate(() => { const d = window.__designhub.doc.getState(), u = window.__designhub.ui.getState(); const e = d.doc.pages[0].elements.at(-1) ?? null; return e && { x: e.x, y: e.y, w: e.width, h: e.height, zoom: u.zoom, pan: u.pan }; });
  let fps = null;
  if (el) {
    const w = await p.locator('[data-testid=canvas-wrap]').boundingBox();
    const sx = w.x + el.pan.x + (el.x + el.w / 2) * el.zoom, sy = w.y + el.pan.y + (el.y + el.h / 2) * el.zoom;
    await p.evaluate(() => { window.__frames = []; let last = performance.now(); const loop = (t) => { window.__frames.push(t - last); last = t; window.__run && requestAnimationFrame(loop); }; window.__run = true; requestAnimationFrame(loop); });
    await p.mouse.move(sx, sy); await p.mouse.down();
    for (let i = 1; i <= 90; i++) { await p.mouse.move(sx + i * 3, sy + i * 2); await p.evaluate(() => new Promise(r => requestAnimationFrame(r))); }
    await p.mouse.up(); await p.evaluate(() => { window.__run = false; });
    fps = await p.evaluate(() => { const f = window.__frames.slice(5).sort((a, b) => a - b); const avg = f.reduce((a, c) => a + c, 0) / f.length; return { avgMs: +avg.toFixed(1), p95Ms: +f[Math.floor(f.length * 0.95)].toFixed(1), fps: Math.round(1000 / avg) }; });
  }
  rows.push({ ...r, drag: fps });
}
console.log(JSON.stringify(rows, null, 1));
await b.close();
