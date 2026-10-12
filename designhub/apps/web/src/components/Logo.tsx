import { cn } from '@/lib/utils';

/** Eigene Wortbildmarke: Verlaufs-Quadrat mit Stern-Ausschnitt. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-bold text-lg tracking-tight', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-brand text-primary-foreground shadow-sm" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2l2.6 6.9L22 10l-5.6 4.6L18 22l-6-3.8L6 22l1.6-7.4L2 10l7.4-1.1z" /></svg>
      </span>
      DesignHub
    </span>
  );
}
