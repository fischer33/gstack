// Lädt die zentrale .env im Repo-Root (designhub/.env), unabhängig vom Arbeitsverzeichnis.
// Bereits gesetzte Umgebungsvariablen haben Vorrang (z. B. in Docker/CI).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
