import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { removeBackgroundMessage, rescaleCrop } from './removeBackground';

describe('removeBackgroundMessage', () => {
  it('nennt bei fehlender Einrichtung die Variable', () => {
    expect(removeBackgroundMessage(new ApiError(501, 'not_configured'))).toMatch(/BG_REMOVAL_API_KEY/);
  });
  it('übersetzt bekannte Codes', () => {
    expect(removeBackgroundMessage(new ApiError(402, 'quota'))).toMatch(/Guthaben/);
    expect(removeBackgroundMessage(new ApiError(422, 'invalid_image'))).toMatch(/kein Motiv/);
    expect(removeBackgroundMessage(new ApiError(429, 'too_many_requests'))).toMatch(/Zu viele/);
    expect(removeBackgroundMessage(new ApiError(502, 'provider_error'))).toMatch(/nicht erreichbar/);
    expect(removeBackgroundMessage(new ApiError(400, 'unsupported_image'))).toMatch(/PNG/);
  });
  it('Netzwerk und Unbekanntes', () => {
    expect(removeBackgroundMessage(new TypeError('x'))).toMatch(/Verbindung/);
    expect(removeBackgroundMessage(new ApiError(500, 'internal'))).toMatch(/nicht entfernt/);
  });
});

describe('rescaleCrop', () => {
  it('rechnet den Ausschnitt auf die neue Bildgröße um', () => {
    expect(rescaleCrop({ x: 100, y: 50, width: 400, height: 300 }, { width: 800, height: 600 }, { width: 400, height: 300 })).toEqual({ x: 50, y: 25, width: 200, height: 150 });
  });
  it('ohne Ausschnitt: undefined', () => expect(rescaleCrop(undefined, { width: 1, height: 1 }, { width: 2, height: 2 })).toBeUndefined());
});
