import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { loadEnv } from '../src/lib/env';
import type { GoogleClient, GoogleProfile } from '../src/services/google';
import type { NewUser, UserRecord, UserRepo } from '../src/services/users';

export const testEnv = () =>
  loadEnv({ NODE_ENV: 'test', DATABASE_URL: 'x', JWT_SECRET: 'test-secret-test-secret-test-secret-123' });

export function memoryRepo(): UserRepo & { all: UserRecord[] } {
  const all: UserRecord[] = [];
  const find = (f: (u: UserRecord) => boolean) => Promise.resolve(all.find(f) ?? null);
  return {
    all,
    findById: (id) => find((u) => u.id === id),
    findByEmail: (e) => find((u) => u.email === e),
    findByGoogleId: (g) => find((u) => u.googleId === g),
    async create(d: NewUser) {
      const u: UserRecord = { id: randomUUID(), passwordHash: null, googleId: null, name: null, avatarUrl: null, createdAt: new Date(), ...d };
      all.push(u);
      return u;
    },
    async update(id, d) {
      const u = all.find((x) => x.id === id)!;
      Object.assign(u, d);
      return u;
    },
    async delete(id) {
      const i = all.findIndex((x) => x.id === id);
      if (i >= 0) all.splice(i, 1);
    },
  };
}

/** Google-Stub: `finish` liefert das vorgegebene Profil oder wirft. */
export const fakeGoogle = (profile: GoogleProfile | Error): GoogleClient => ({
  start: () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?fake=1', state: 'st4te', verifier: 'v3rifier' }),
  finish: async () => { if (profile instanceof Error) throw profile; return profile; },
});

export const makeApp = (google: GoogleClient | null = null) => {
  const users = memoryRepo();
  return { users, app: createApp({ env: testEnv(), users, google }) };
};
