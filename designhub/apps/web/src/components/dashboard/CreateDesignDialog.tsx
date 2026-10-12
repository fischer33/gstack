import { useState, type FormEvent } from 'react';
import { FORMATS, MAX_SIZE, MIN_SIZE, type FormatKey } from '@designhub/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FORMAT_KEYS, FormatTile } from './formats';

/** "Design erstellen": Format wählen oder eigene Größe eingeben. */
export function CreateDesignDialog({ open, onClose, onCreate, busy, startCustom }: {
  open: boolean; onClose(): void; busy?: boolean; startCustom?: boolean;
  onCreate(size: { width: number; height: number }): void;
}) {
  const [custom, setCustom] = useState(!!startCustom);
  const [w, setW] = useState('1200');
  const [h, setH] = useState('800');
  const valid = (v: string) => /^\d+$/.test(v) && +v >= MIN_SIZE && +v <= MAX_SIZE;

  const submit = (e: FormEvent) => { e.preventDefault(); if (valid(w) && valid(h)) onCreate({ width: +w, height: +h }); };
  const pick = (k: FormatKey) => onCreate({ width: FORMATS[k].width, height: FORMATS[k].height });

  return (
    <Dialog open={open} onClose={onClose} title="Design erstellen" className="max-w-2xl">
      {custom ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([['Breite (px)', w, setW], ['Höhe (px)', h, setH]] as const).map(([label, value, set]) => (
              <div key={label} className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor={`size-${label}`}>{label}</label>
                <Input id={`size-${label}`} inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} aria-invalid={!valid(value)} />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Erlaubt sind {MIN_SIZE} bis {MAX_SIZE} Pixel pro Seite.</p>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setCustom(false)}>Zurück zu den Formaten</Button>
            <Button type="submit" disabled={!valid(w) || !valid(h) || busy}>Erstellen</Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FORMAT_KEYS.map((k) => <FormatTile key={k} format={k} onPick={() => pick(k)} disabled={busy} />)}
          <button onClick={() => setCustom(true)} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border p-4 text-sm font-semibold transition-colors hover:border-primary">
            Eigene Größe
          </button>
        </div>
      )}
    </Dialog>
  );
}
