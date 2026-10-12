import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const PanelSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-5">
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

export const tile = 'flex aspect-square items-center justify-center rounded-md border border-border bg-card text-foreground transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60';

export const Chip = ({ active, children, onClick }: { active: boolean; children: ReactNode; onClick(): void }) => (
  <button type="button" role="tab" aria-selected={active} onClick={onClick}
    className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', active ? 'border-transparent bg-brand text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>{children}</button>
);
