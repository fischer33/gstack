import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { describeAuthError, diagnoseServer, isServerFault } from './errors';

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

describe('diagnoseServer', () => {
  it('nennt die Ursache: API aus, Datenbank aus, sonst Hinweis auf Migration', () => {
    expect(diagnoseServer({ reachable: false })).toMatch(/npm run dev/);
    expect(diagnoseServer({ reachable: true, db: false })).toMatch(/db:up/);
    expect(diagnoseServer({ reachable: true, db: true })).toMatch(/db:migrate/);
  });
  it('isServerFault unterscheidet Infrastruktur von falschen Eingaben', () => {
    expect(isServerFault(new TypeError('Failed to fetch'))).toBe(true);
    expect(isServerFault(new ApiError(500, 'internal'))).toBe(true);
    expect(isServerFault(new ApiError(401, 'invalid_credentials'))).toBe(false);
    expect(isServerFault(new ApiError(400, 'validation'))).toBe(false);
  });
});
