import { ApiError } from '@/lib/api';

export interface FormErrors { form?: string; fields: Record<string, string> }

/** Übersetzt Serverfehler in deutsche, nutzerfreundliche Meldungen. */
export function describeAuthError(err: unknown): FormErrors {
  if (!(err instanceof ApiError)) return { fields: {}, form: 'Keine Verbindung zum Server. Bitte versuche es erneut.' };
  switch (err.code) {
    case 'validation': return { fields: err.fields };
    case 'invalid_credentials': return { fields: {}, form: 'E-Mail oder Passwort ist falsch.' };
    case 'email_taken': return { fields: { email: 'Diese E-Mail ist bereits registriert.' } };
    case 'too_many_requests': return { fields: {}, form: 'Zu viele Versuche. Bitte warte ein paar Minuten.' };
    default: return { fields: {}, form: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.' };
  }
}

export interface Health { reachable: boolean; db?: boolean }

/**
 * Erklärt einen Serverfehler (5xx, Netzwerk) anhand von /api/health. Gedacht für die lokale Einrichtung,
 * wo "Etwas ist schiefgelaufen" sonst nicht verrät, ob API oder Datenbank fehlen.
 */
export function diagnoseServer(h: Health): string {
  if (!h.reachable) return 'Der Server (API) antwortet nicht. Läuft „npm run dev“ im Ordner designhub? Schau im Terminal nach Fehlern in den [api]-Zeilen.';
  if (h.db === false) return 'Die Datenbank ist nicht erreichbar. Starte sie mit „npm run db:up“ (Docker Desktop muss laufen) und führe „npm run db:migrate“ aus.';
  return 'Etwas ist schiefgelaufen. Bitte versuche es erneut. Falls es bleibt: Hast du „npm run db:migrate“ ausgeführt?';
}

/** Ist das ein Fehler der Infrastruktur (statt falscher Eingaben)? */
export const isServerFault = (err: unknown) => !(err instanceof ApiError) || err.status >= 500;
