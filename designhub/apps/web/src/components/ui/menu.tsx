import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MenuItem { label: string; icon?: ReactNode; onSelect(): void; danger?: boolean }

/** Kleines Dropdown-Menü: schließt bei Klick außerhalb, Esc und nach Auswahl. */
export function Menu({ label, trigger, items, align = 'right', className, popoverClassName }: {
  label: string; trigger: ReactNode; items: MenuItem[]; align?: 'left' | 'right'; className?: string;
  /** Ersetzt die Standard-Platzierung (unterhalb des Auslösers), z. B. für Menüs am Bildschirmrand */
  popoverClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}>{trigger}</button>
      {open && (
        <div role="menu" className={cn('absolute z-30 min-w-48 rounded-md border border-border bg-card p-1 shadow-lg', popoverClassName ?? cn('mt-1', align === 'right' ? 'right-0' : 'left-0'))}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" type="button"
              onClick={() => { setOpen(false); it.onSelect(); }}
              className={cn('flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted', it.danger && 'text-red-600 dark:text-red-400')}>
              {it.icon}{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
