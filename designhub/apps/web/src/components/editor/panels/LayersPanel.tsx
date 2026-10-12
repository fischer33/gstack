import { ArrowRight, Circle, Eye, EyeOff, GripVertical, Image as ImageIcon, Layers, Lock, LockOpen, Minus, Shapes, Square, Star, Type } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Element } from '@designhub/shared';
import { selectActivePage, useDocumentStore } from '@/editor/store/documentStore';
import { layerDropIndex } from '@/editor/store/layerOps';
import { useUiStore } from '@/editor/store/uiStore';
import { cn } from '@/lib/utils';

const SHAPE_NAMES = { rect: 'Rechteck', ellipse: 'Kreis', line: 'Linie', arrow: 'Pfeil', star: 'Stern' } as const;

export function layerLabel(el: Element): string {
  if (el.name) return el.name;
  switch (el.type) {
    case 'text': return el.text.replace(/\s+/g, ' ').trim().slice(0, 28) || 'Text';
    case 'shape': return SHAPE_NAMES[el.kind];
    case 'image': return 'Bild';
    case 'icon': return 'Icon';
    case 'group': return `Gruppe (${el.children.length})`;
  }
}

function LayerIcon({ el }: { el: Element }) {
  const cls = 'h-4 w-4 shrink-0 text-muted-foreground';
  if (el.type === 'text') return <Type className={cls} />;
  if (el.type === 'image') return <ImageIcon className={cls} />;
  if (el.type === 'group') return <Layers className={cls} />;
  if (el.type === 'icon') return <Shapes className={cls} />;
  const Icon = { rect: Square, ellipse: Circle, line: Minus, arrow: ArrowRight, star: Star }[el.kind];
  return <Icon className={cls} />;
}

/** Ebenen von vorne nach hinten. Sortieren per Ziehen; Sichtbarkeit und Sperre je Zeile. */
export default function LayersPanel() {
  const page = useDocumentStore(selectActivePage);
  const { updateElements, reorderToIndex } = useDocumentStore.getState();
  const selectedIds = useUiStore((s) => s.selectedIds);
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [slot, setSlotState] = useState<number | null>(null);
  // Das Ref ist sofort aktuell: dragover und drop folgen so dicht aufeinander, dass der State beim drop noch veraltet sein kann.
  const slotRef = useRef<number | null>(null);
  const dragRef = useRef<string[] | null>(null);
  const setSlot = (v: number | null) => { slotRef.current = v; setSlotState(v); };

  const display = [...(page?.elements ?? [])].reverse();
  if (!display.length) return <p className="text-sm text-muted-foreground">Noch keine Elemente auf dieser Seite.</p>;

  const click = (e: React.MouseEvent, id: string) => {
    const ui = useUiStore.getState();
    if (e.shiftKey || e.metaKey || e.ctrlKey) ui.toggleSelect(id); else ui.select([id]);
  };

  const end = () => { dragRef.current = null; setDragIds(null); setSlot(null); };
  const drop = () => {
    const ids = dragRef.current, at = slotRef.current;
    if (ids && at !== null) reorderToIndex(ids, layerDropIndex(display, ids, at));
    end();
  };

  const Marker = ({ at }: { at: number }) => <div aria-hidden className={cn('h-0.5 rounded bg-primary transition-opacity', slot === at && dragIds ? 'opacity-100' : 'opacity-0')} />;

  return (
    <ul aria-label="Ebenen" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSlot(null); }}>
      {display.map((el, i) => (
        <li key={el.id}>
          <Marker at={i} />
          <div
            draggable onDragEnd={end} onDrop={(e) => { e.preventDefault(); drop(); }}
            onDragStart={(e) => {
              // Gehört die Zeile zur Auswahl, wird die ganze Auswahl als Block verschoben
              const ids = selectedIds.includes(el.id) ? selectedIds : [el.id];
              dragRef.current = ids; setDragIds(ids);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', el.id);
            }}
            onDragOver={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setSlot(i + (e.clientY > r.top + r.height / 2 ? 1 : 0)); }}
            onClick={(e) => click(e, el.id)} data-layer-id={el.id}
            className={cn('group flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors',
              selectedIds.includes(el.id) ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted', !el.visible && 'opacity-50', dragIds?.includes(el.id) && 'opacity-40')}>
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
            <LayerIcon el={el} />
            <span className="min-w-0 flex-1 truncate">{layerLabel(el)}</span>
            <button type="button" aria-label={el.visible ? `${layerLabel(el)} ausblenden` : `${layerLabel(el)} einblenden`} aria-pressed={!el.visible}
              onClick={(e) => { e.stopPropagation(); updateElements([el.id], { visible: !el.visible }); }} className="grid h-7 w-7 place-items-center rounded hover:bg-background">
              {el.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button type="button" aria-label={el.locked ? `${layerLabel(el)} entsperren` : `${layerLabel(el)} sperren`} aria-pressed={el.locked}
              onClick={(e) => { e.stopPropagation(); updateElements([el.id], { locked: !el.locked }); }} className="grid h-7 w-7 place-items-center rounded hover:bg-background">
              {el.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4 opacity-50" />}
            </button>
          </div>
        </li>
      ))}
      <li><Marker at={display.length} /></li>
    </ul>
  );
}
