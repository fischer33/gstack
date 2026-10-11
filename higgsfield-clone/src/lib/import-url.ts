import { detectImageExt } from "./media-store";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 20_000;

// Nur diese Hosts dürfen abgerufen werden (Schutz davor, dass die App fremde oder interne Adressen anfragt).
// IMPORT_ALLOWED_HOSTS ergänzt die Liste (kommagetrennt); Hosts daraus dürfen auch http nutzen (z. B. für Tests).
export function allowedHosts(): { https: string[]; extra: string[] } {
  const extra = (process.env.IMPORT_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return { https: ["cdn.shopify.com"], extra };
}

function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ungültige Adresse");
  }
  const { https, extra } = allowedHosts();
  const host = u.hostname.toLowerCase();
  const ok = (u.protocol === "https:" && (https.includes(host) || extra.includes(host))) || (u.protocol === "http:" && extra.includes(host));
  if (!ok) throw new Error(`Adresse nicht erlaubt (nur ${https.join(", ")})`);
  if (u.username || u.password) throw new Error("Adresse nicht erlaubt");
  return u;
}

// Lädt ein Bild herunter: jeder Redirect wird erneut gegen die Host-Liste geprüft, die Größe ist begrenzt,
// und der Dateityp wird am Inhalt erkannt.
export async function fetchImage(raw: string): Promise<{ buf: Buffer; ext: "png" | "jpg" | "webp" }> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Weiterleitung ohne Ziel");
      url = checkUrl(new URL(loc, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`Abruf fehlgeschlagen (HTTP ${res.status})`);
    if (Number(res.headers.get("content-length")) > MAX_BYTES) throw new Error("Bild ist größer als 15 MB");

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Leere Antwort");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Bild ist größer als 15 MB");
      }
      chunks.push(value);
    }
    const buf = Buffer.concat(chunks);
    const ext = detectImageExt(buf);
    if (!ext) throw new Error("Keine PNG-, JPG- oder WebP-Datei");
    return { buf, ext };
  }
  throw new Error("Zu viele Weiterleitungen");
}
