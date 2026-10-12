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
