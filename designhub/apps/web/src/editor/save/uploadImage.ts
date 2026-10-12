import { ApiError, api } from '@/lib/api';
import { loadHtmlImage } from '../engine/useHtmlImage';

interface Presigned { id: string; uploadUrl: string; headers: Record<string, string>; url: string }

/**
 * Lädt ein Bild in den Objektspeicher und gibt dessen URL zurück. `null` heißt: nicht möglich (kein Speicher
 * eingerichtet, nicht angemeldet, Netzwerk- oder CORS-Problem). Der Aufrufer bettet das Bild dann als Data-URL ein,
 * damit nie ein Bild verloren geht. Geprüft wird auch, dass der Browser die URL wirklich laden darf (CORS des Buckets).
 */
export async function uploadImageFile(file: File): Promise<{ url: string } | null> {
  let signed: Presigned;
  try {
    signed = await api<Presigned>('/assets/presign', { body: { name: file.name, mime: file.type, size: file.size } });
  } catch (err) {
    if (err instanceof ApiError) return null; // 501 nicht eingerichtet, 401 anonym, 400 Typ nicht erlaubt
    return null;
  }
  try {
    const res = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: file });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    if (!(await loadHtmlImage(signed.url))) throw new Error('Bild nicht ladbar (CORS?)');
    return { url: signed.url };
  } catch (err) {
    console.warn('Bild-Upload fehlgeschlagen, das Bild wird eingebettet:', err);
    void api(`/assets/${signed.id}`, { method: 'DELETE' }).catch(() => undefined); // Eintrag aufräumen
    return null;
  }
}
