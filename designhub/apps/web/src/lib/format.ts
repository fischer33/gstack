/** "gerade eben", "vor 5 Min.", "gestern", sonst Datum. `now` ist injizierbar für Tests. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'gerade eben';
  const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto', style: 'short' });
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
  if (diffSec < 86_400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
  if (diffSec < 7 * 86_400) return rtf.format(-Math.floor(diffSec / 86_400), 'day');
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const formatSize = (w: number, h: number) => `${w} × ${h} px`;

/** Tage bis zur endgültigen Löschung eines Papierkorb-Eintrags (mindestens 0). */
export function daysUntilPurge(deletedAtIso: string, retentionDays: number, now: Date = new Date()): number {
  const left = retentionDays - (now.getTime() - new Date(deletedAtIso).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(left));
}
