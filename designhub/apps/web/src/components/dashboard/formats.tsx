import { FORMATS, type FormatKey } from '@designhub/shared';
import { Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Zeichnet das Seitenverhältnis als kleines Rechteck, damit man Formate auf einen Blick unterscheidet. */
function Shape({ width, height }: { width: number; height: number }) {
  const max = 40;
  const k = max / Math.max(width, height);
  return (
    <span className="grid h-12 w-12 place-items-center">
      <span className="rounded-[3px] bg-brand shadow-sm" style={{ width: Math.max(10, width * k), height: Math.max(10, height * k) }} />
    </span>
  );
}

export function FormatTile({ format, onPick, disabled }: { format: FormatKey; onPick(): void; disabled?: boolean }) {
  const f = FORMATS[format];
  return (
    <button onClick={onPick} disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md disabled:opacity-60">
      <Shape width={f.width} height={f.height} />
      <span className="text-sm font-semibold">{f.label}</span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">{f.width} × {f.height}</span>
    </button>
  );
}

export function CustomSizeTile({ onPick, className }: { onPick(): void; className?: string }) {
  return (
    <button onClick={onPick}
      className={cn('flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md', className)}>
      <span className="grid h-12 w-12 place-items-center text-muted-foreground"><Ruler className="h-6 w-6" /></span>
      <span className="text-sm font-semibold">Eigene Größe</span>
      <span className="whitespace-nowrap text-xs text-muted-foreground">Breite × Höhe</span>
    </button>
  );
}

export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];
