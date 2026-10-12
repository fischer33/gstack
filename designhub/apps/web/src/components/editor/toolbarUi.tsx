import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const toolBtn = 'grid h-9 w-9 shrink-0 place-items-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent';

export function IconButton({ label, active, onClick, children, disabled, className }: { label: string; active?: boolean; onClick(): void; children: React.ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn(toolBtn, active && 'bg-primary/15 text-primary', className)}>{children}</button>
  );
}

export const Divider = () => <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />;

/** Zahl mit −/+ Tasten. Eingabe wird erst beim Verlassen/Enter übernommen, +/- sofort. */
export function NumberStepper({ label, value, onChange, min, max, step = 1, className }: { label: string; value: number; onChange(v: number): void; min: number; max: number; step?: number; className?: string }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div role="group" aria-label={label} className={cn('flex shrink-0 items-center rounded-md border border-border bg-card', className)}>
      <button type="button" aria-label={`${label} verringern`} className="grid h-9 w-7 place-items-center hover:bg-muted" onClick={() => onChange(clamp(value - step))}><Minus className="h-3.5 w-3.5" /></button>
      <input aria-label={label} type="number" min={min} max={max} step={step} key={value} defaultValue={Math.round(value * 100) / 100}
        onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && e.target.value !== '') onChange(clamp(v)); else e.target.value = String(value); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="h-9 w-12 bg-transparent text-center text-sm tabular-nums [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" aria-label={`${label} erhöhen`} className="grid h-9 w-7 place-items-center hover:bg-muted" onClick={() => onChange(clamp(value + step))}><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(v: number): void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-[#7d2ae8]" />
      <span className="w-12 shrink-0 text-right tabular-nums">{Math.round(value * 100) / 100}{unit}</span>
    </label>
  );
}
