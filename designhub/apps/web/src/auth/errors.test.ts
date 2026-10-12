import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { describeAuthError } from './errors';

describe('describeAuthError', () => {
  it('reicht Feldfehler der Validierung durch', () => {
    expect(describeAuthError(new ApiError(400, 'validation', { email: 'x' })).fields).toEqual({ email: 'x' });
  });
  it('übersetzt bekannte Codes', () => {
    expect(describeAuthError(new ApiError(401, 'invalid_credentials')).form).toMatch(/falsch/);
    expect(describeAuthError(new ApiError(409, 'email_taken')).fields.email).toMatch(/registriert/);
    expect(describeAuthError(new ApiError(429, 'too_many_requests')).form).toMatch(/Zu viele/);
  });
  it('behandelt Netzwerkfehler und unbekannte Codes', () => {
    expect(describeAuthError(new TypeError('Failed to fetch')).form).toMatch(/Verbindung/);
    expect(describeAuthError(new ApiError(500, 'internal')).form).toMatch(/schiefgelaufen/);
  });
});
