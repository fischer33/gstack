import type { PrismaClient } from '@prisma/client';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

export type NewUser = Partial<Pick<UserRecord, 'passwordHash' | 'googleId' | 'name' | 'avatarUrl'>> & { email: string };

/** Schmale Schnittstelle, damit Auth-Logik ohne Datenbank testbar ist. */
export interface UserRepo {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByGoogleId(googleId: string): Promise<UserRecord | null>;
  create(data: NewUser): Promise<UserRecord>;
  update(id: string, data: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): Promise<UserRecord>;
  /** Konto samt Designs, Ordnern und Bildern löschen (Kaskade in der Datenbank). */
  delete(id: string): Promise<void>;
}

export const prismaUserRepo = (db: PrismaClient): UserRepo => ({
  findById: (id) => db.user.findUnique({ where: { id } }),
  findByEmail: (email) => db.user.findUnique({ where: { email } }),
  findByGoogleId: (googleId) => db.user.findUnique({ where: { googleId } }),
  create: (data) => db.user.create({ data }),
  update: (id, data) => db.user.update({ where: { id }, data }),
  delete: async (id) => { await db.user.delete({ where: { id } }); },
});

/** Nur diese Felder verlassen den Server. */
export const publicUser = (u: UserRecord) => ({ id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, hasPassword: u.passwordHash !== null });
