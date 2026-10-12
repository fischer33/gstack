import {
  AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignCenterHorizontal, AlignCenterVertical,
  AlignVerticalDistributeCenter, ArrowDownToLine, ArrowUpToLine, Blend, ChevronDown, ChevronUp, Copy, Group, Layers, Lock, LockOpen, Trash2, Ungroup,
} from 'lucide-react';
import type { GroupElement, IconElement, ImageElement, ShapeElement, TextElement } from '@designhub/shared';
import { Popover } from '@/components/ui/popover';
import type { AlignMode } from '@/editor/store/alignOps';
import { selectActivePage, useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';
import { cn } from '@/lib/utils';
import { ImageControls } from './ImageControls';
import { PositionPopover } from './PositionPopover';
import { IconControls, ShapeControls } from './ShapeControls';
import { TextControls } from './TextControls';
import { Divider, IconButton, SliderRow, toolBtn } from './toolbarUi';

const ALIGN: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: 'left', label: 'Links ausrichten', Icon: AlignStartVertical }, { mode: 'centerX', label: 'Horizontal zentrieren', Icon: AlignCenterVertical }, { mode: 'right', label: 'Rechts ausrichten', Icon: AlignEndVertical },
  { mode: 'top', label: 'Oben ausrichten', Icon: AlignStartHorizontal }, { mode: 'centerY', label: 'Vertikal zentrieren', Icon: AlignCenterHorizontal }, { mode: 'bottom', label: 'Unten ausrichten', Icon: AlignEndHorizontal },
];

const cell = 'grid h-9 place-items-center rounded-md border border-border text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent';

/** Kontextleiste: zeigt je nach Auswahl Text-, Form-, Bild- oder Gruppenwerkzeuge plus die allgemeinen Funktionen. */
export function ContextToolbar() {
  const page = useDocumentStore(selectActivePage);
  const selectedIds = useUiStore((s) => s.selectedIds);
  const selected = (page?.elements ?? []).filter((e) => selectedIds.includes(e.id));

  if (!selected.length) {
    return <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 text-sm text-muted-foreground">Wähle ein Element aus oder füge links eines hinzu.</div>;
  }

  const store = useDocumentStore.getState();
  const ids = selected.map((e) => e.id);
  const first = selected[0];
  const type = selected.every((e) => e.type === first.type) ? first.type : null;
  const patch = (p: Record<string, unknown>, coalesce?: string) => store.updateElements(ids, p, coalesce ? { coalesce } : undefined);
  const allLocked = selected.every((e) => e.locked);
  const single = selected.length === 1 ? first : null;
  const select = useUiStore.getState().select;

  return (
    <div role="toolbar" aria-label="Eigenschaften der Auswahl" className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-3">
      {type === 'text' && <TextControls els={selected as TextElement[]} patch={patch} />}
      {type === 'shape' && <ShapeControls els={selected as ShapeElement[]} patch={patch} />}
      {type === 'icon' && <IconControls els={selected as IconElement[]} patch={patch} />}
      {type === 'image' && <ImageControls els={selected as ImageElement[]} patch={patch} />}
      {type === 'group' && <span className="px-1 text-sm text-muted-foreground">Gruppe mit {(first as GroupElement).children.length} Elementen</span>}
      {!type && <span className="px-1 text-sm text-muted-foreground">{selected.length} Elemente ausgewählt</span>}
      <Divider />

      <Popover label="Transparenz" width={260} triggerClassName={toolBtn} trigger={<Blend className="h-4 w-4" />}>
        <SliderRow label="Deckkraft" value={Math.round(first.opacity * 100)} min={0} max={100} unit=" %" onChange={(v) => patch({ opacity: v / 100 }, 'opacity')} />
      </Popover>
      <PositionPopover el={single} />

      <Popover label="Anordnen" width={260} triggerClassName={toolBtn} trigger={<Layers className="h-4 w-4" />}>
        {(close) => (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ebene</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button className={cell} aria-label="Ganz nach vorne" title="Ganz nach vorne" onClick={() => store.reorderElements(ids, 'front')}><ArrowUpToLine className="h-4 w-4" /></button>
                <button className={cell} aria-label="Eine Ebene nach vorne" title="Eine Ebene nach vorne" onClick={() => store.reorderElements(ids, 'forward')}><ChevronUp className="h-4 w-4" /></button>
                <button className={cell} aria-label="Eine Ebene nach hinten" title="Eine Ebene nach hinten" onClick={() => store.reorderElements(ids, 'backward')}><ChevronDown className="h-4 w-4" /></button>
                <button className={cell} aria-label="Ganz nach hinten" title="Ganz nach hinten" onClick={() => store.reorderElements(ids, 'back')}><ArrowDownToLine className="h-4 w-4" /></button>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selected.length === 1 ? 'An der Seite ausrichten' : 'Aneinander ausrichten'}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {ALIGN.map(({ mode, label, Icon }) => <button key={mode} className={cell} aria-label={label} title={label} onClick={() => { store.align(ids, mode); }}><Icon className="h-4 w-4" /></button>)}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verteilen (ab 3 Elementen)</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button className={cell} disabled={selected.length < 3} aria-label="Horizontal verteilen" title="Horizontal verteilen" onClick={() => store.distribute(ids, 'x')}><AlignHorizontalDistributeCenter className="h-4 w-4" /></button>
                <button className={cell} disabled={selected.length < 3} aria-label="Vertikal verteilen" title="Vertikal verteilen" onClick={() => { store.distribute(ids, 'y'); close(); }}><AlignVerticalDistributeCenter className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        )}
      </Popover>

      {selected.length >= 2 && <IconButton label="Gruppieren" onClick={() => { const g = store.group(ids); if (g) select([g]); }}><Group className="h-4 w-4" /></IconButton>}
      {single?.type === 'group' && <IconButton label="Gruppierung aufheben" onClick={() => select(store.ungroup(single.id))}><Ungroup className="h-4 w-4" /></IconButton>}
      <Divider />
      <IconButton label={allLocked ? 'Entsperren' : 'Sperren'} active={allLocked} onClick={() => patch({ locked: !allLocked })}>{allLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}</IconButton>
      <IconButton label="Duplizieren" onClick={() => select(store.duplicateElements(ids))}><Copy className="h-4 w-4" /></IconButton>
      <IconButton label="Löschen" className={cn('text-red-600 dark:text-red-400')} onClick={() => store.removeElements(ids)}><Trash2 className="h-4 w-4" /></IconButton>
    </div>
  );
}

