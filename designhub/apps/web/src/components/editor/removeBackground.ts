import { ApiError } from '@/lib/api';

/** Fehler der Hintergrund-Entfernung in verständliche Meldungen übersetzen. */
export function removeBackgroundMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Keine Verbindung zum Server.';
  switch (err.code) {
    case 'not_configured': return 'Hintergrund entfernen ist noch nicht eingerichtet. Trage BG_REMOVAL_API_KEY (remove.bg) in die .env des Servers ein.';
    case 'quota': return 'Das Guthaben bei remove.bg ist aufgebraucht.';
    case 'invalid_image': return 'In diesem Bild wurde kein Motiv erkannt.';
    case 'unsupported_image': return 'Dieses Bildformat wird nicht unterstützt (PNG, JPEG oder WebP).';
    case 'too_many_requests': return 'Zu viele Anfragen. Bitte warte kurz.';
    case 'provider_error': return 'Der Dienst remove.bg ist gerade nicht erreichbar. Bitte versuche es später erneut.';
    case 'validation': return 'Das Bild ist zu groß (maximal 10 MB).';
    default: return 'Der Hintergrund konnte nicht entfernt werden.';
  }
}

/** Bildgröße einer data:-URL ermitteln. */
export function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
    img.src = src;
  });
}

/** Zuschnitt auf eine neue Bildgröße umrechnen (der Dienst darf das Ergebnis herunterskalieren). */
export function rescaleCrop(crop: { x: number; y: number; width: number; height: number } | undefined, from: { width: number; height: number }, to: { width: number; height: number }) {
  if (!crop) return undefined;
  const kx = to.width / from.width, ky = to.height / from.height;
  return { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky };
}
