// Muss zuerst kommen: lädt designhub/.env, bevor loadEnv() process.env liest.
import './env';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { loadEnv } from './lib/env';
import { createGoogleClient } from './services/google';
import { prismaUserRepo } from './services/users';

const env = loadEnv();
const db = new PrismaClient();
const app = createApp({ env, db, users: prismaUserRepo(db), google: createGoogleClient(env) });
app.listen(env.PORT, () => console.log(`DesignHub API auf http://localhost:${env.PORT}`));
