import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { loadEnv } from './lib/env';
import { createGoogleClient } from './services/google';
import { prismaUserRepo } from './services/users';

const env = loadEnv();
const app = createApp({ env, users: prismaUserRepo(new PrismaClient()), google: createGoogleClient(env) });
app.listen(env.PORT, () => console.log(`DesignHub API auf http://localhost:${env.PORT}`));
