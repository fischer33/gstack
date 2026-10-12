import type Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDesign } from '@/api/hooks';
import { ContextToolbar } from '@/components/editor/ContextToolbar';
import { EditorHeader } from '@/components/editor/EditorHeader';
import { PageStrip } from '@/components/editor/PageStrip';
import { Sidebar } from '@/components/editor/Sidebar';
import { useAddElements } from '@/components/editor/useAddElements';
import { buttonVariants } from '@/components/ui/button';
import { makeBenchElements } from '@/editor/engine/bench';
import { fontsOf } from '@/editor/lib/docFonts';
import { ensureFonts } from '@/editor/lib/fonts';
import { EditorCanvas } from '@/editor/engine/EditorCanvas';
import { TextEditorOverlay } from '@/editor/engine/TextEditorOverlay';
import { useEditorShortcuts } from '@/editor/engine/useEditorShortcuts';
import { useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';

/** Editor-Seite: lädt das Design in den Store und hängt Canvas, Werkzeuge und Tastenkürzel ein. */
export function EditorPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data: design, isLoading, isError } = useDesign(id);
  const stageRef = useRef<Konva.Stage>(null);
  const loadedId = useRef<string | null>(null);
  const { addImage } = useAddElements();
  useEditorShortcuts();
  if (import.meta.env.DEV) (window as unknown as { __designhub: Record<string, unknown> }).__designhub.getStage = () => stageRef.current;

  // Design genau einmal pro ID in den Store laden (ein späteres Refetch darf Änderungen nicht überschreiben).
  // Vorher die benötigten Schriften laden, damit Texte sofort richtig umbrechen und die Höhen stimmen.
  useEffect(() => {
    if (!design || loadedId.current === design.id) return;
    loadedId.current = design.id;
    let cancelled = false;
    void (async () => {
      await ensureFonts(design.pages.flatMap((p) => [...fontsOf(p.elements)]));
      if (cancelled) return;
      const { load, mutate } = useDocumentStore.getState();
      useUiStore.getState().clearSelection();
      load({ version: 1, width: design.width, height: design.height, pages: design.pages });
      // Leistungstest: ?bench=300 fügt 300 Testobjekte (nur im Speicher) hinzu
      const n = Number(params.get('bench'));
      if (Number.isInteger(n) && n > 0 && n <= 5000) {
        mutate((d) => { d.pages[0].elements.push(...makeBenchElements(n, d)); }, { silent: true });
      }
    })();
    return () => { cancelled = true; if (!useDocumentStore.getState().doc) loadedId.current = null; };
  }, [design, params]);

  useEffect(() => () => { loadedId.current = null; useDocumentStore.getState().reset(); useUiStore.getState().clearSelection(); }, [id]);

  // Warnung beim Schließen des Tabs, solange es noch kein Speichern gibt (Etappe f)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (useDocumentStore.getState().revision > 0) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Bilder per Einfügen (Strg+V) und Drag & Drop
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      for (const item of e.clipboardData?.items ?? []) if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) void addImage(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImage]);

  if (isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Lädt…</div>;
  if (isError || !design) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-2xl font-bold">Design nicht gefunden</h1>
          <p className="mt-2 text-muted-foreground">Es existiert nicht, liegt im Papierkorb oder gehört jemand anderem.</p>
          <Link to="/app/designs" className={buttonVariants({ className: 'mt-6' })}>Zu meinen Designs</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); [...e.dataTransfer.files].forEach((f) => void addImage(f)); }}>
      <EditorHeader title={design.title} />
      <ContextToolbar />
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="relative min-h-0 flex-1">
            <EditorCanvas stageRef={stageRef} />
            <TextEditorOverlay />
          </main>
          <PageStrip />
        </div>
      </div>
    </div>
  );
}

// Nur für Ende-zu-Ende-Tests und Fehlersuche im Entwicklungsmodus
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__designhub = { doc: useDocumentStore, ui: useUiStore };
}
