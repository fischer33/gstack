import { Link2, Link2Off, Move } from 'lucide-react';
import { useState } from 'react';
import { scaleElement, type Element } from '@designhub/shared';
import { Popover } from '@/components/ui/popover';
import { normalizeRotation } from '@/editor/engine/geometry';
import { useDocumentStore } from '@/editor/store/documentStore';
import { cn } from '@/lib/utils';
import { toolBtn } from './toolbarUi';

type Field = 'x' | 'y' | 'width' | 'height' | 'rotation';
const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'x', label: 'X', unit: 'px' }, { key: 'y', label: 'Y', unit: 'px' }, { key: 'width', label: 'Breite', unit: 'px' },
  { key: 'height', label: 'Höhe', unit: 'px' }, { key: 'rotation', label: 'Drehung', unit: '°' },
];

/** Numerische Position und Größe für ein einzelnes Element. */
export function PositionPopover({ el }: { el: Element | null }) {
  const [lock, setLock] = useState(true);
  const { updateElements } = useDocumentStore.getState();

  const commit = (key: Field, raw: number) => {
    if (!el || !Number.isFinite(raw)) return;
    const patch: Record<string, unknown> = {};
    if (key === 'rotation') patch.rotation = normalizeRotation(raw);
    else if (key === 'width' || key === 'height') {
      const v = Math.max(1, raw);
      // Seitenverhältnis halten (Text hat automatische Höhe)
      const ratio = el.height / el.width;
      let w = key === 'width' ? v : lock && el.type !== 'text' ? v / ratio : el.width;
      let h = key === 'height' ? v : lock && el.type !== 'text' ? v * ratio : el.height;
      if (el.type === 'text') h = el.height;
      w = Math.max(1, w); h = Math.max(1, h);
      patch.width = Math.round(w * 100) / 100; patch.height = Math.round(h * 100) / 100;
      if (el.type === 'group') patch.children = el.children.map((c) => scaleElement(c, w / el.width, h / el.height)); // Kinder skalieren mit
    } else patch[key] = Math.round(raw * 100) / 100;
    updateElements([el.id], patch, { coalesce: `pos-${key}` });
  };

  return (
    <Popover label="Position und Größe" width={248} disabled={!el} triggerClassName={toolBtn} trigger={<Move className="h-4 w-4" />}>
      {el && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(({ key, label, unit }) => (
              <label key={key} className="text-xs text-muted-foreground">{label} ({unit})
                <input aria-label={label} type="number" key={`${key}-${el[key as keyof Element] as number}`} defaultValue={Math.round((el[key as keyof Element] as number) * 100) / 100}
                  disabled={key === 'height' && el.type === 'text'} title={key === 'height' && el.type === 'text' ? 'Die Höhe von Text ergibt sich aus Schrift und Breite' : undefined}
                  onBlur={(e) => e.target.value !== '' && commit(key, Number(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground disabled:opacity-50" />
              </label>
            ))}
            <button type="button" aria-label="Seitenverhältnis sperren" aria-pressed={lock} onClick={() => setLock((l) => !l)}
              className={cn('mt-4 flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs', lock ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
              {lock ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />} Verhältnis
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
