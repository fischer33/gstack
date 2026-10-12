import { ArrowLeft, Redo2, Ruler, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { fitToView, zoomBy } from '@/editor/engine/viewActions';
import { canRedo, canUndo, useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';

export const UNSAVED_WARNING = 'Du hast Änderungen, die noch nicht gespeichert werden können. Trotzdem verlassen?';

export function EditorHeader({ title }: { title: string }) {
  const navigate = useNavigate();
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const hasUndo = useDocumentStore(canUndo);
  const hasRedo = useDocumentStore(canRedo);
  const dirty = useDocumentStore((s) => s.revision > 0);
  const zoom = useUiStore((s) => s.zoom);
  const rulers = useUiStore((s) => s.rulers);
  const guideCount = useUiStore((s) => s.guides.length);

  // Speichern kommt in Etappe (f). Bis dahin warnen wir, bevor Änderungen verloren gehen.
  const back = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!dirty || window.confirm(UNSAVED_WARNING)) navigate('/app');
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Link to="/app" onClick={back} aria-label="Zurück zum Dashboard" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
      <span className="hidden sm:block"><Logo /></span>
      <h1 className="mx-2 min-w-0 flex-1 truncate text-sm font-semibold sm:flex-none sm:max-w-xs">{title}</h1>
      <span className="hidden rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 md:inline" role="status">
        {dirty ? 'Nicht gespeichert (Speichern folgt in Etappe f)' : 'Keine Änderungen'}
      </span>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={undo} disabled={!hasUndo} aria-label="Rückgängig (Strg+Z)" title="Rückgängig (Strg+Z)"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!hasRedo} aria-label="Wiederholen (Strg+Umschalt+Z)" title="Wiederholen (Strg+Umschalt+Z)"><Redo2 className="h-4 w-4" /></Button>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Button variant="ghost" size="sm" onClick={() => zoomBy(0.8)} aria-label="Verkleinern" className="hidden sm:inline-flex"><ZoomOut className="h-4 w-4" /></Button>
        <button onClick={fitToView} title="Auf Fenster anpassen (Strg+0)" aria-label="Zoom, klicken zum Anpassen" className="w-14 rounded-md px-2 py-1 text-center text-sm tabular-nums hover:bg-muted">{Math.round(zoom * 100)} %</button>
        <Button variant="ghost" size="sm" onClick={() => zoomBy(1.25)} aria-label="Vergrößern" className="hidden sm:inline-flex"><ZoomIn className="h-4 w-4" /></Button>
        <Popover label="Ansicht" width={260} triggerClassName="grid h-9 w-9 place-items-center rounded-md hover:bg-muted" trigger={<Ruler className="h-4 w-4" />}>
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={rulers} onChange={() => useUiStore.getState().toggleRulers()} /> Lineale und Hilfslinien <kbd className="ml-auto rounded border border-border px-1 text-xs text-muted-foreground">⇧R</kbd></label>
            <p className="text-xs text-muted-foreground">Ziehe aus einem Lineal eine Hilfslinie auf die Fläche. Elemente rasten daran ein. Zum Löschen zurück auf das Lineal ziehen.</p>
            <button type="button" disabled={!guideCount} onClick={() => useUiStore.getState().clearGuides()} className="w-full rounded-md border border-border py-1.5 hover:bg-muted disabled:opacity-50">Alle Hilfslinien löschen ({guideCount})</button>
          </div>
        </Popover>
        <span className="ml-1 hidden sm:block"><ThemeToggle /></span>
      </div>
    </header>
  );
}
