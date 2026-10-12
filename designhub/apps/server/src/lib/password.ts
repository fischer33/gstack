import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// scrypt aus Node (keine native Zusatz-Abhängigkeit). Parameter nach OWASP-Empfehlung (N=2^15, r=8, p=1).
const N = 32768, R = 8, P = 1, KEYLEN = 64;
const OPTS: ScryptOptions = { N, r: R, p: P, maxmem: 128 * N * R * 2 };

function derive(password: string, salt: Buffer, opts: ScryptOptions, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: `scrypt$N$r$p$salt(b64)$hash(b64)` – Parameter stehen im Hash, damit sie später erhöht werden können. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, OPTS, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const opts: ScryptOptions = { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 };
  const actual = await derive(password, Buffer.from(salt, 'base64'), opts, expected.length);
  return timingSafeEqual(actual, expected);
}

/** Fester Dummy-Hash: Login für unbekannte E-Mails braucht dieselbe Rechenzeit (kein Timing-Orakel). */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword('dummy-password-for-timing'));
