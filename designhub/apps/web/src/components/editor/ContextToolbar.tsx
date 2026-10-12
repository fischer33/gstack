import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, Lock, LockOpen, Trash2 } from 'lucide-react';
import type { Element } from '@designhub/shared';
import { selectActivePage, useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';
import { cn } from '@/lib/utils';

const tool = 'grid h-9 w-9 place-items-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40';

/** Welches Farbfeld gehört zu einem Element? (Linien/Pfeile färbt die Kontur, Bilder haben keins.) */
const colorField = (el: Element): 'fill' | 'stroke' | null =>
  el.type === 'text' ? 'fill' : el.type === 'shape' ? (el.kind === 'line' || el.kind === 'arrow' ? 'stroke' : 'fill') : null;

const toHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000');

/** Kontextleiste für die Auswahl. Schriftart, Größe usw. folgen in Etappe (d). */
export function ContextToolbar() {
  const page = useDocumentStore(selectActivePage);
  const selectedIds = useUiStore((s) => s.selectedIds);
  const selected = (page?.elements ?? []).filter((e) => selectedIds.includes(e.id));
  const { updateElements, removeElements, duplicateElements, reorderElements } = useDocumentStore.getState();

  if (!selected.length) {
    return <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4 text-sm text-muted-foreground">Wähle ein Element aus oder füge links eines hinzu.</div>;
  }
  const ids = selected.map((e) => e.id);
  const first = selected[0];
  const field = colorField(first);
  const allLocked = selected.every((e) => e.locked);

  return (
    <div role="toolbar" aria-label="Eigenschaften der Auswahl" className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-3">
      {field && (
        <label className="mr-1 flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          Farbe
          <input type="color" aria-label="Farbe" value={toHex(String(first[field as keyof Element] ?? ''))} className="h-8 w-9 cursor-pointer rounded border border-border bg-card p-0.5"
            onChange={(e) => updateElements(ids.filter((id) => selected.find((s) => s.id === id && colorField(s) === field)), { [field]: e.target.value }, { coalesce: 'color' })} />
        </label>
      )}
      <label className="mr-2 flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
        Deckkraft
        <input type="range" min={0} max={100} aria-label="Deckkraft" value={Math.round(first.opacity * 100)} className="w-24 accent-[#7d2ae8]"
          onChange={(e) => updateElements(ids, { opacity: Number(e.target.value) / 100 }, { coalesce: 'opacity' })} />
        <span className="w-10 whitespace-nowrap tabular-nums">{Math.round(first.opacity * 100)} %</span>
      </label>
      <span className="mx-1 h-6 w-px bg-border" />
      <button className={tool} title="Ganz nach vorne" aria-label="Ganz nach vorne" onClick={() => reorderElements(ids, 'front')}><ArrowUpToLine className="h-4 w-4" /></button>
      <button className={tool} title="Eine Ebene nach vorne" aria-label="Eine Ebene nach vorne" onClick={() => reorderElements(ids, 'forward')}><ChevronUp className="h-4 w-4" /></button>
      <button className={tool} title="Eine Ebene nach hinten" aria-label="Eine Ebene nach hinten" onClick={() => reorderElements(ids, 'backward')}><ChevronDown className="h-4 w-4" /></button>
      <button className={tool} title="Ganz nach hinten" aria-label="Ganz nach hinten" onClick={() => reorderElements(ids, 'back')}><ArrowDownToLine className="h-4 w-4" /></button>
      <span className="mx-1 h-6 w-px bg-border" />
      <button className={cn(tool, allLocked && 'bg-muted')} title={allLocked ? 'Entsperren' : 'Sperren'} aria-label={allLocked ? 'Entsperren' : 'Sperren'} aria-pressed={allLocked}
        onClick={() => updateElements(ids, { locked: !allLocked })}>{allLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}</button>
      <button className={tool} title="Duplizieren (Strg+D)" aria-label="Duplizieren" onClick={() => useUiStore.getState().select(duplicateElements(ids))}><Copy className="h-4 w-4" /></button>
      <button className={cn(tool, 'text-red-600 dark:text-red-400')} title="Löschen (Entf)" aria-label="Löschen" onClick={() => removeElements(ids)}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
