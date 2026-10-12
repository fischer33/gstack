// Etappe (e): Export-Dialog und Dateien (PNG, JPG, SVG, PDF, ZIP). Prüft Dateiinhalt, nicht nur den Download.
import { readFileSync } from 'node:fs';
import { OUT, editorKit, launch, register, reporter, watchErrors } from './lib.mjs';

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = watchErrors(p);
const { ok, finish } = reporter();
const k = editorKit(p);
const { wait, put, rect, state } = k;

await register(p, { name: 'Ada' });
await p.click('main button:has-text("Instagram Post")'); await p.waitForURL('**/design/*'); await p.waitForSelector('canvas'); await wait(600);

await put(rect('r1', 100, 100, 300, 300, '#ff0000'));
await put({ ...rect('e1', 600, 100, 300, 300, '#0000ff'), kind: 'ellipse' });
await put({ id: 't1', type: 'text', x: 100, y: 600, width: 800, height: 120, rotation: 0, opacity: 1, locked: false, visible: true, text: 'Hallo Export', fontFamily: 'Inter', fontSize: 96, fontWeight: 700, italic: false, underline: false, align: 'left', fill: '#111111', lineHeight: 1.2, letterSpacing: 0 });
await wait(500);

/** Dialog öffnen, Format/Einstellungen wählen, Download abfangen. */
async function download(format, { scale, scope, quality } = {}) {
  await p.click('[data-testid=export-open]');
  await p.waitForSelector('[data-testid=export-dialog]');
  await p.locator(`[data-testid=export-dialog] label:has-text("${format}") input`).first().check({ force: true });
  if (scale) await p.selectOption('#export-scale', String(scale));
  if (scope) await p.locator(`[data-testid=export-dialog] input[name=export-scope]`).nth(scope === 'all' ? 1 : 0).check();
  if (quality) await p.locator('#export-quality').fill(String(quality));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('[data-testid=export-run]')]);
  const path = `${OUT}export-${Date.now()}-${dl.suggestedFilename()}`;
  await dl.saveAs(path);
  await p.waitForSelector('[data-testid=export-dialog]', { state: 'detached' }).catch(() => undefined);
  return { name: dl.suggestedFilename(), buf: readFileSync(path), path };
}

/** Bilddatei im Browser dekodieren: Maße + Pixel an Punkten */
const probe = (buf, mime, pts) => p.evaluate(async ({ b64, mime, pts }) => {
  const img = new Image(); img.src = `data:${mime};base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return { w: img.naturalWidth, h: img.naturalHeight, px: pts.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data)) };
}, { b64: buf.toString('base64'), mime, pts });
const near = (a, c, tol = 6) => a.every((v, i) => Math.abs(v - c[i]) <= tol);

// ---- PNG 1x
let f = await download('PNG');
ok('PNG: Dateiname aus Titel', /\.png$/.test(f.name), f.name);
let r = await probe(f.buf, 'image/png', [[200, 200], [750, 250], [5, 5]]);
ok('PNG 1x: 1080×1080', r.w === 1080 && r.h === 1080, `${r.w}x${r.h}`);
ok('PNG: Rechteck rot, Ellipse blau, Hintergrund weiß', near(r.px[0], [255, 0, 0, 255]) && near(r.px[1], [0, 0, 255, 255]) && near(r.px[2], [255, 255, 255, 255]), JSON.stringify(r.px));

// ---- PNG 2x
f = await download('PNG', { scale: 2 });
r = await probe(f.buf, 'image/png', [[400, 400]]);
ok('PNG 2x: 2160×2160, Rechteck an skalierter Stelle', r.w === 2160 && r.h === 2160 && near(r.px[0], [255, 0, 0, 255]), `${r.w}x${r.h} ${r.px[0]}`);

// ---- JPG
f = await download('JPG', { scale: 1, quality: 0.9 });
ok('JPG: Signatur FFD8FF', f.buf[0] === 0xff && f.buf[1] === 0xd8 && f.buf[2] === 0xff);
r = await probe(f.buf, 'image/jpeg', [[5, 5], [200, 200]]);
ok('JPG: weißer Hintergrund (keine Transparenz), Rechteck rot', near(r.px[0], [255, 255, 255, 255], 4) && near(r.px[1], [255, 0, 0, 255], 12), JSON.stringify(r.px));

// ---- SVG vs. Editor
f = await download('SVG');
const svg = f.buf.toString('utf8');
ok('SVG: gültiges Wurzelelement mit viewBox', /^<svg [^>]*viewBox="0 0 1080 1080"/.test(svg), svg.slice(0, 120));
ok('SVG: enthält den Text', svg.includes('Hallo Export'));
const diff = await p.evaluate(async (svg) => {
  const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
  const a = document.createElement('canvas'); a.width = 1080; a.height = 1080; a.getContext('2d').drawImage(img, 0, 0, 1080, 1080);
  const stage = window.__designhub.getStage(); const s = window.__designhub.ui.getState();
  // Referenz: dieselbe Seite offscreen über den Editor-Pfad (Export-Renderer ist per PNG-Test geprüft) – hier: Stage ohne Zoom
  const ref = stage.toCanvas({ x: s.pan.x, y: s.pan.y, width: 1080 * s.zoom, height: 1080 * s.zoom, pixelRatio: 1 / s.zoom });
  const A = a.getContext('2d').getImageData(0, 0, 1080, 1080).data;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; c.getContext('2d').drawImage(ref, 0, 0, 1080, 1080);
  const B = c.getContext('2d').getImageData(0, 0, 1080, 1080).data;
  let bad = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 90) bad++;
  return bad / (1080 * 1080);
}, svg);
ok('SVG stimmt mit dem Editor überein (<1,5 % abweichende Pixel)', diff < 0.015, `${(diff * 100).toFixed(2)} %`);

// ---- PDF einseitig
f = await download('PDF', { scale: 1 });
const pdf = f.buf.toString('latin1');
ok('PDF: Signatur und 1 Seite', pdf.startsWith('%PDF-') && (pdf.match(/\/Type\s*\/Page\b/g) ?? []).length === 1, pdf.slice(0, 8));
ok('PDF: Seitengröße 810×810 pt (1080 px bei 96 dpi)', /\/MediaBox\s*\[\s*0\s+0\s+810\.?0*\s+810\.?0*\s*\]/.test(pdf));

// ---- Mehrseitig
await p.evaluate(() => { window.__designhub.doc.getState().addPage(); });
await wait(300);
f = await download('PDF', { scope: 'all', scale: 1 });
ok('PDF mit 2 Seiten', (f.buf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length === 2);
f = await download('PNG', { scope: 'all', scale: 0.5 });
ok('Mehrere PNG → ZIP', f.name.endsWith('.zip') && f.buf[0] === 0x50 && f.buf[1] === 0x4b, f.name);
const names = [...f.buf.toString('latin1').matchAll(/([^\x00-\x1f]{1,90}-\d\.png)/g)].map((m) => m[1]);
ok('ZIP enthält -1.png und -2.png', names.some((n) => n.endsWith('-1.png')) && names.some((n) => n.endsWith('-2.png')), JSON.stringify(names));

// ---- Dialog: Größenhinweis, Persistenz, Shortcut
await p.keyboard.press('Control+Shift+E');
await p.waitForSelector('[data-testid=export-dialog]');
ok('Strg+Umschalt+E öffnet den Dialog', true);
ok('Letzte Einstellungen gemerkt (PNG, Alle Seiten, 0,5×)', (await p.inputValue('#export-scale')) === '0.5' && await p.locator('input[name=export-scope]').nth(1).isChecked());
ok('Größenanzeige', (await p.textContent('[data-testid=export-size]')).includes('540 × 540'));
await p.keyboard.press('Escape'); await wait(200);
ok('Esc schließt den Dialog', await p.locator('[data-testid=export-dialog]').count() === 0);
await p.screenshot({ path: OUT + 'e-export.png' });

await b.close();
finish(errs);
