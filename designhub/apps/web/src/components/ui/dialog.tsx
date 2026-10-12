import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props { open: boolean; onClose(): void; title: string; children: ReactNode; className?: string }

/** Modal auf Basis des nativen <dialog>: Fokusfalle, Esc und Hintergrund-Sperre kommen vom Browser. */
export function Dialog({ open, onClose, title, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} // Klick auf den Hintergrund
      aria-label={title}
      className={cn('m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50', className)}
    >
      {/* Inhalt nur bei geöffnetem Dialog rendern: Formulare starten dadurch immer frisch */}
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button onClick={onClose} aria-label="Schließen" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
