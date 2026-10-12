import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Download, Loader2, Redo2, Ruler, Share2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { usePatchDesign } from '@/api/hooks';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { fitToView, zoomBy } from '@/editor/engine/viewActions';
import { canRedo, canUndo, useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';
import { flushSave, hasUnsaved, useSaveStore } from '@/editor/save/saveStore';

const ExportDialog = lazy(() => import('./ExportDialog'));
const ShareDialog = lazy(() => import('./ShareDialog'));

export const UNSAVED_WARNING = 'Deine letzten Änderungen konnten nicht gespeichert werden. Trotzdem verlassen?';

const ERROR_TEXT: Record<string, string> = {
  too_large: 'Zu groß zum Speichern',
  invalid_document: 'Design ungültig',
  not_found: 'Design nicht mehr verfügbar',
};

/** Speicherstatus im Kopf: sagt in einem Wort, ob etwas verloren gehen kann. */
function SaveBadge() {
  const { status, active, errorCode } = useSaveStore();
  if (!active) return null;
  const map = {
    saved: { Icon: Check, text: 'Gespeichert', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    dirty: { Icon: Loader2, text: 'Ungespeicherte Änderungen', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    saving: { Icon: Loader2, text: 'Speichert…', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    error: { Icon: AlertTriangle, text: `${ERROR_TEXT[errorCode ?? ''] ?? 'Speichern fehlgeschlagen'}, neuer Versuch folgt`, cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
    conflict: { Icon: AlertTriangle, text: 'Konflikt', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
  }[status];
  return (
    <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium md:inline-flex ${map.cls}`} role="status" data-testid="save-status" data-status={status}>
      <map.Icon className={`h-3.5 w-3.5 ${status === 'saving' ? 'animate-spin' : ''}`} />{map.text}
    </span>
  );
}

/** Titel: Klick zum Umbenennen (nur für Besitzer). */
function TitleField({ title, designId }: { title: string; designId: string | null }) {
  const patch = usePatchDesign();
  const [name, setName] = useState(title);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setName(title), [title]);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  const commit = () => {
    setEditing(false);
    const next = name.trim().slice(0, 120);
    if (!designId || !next || next === title) return void setName(title);
    patch.mutate({ id: designId, title: next }, { onError: () => setName(title) });
  };
  if (!designId) return <h1 className="mx-2 min-w-0 flex-1 truncate text-sm font-semibold sm:max-w-xs sm:flex-none">{title}</h1>;
  return editing ? (
    <input ref={input} value={name} maxLength={120} aria-label="Titel des Designs" onChange={(e) => setName(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(title); setEditing(false); } }} className="mx-2 h-8 min-w-0 flex-1 rounded-md border border-primary bg-background px-2 text-sm font-semibold sm:max-w-xs sm:flex-none" data-testid="title-input" />
  ) : (
    <h1 className="mx-2 min-w-0 flex-1 sm:max-w-xs sm:flex-none"><button type="button" onClick={() => setEditing(true)} title="Umbenennen" className="max-w-full truncate rounded-md px-2 py-1 text-sm font-semibold hover:bg-muted" data-testid="title-button">{name}</button></h1>
  );
}

export function EditorHeader({ title, designId }: { title: string; designId: string | null }) {
  const navigate = useNavigate();
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const hasUndo = useDocumentStore(canUndo);
  const hasRedo = useDocumentStore(canRedo);
  const zoom = useUiStore((s) => s.zoom);
  const rulers = useUiStore((s) => s.rulers);
  const guideCount = useUiStore((s) => s.guides.length);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setExportOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Erst speichern, dann gehen. Scheitert das Speichern, entscheidet der Nutzer.
  const back = async (e: React.MouseEvent) => {
    e.preventDefault();
    await flushSave();
    if (!hasUnsaved() || window.confirm(UNSAVED_WARNING)) navigate('/app');
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      {designId && <Link to="/app" onClick={(e) => void back(e)} aria-label="Zurück zum Dashboard" className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>}
      <span className="hidden sm:block"><Logo /></span>
      <TitleField title={title} designId={designId} />
      <SaveBadge />

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
        {designId && <Button size="sm" variant="outline" onClick={() => setShareOpen(true)} className="ml-1" data-testid="share-open"><Share2 className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Teilen</span><span className="sr-only sm:hidden">Teilen</span></Button>}
        <Button size="sm" onClick={() => setExportOpen(true)} className="ml-1" data-testid="export-open" title="Herunterladen (Strg+Umschalt+E)"><Download className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Herunterladen</span><span className="sr-only sm:hidden">Herunterladen</span></Button>
      </div>
      {shareOpen && designId && <Suspense fallback={null}><ShareDialog designId={designId} open onClose={() => setShareOpen(false)} /></Suspense>}
      {exportOpen && <Suspense fallback={null}><ExportDialog open onClose={() => setExportOpen(false)} title={title} /></Suspense>}
    </header>
  );
}
