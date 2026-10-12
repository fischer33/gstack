import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Popover } from '@/components/ui/popover';
import { PALETTES, hexToRgb, normalizeHex, rgbToHex, toHexOrDefault } from '@/editor/lib/colors';
import { cn } from '@/lib/utils';

const BRAND_KEY = 'dh-brand-colors';
const loadBrand = (): string[] => {
  try { return (JSON.parse(localStorage.getItem(BRAND_KEY) ?? '[]') as unknown[]).filter((c): c is string => typeof c === 'string' && normalizeHex(c) === c).slice(0, 16); } catch { return []; }
};

/** Markenfarben: pro Browser gespeichert. Ein serverseitiges Brand Kit folgt in Phase 2. */
function useBrandColors() {
  const [colors, setColors] = useState<string[]>(loadBrand);
  const save = (next: string[]) => { setColors(next); try { localStorage.setItem(BRAND_KEY, JSON.stringify(next)); } catch { /* Speicher gesperrt: gilt nur für diese Sitzung */ } };
  return { colors, add: (c: string) => !colors.includes(c) && save([...colors, c].slice(-16)), remove: (c: string) => save(colors.filter((x) => x !== c)) };
}

const Swatch = ({ color, active, onClick, label }: { color: string; active?: boolean; onClick(): void; label?: string }) => (
  <button type="button" onClick={onClick} aria-label={label ?? color} title={color}
    className={cn('h-6 w-6 rounded-md border border-border transition-transform hover:scale-110', active && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: color }} />
);

interface Props {
  label: string;
  value: string;
  onChange(hex: string): void;
  /** Zeigt zusätzlich eine Schaltfläche „Transparent“ (z. B. für Konturen) */
  allowTransparent?: boolean;
  className?: string;
}

/** Farbwähler: Paletten, Markenfarben, Hex- und RGB-Eingabe und das System-Farbfeld. */
export function ColorPicker({ label, value, onChange, allowTransparent, className }: Props) {
  const hex = toHexOrDefault(value);
  const rgb = hexToRgb(hex)!;
  const brand = useBrandColors();
  const [hexInput, setHexInput] = useState(hex);
  useEffect(() => setHexInput(hex), [hex]);

  const commitHex = (v: string) => { const n = normalizeHex(v); if (n) onChange(n); else setHexInput(hex); };
  const setChannel = (k: 'r' | 'g' | 'b', v: string) => { if (/^\d{1,3}$/.test(v)) onChange(rgbToHex({ ...rgb, [k]: Math.min(255, +v) })); };

  return (
    <Popover label={label} width={264}
      triggerClassName={cn('grid h-9 w-9 place-items-center rounded-md hover:bg-muted', className)}
      trigger={<span className="h-6 w-6 rounded-md border border-border shadow-sm" style={{ background: value === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50% / 8px 8px' : hex }} />}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${label}: Farbfeld`} value={hex} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-border bg-card p-0.5" />
          <label className="flex flex-1 items-center gap-1 text-xs text-muted-foreground">Hex
            <input aria-label={`${label}: Hex`} value={hexInput} onChange={(e) => setHexInput(e.target.value)} onBlur={(e) => commitHex(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitHex(e.currentTarget.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-2 font-mono text-sm text-foreground" maxLength={7} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['r', 'g', 'b'] as const).map((k) => (
            <label key={k} className="text-xs uppercase text-muted-foreground">{k}
              <input aria-label={`${label}: ${k.toUpperCase()}`} inputMode="numeric" value={rgb[k]} onChange={(e) => setChannel(k, e.target.value)}
                className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground" />
            </label>
          ))}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Markenfarben
            <button type="button" aria-label="Aktuelle Farbe zu den Markenfarben hinzufügen" title="Aktuelle Farbe hinzufügen" onClick={() => brand.add(hex)} className="grid h-6 w-6 place-items-center rounded hover:bg-muted"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {brand.colors.length ? (
            <div className="flex flex-wrap gap-1.5">
              {brand.colors.map((c) => (
                <span key={c} className="group relative">
                  <Swatch color={c} active={c === hex} onClick={() => onChange(c)} label={`Markenfarbe ${c}`} />
                  <button type="button" aria-label={`Markenfarbe ${c} entfernen`} onClick={() => brand.remove(c)} className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-foreground text-background opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Mit + speicherst du die aktuelle Farbe.</p>}
        </div>

        {PALETTES.map((p) => (
          <div key={p.name}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.name}</div>
            <div className="flex flex-wrap gap-1.5">{p.colors.map((c) => <Swatch key={c} color={c} active={c === hex} onClick={() => onChange(c)} />)}</div>
          </div>
        ))}
        {allowTransparent && <button type="button" onClick={() => onChange('transparent')} className="w-full rounded-md border border-border py-1.5 text-sm hover:bg-muted">Transparent</button>}
      </div>
    </Popover>
  );
}
