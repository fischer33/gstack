import { z } from 'zod';

/** Leere Strings (z. B. `GOOGLE_CLIENT_ID=""` in .env) zählen als "nicht gesetzt". */
const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET muss mindestens 32 Zeichen lang sein'),
  /** Login/Registrierung: Versuche pro 15 Minuten und IP. Für Ende-zu-Ende-Tests erhöhen. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  /** remove.bg-Schlüssel für „Hintergrund entfernen“; ohne Schlüssel antwortet die Route mit 501. */
  BG_REMOVAL_API_KEY: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  /** S3-kompatibler Speicher für Bild-Uploads. Ohne Endpunkt/Bucket/Zugang antworten die Upload-Routen mit 501 und der Editor speichert Bilder im Dokument. */
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
  /** Öffentliche Basis-URL, unter der hochgeladene Bilder im Browser erreichbar sind (z. B. http://localhost:9000/designhub). */
  S3_PUBLIC_URL: optional,
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:5173/api/auth/google/callback'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source);
  if (env.NODE_ENV === 'production' && env.JWT_SECRET.startsWith('change-me')) {
    throw new Error('JWT_SECRET ist noch der Platzhalter aus .env.example');
  }
  return env;
}
