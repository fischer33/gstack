// Gemeinsame Helfer für die Ende-zu-Ende-Skripte. Voraussetzung: `npm run dev` läuft (Web :5173, API :4000, DB migriert + geseedet).
// Empfohlen: API mit AUTH_RATE_LIMIT_MAX=1000 starten, sonst greift das Rate-Limit der Registrierung nach ~10 Testläufen.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

export const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
export const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/** Startet Chromium. Auf Rechnern mit anderer Browser-Version: E2E_CHROMIUM_PATH setzen. */
export async function launch() {
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH || undefined });
  return browser;
}

export function reporter() {
  let fails = 0;
  return {
    ok(name, cond, extra) { if (!cond) fails++; console.log(cond ? 'PASS' : 'FAIL', name, cond ? '' : (extra ?? '')); },
    finish(errs = []) {
      if (errs.length) { fails++; console.log('FAIL Konsolenfehler', JSON.stringify(errs)); }
      console.log(fails ? `${fails} FEHLER` : 'ALLES BESTANDEN');
      process.exitCode = fails ? 1 : 0;
    },
  };
}

/** Seite mit Fehler-Sammler (Konsole + Exceptions). */
export function watchErrors(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  return errs;
}

export const uniqueEmail = (tag) => `${tag}${Date.now()}${Math.floor(Math.random() * 1e4)}@example.com`;

export async function register(page, { email = uniqueEmail('e2e'), name = '' } = {}) {
  await page.goto(`${BASE}/register`);
  if (name) await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', 'correct-horse-1');
  await page.click('button[type=submit]');
  await page.waitForURL('**/app');
  return email;
}
