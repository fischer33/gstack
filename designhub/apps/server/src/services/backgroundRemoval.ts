import type { Env } from '../lib/env';

export class RemovalError extends Error {
  constructor(public code: 'quota' | 'invalid_image' | 'provider', message: string) { super(message); }
}

/** Austauschbar, damit Tests ohne Netzwerk laufen und der Anbieter später wechselbar bleibt. */
export interface BackgroundRemover {
  /** Liefert ein PNG mit transparentem Hintergrund. Wirft RemovalError. */
  remove(image: Buffer, mime: string): Promise<Buffer>;
}

/** remove.bg: https://www.remove.bg/api. Der Schlüssel bleibt serverseitig. */
export function createRemoveBgClient(env: Env, fetchImpl: typeof fetch = fetch): BackgroundRemover | null {
  const key = env.BG_REMOVAL_API_KEY;
  if (!key) return null;
  return {
    async remove(image, mime) {
      const form = new FormData();
      form.append('image_file', new Blob([new Uint8Array(image)], { type: mime }), 'image');
      form.append('size', 'auto');
      form.append('format', 'png');
      let res: Response;
      try {
        res = await fetchImpl('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': key }, body: form });
      } catch (err) {
        throw new RemovalError('provider', `remove.bg nicht erreichbar: ${err instanceof Error ? err.message : err}`);
      }
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      // 402 = Guthaben aufgebraucht, 400 = Bild nicht verwertbar, alles andere (Schlüssel, Limits, Ausfälle) = Anbieterfehler
      if (res.status === 402) throw new RemovalError('quota', 'remove.bg: Guthaben aufgebraucht');
      if (res.status === 400) throw new RemovalError('invalid_image', 'remove.bg konnte kein Motiv erkennen');
      throw new RemovalError('provider', `remove.bg antwortete mit ${res.status}`);
    },
  };
}
