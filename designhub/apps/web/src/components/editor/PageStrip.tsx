import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { pageToSvg, svgToDataUrl, type DesignDocument, type Page } from '@designhub/shared';
import { useDocumentStore } from '@/editor/store/documentStore';
import { cn } from '@/lib/utils';

/** Wert erst nach kurzer Ruhe übernehmen: Vorschaubilder sollen nicht bei jeder Mausbewegung neu entstehen. */
function useSettled<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function PageThumb({ page, doc }: { page: Page; doc: DesignDocument }) {
  const settled = useSettled(page, 400); // Immer ändert die Referenz nur bei echten Änderungen
  const src = useMemo(() => svgToDataUrl(pageToSvg(doc, settled)), [settled, doc.width, doc.height]); // eslint-disable-line react-hooks/exhaustive-deps
  return <img src={src} alt="" draggable={false} className="max-h-full max-w-full rounded-[2px] bg-white object-contain shadow-sm" />;
}

/** Seitenübersicht unten: wechseln, hinzufügen, duplizieren, löschen, per Ziehen oder Pfeilen umsortieren. */
export function PageStrip() {
  const doc = useDocumentStore((s) => s.doc);
  const activeId = useDocumentStore((s) => s.activePageId);
  const { setActivePage, addPage, duplicatePage, removePage, movePage } = useDocumentStore.getState();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  if (!doc) return null;

  const index = Math.max(0, doc.pages.findIndex((p) => p.id === activeId));
  const active = doc.pages[index];
  const btn = 'grid h-8 w-8 place-items-center rounded-md text-foreground transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex h-28 shrink-0 items-stretch gap-3 border-t border-border bg-background px-3 py-2" role="region" aria-label="Seiten">
      <div className="flex w-28 shrink-0 flex-col justify-between">
        <div className="text-sm font-medium" aria-live="polite">Seite {index + 1} von {doc.pages.length}</div>
        <div className="flex">
          <button className={btn} aria-label="Seite nach vorne verschieben" title="Seite nach vorne verschieben" disabled={index === 0} onClick={() => movePage(active.id, index - 1)}><ChevronLeft className="h-4 w-4" /></button>
          <button className={btn} aria-label="Seite nach hinten verschieben" title="Seite nach hinten verschieben" disabled={index === doc.pages.length - 1} onClick={() => movePage(active.id, index + 1)}><ChevronRight className="h-4 w-4" /></button>
          <button className={btn} aria-label="Seite duplizieren" title="Seite duplizieren" onClick={() => duplicatePage(active.id)}><Copy className="h-4 w-4" /></button>
          <button className={cn(btn, 'text-red-600 dark:text-red-400')} aria-label="Seite löschen" title="Seite löschen" disabled={doc.pages.length <= 1} onClick={() => removePage(active.id)}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <ol className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto" aria-label="Seitenvorschau">
        {doc.pages.map((p, i) => (
          <li key={p.id} className="h-full shrink-0">
            <button
              onClick={() => setActivePage(p.id)} aria-label={`Seite ${i + 1}`} aria-current={p.id === activeId ? 'page' : undefined} data-page-id={p.id}
              draggable onDragStart={(e) => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }} onDragEnd={() => { setDragId(null); setOverId(null); }}
              onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== p.id) movePage(dragId, i); setDragId(null); setOverId(null); }}
              className={cn('grid h-full w-24 place-items-center rounded-md border-2 bg-muted p-1.5 transition-all', p.id === activeId ? 'border-primary' : 'border-transparent hover:border-border',
                dragId === p.id && 'opacity-40', overId === p.id && dragId && dragId !== p.id && 'ring-2 ring-primary/60')}>
              <PageThumb page={p} doc={doc} />
            </button>
          </li>
        ))}
        <li className="shrink-0">
          <button onClick={() => addPage()} aria-label="Seite hinzufügen" title="Seite hinzufügen" className="grid h-20 w-14 place-items-center rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"><Plus className="h-5 w-5" /></button>
        </li>
      </ol>
    </div>
  );
}
