import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface Props {
  /** Beschriftung für Screenreader (Auslöser) */
  label: string;
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Breite des Fensters in px */
  width?: number;
}

/**
 * Fenster, das am Auslöser hängt. Wird per Portal an <body> gerendert und mit `position: fixed` platziert, damit
 * es nicht von scrollenden Leisten (overflow) abgeschnitten wird. Schließt bei Esc, Klick außerhalb und Scrollen.
 */
export function Popover({ label, trigger, children, className, triggerClassName, disabled, width = 280 }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ left, top: r.bottom + 6 });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    // Esc schließt nur das Fenster. stopPropagation verhindert, dass der Editor es zusätzlich als „Auswahl aufheben“ liest.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open]);

  return (
    <>
      <button ref={btn} type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled}
        onClick={() => setOpen((o) => !o)} className={triggerClassName}>{trigger}</button>
      {open && createPortal(
        <div ref={pop} role="dialog" aria-label={label} style={{ position: 'fixed', left: pos.left, top: pos.top, width, zIndex: 60 }}
          className={cn('max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-3 text-foreground shadow-xl', className)}>
          {typeof children === 'function' ? children(close) : children}
        </div>, document.body)}
    </>
  );
}
