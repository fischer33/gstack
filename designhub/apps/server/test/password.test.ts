import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password';

describe('password', () => {
  it('verifiziert das richtige Passwort und lehnt falsche ab', async () => {
    const h = await hashPassword('geheim-123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('geheim-123', h)).toBe(true);
    expect(await verifyPassword('geheim-124', h)).toBe(false);
  });
  it('salzt: gleiches Passwort ergibt verschiedene Hashes', async () => {
    expect(await hashPassword('x'.repeat(8))).not.toBe(await hashPassword('x'.repeat(8)));
  });
  it('lehnt kaputte Hashes ab statt zu werfen', async () => {
    expect(await verifyPassword('a', 'nonsense')).toBe(false);
  });
});
