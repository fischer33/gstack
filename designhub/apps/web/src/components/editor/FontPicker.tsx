import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Popover } from '@/components/ui/popover';
import { FONTS } from '@/editor/lib/fonts';
import { cn } from '@/lib/utils';

/** Schriftauswahl mit Suche, gruppiert nach Kategorie. Die Schrift wird erst beim Auswählen geladen. */
export function FontPicker({ value, onPick, busy }: { value: string; onPick(family: string): void; busy?: boolean }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const hits = FONTS.filter((f) => f.family.toLowerCase().includes(q.trim().toLowerCase()));
    return [...new Set(hits.map((f) => f.category))].map((c) => ({ category: c, fonts: hits.filter((f) => f.category === c) }));
  }, [q]);

  return (
    <Popover label="Schriftart" width={260}
      triggerClassName="flex h-9 w-44 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 text-left text-sm hover:bg-muted"
      trigger={<><span className="truncate" style={{ fontFamily: `"${value}", sans-serif` }}>{busy ? 'Lädt…' : value}</span><ChevronDown className="h-4 w-4 shrink-0 opacity-60" /></>}>
      {(close) => (
        <div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${FONTS.length} Schriften durchsuchen`} aria-label="Schriften suchen"
            className="mb-2 h-9 w-full rounded-md border border-border bg-card px-3 text-sm" />
          <div role="listbox" aria-label="Schriften" className="max-h-72 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.category}>
                <div className="sticky top-0 bg-card px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</div>
                {g.fonts.map((f) => (
                  <button key={f.family} role="option" aria-selected={f.family === value} type="button" onClick={() => { onPick(f.family); close(); }}
                    className={cn('flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted', f.family === value && 'bg-muted font-semibold')}>
                    {f.family}{f.family === value && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <p className="px-2 py-4 text-sm text-muted-foreground">Keine Schrift gefunden.</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}
