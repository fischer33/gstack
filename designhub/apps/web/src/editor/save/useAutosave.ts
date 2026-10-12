import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { DesignDocument, SaveResult } from '@designhub/shared';
import { ApiError, api } from '@/lib/api';
import { useDocumentStore } from '../store/documentStore';
import { Autosave, ConflictError } from './autosave';
import { hasUnsaved, setController, unloadGuard, useSaveStore } from './saveStore';
import { thumbnailCache } from './thumbnail';

export type SaveTarget = { kind: 'owner'; id: string } | { kind: 'share'; token: string };

/**
 * Hängt Autosave an den Dokument-Store: entprelltes Speichern, Strg+S, Speichern beim Tab-Wechsel und eine Warnung
 * beim Schließen, solange etwas nicht gespeichert ist. `ready` wird true, sobald das Design im Store liegt.
 */
export function useAutosave(target: SaveTarget, version: number | undefined, ready: boolean, enabled = true) {
  const qc = useQueryClient();
  const key = target.kind === 'owner' ? target.id : target.token;

  useEffect(() => {
    const set = useSaveStore.getState().set;
    if (!ready || !enabled || version === undefined) { set({ active: false }); return; }
    const getThumb = thumbnailCache();
    let lastDoc: DesignDocument | null = null; // nach dem Verlassen der Seite ist der Store schon leer, das letzte Speichern braucht den Stand trotzdem
    const url = target.kind === 'owner' ? `/designs/${target.id}` : `/share/${target.token}`;

    const ctrl = new Autosave<DesignDocument>({
      version,
      getRevision: () => useDocumentStore.getState().revision,
      snapshot: () => { lastDoc = useDocumentStore.getState().doc ?? lastDoc; return lastDoc!; },
      send: async (doc, v) => {
        const thumbnail = await getThumb(doc);
        try {
          const out = await api<SaveResult>(url, { method: 'PUT', body: { width: doc.width, height: doc.height, pages: doc.pages, version: v, thumbnail } });
          void qc.invalidateQueries({ queryKey: ['designs'] });
          return out;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) throw new ConflictError(Number(err.body.version) || v);
          throw err;
        }
      },
      onStatus: (status, info) => {
        const code = info.error instanceof ApiError ? info.error.code : info.error ? 'network' : null;
        set({ status, errorCode: code, ...(status === 'saved' ? { lastSavedAt: Date.now() } : {}) });
      },
    });
    set({ active: true, status: 'saved', errorCode: null });
    setController(ctrl);
    unloadGuard.skip = false;

    const unsub = useDocumentStore.subscribe((s, prev) => { if (s.revision !== prev.revision) ctrl.changed(); });
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); void ctrl.flush(); }
    };
    const onHide = () => { if (document.visibilityState === 'hidden') void ctrl.flush(); };
    const onUnload = (e: BeforeUnloadEvent) => { if (!unloadGuard.skip && hasUnsaved()) e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    // Änderungen, die schon vor dem Anhängen passiert sind
    ctrl.changed();

    return () => {
      unsub();
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      void ctrl.flush().finally(() => ctrl.dispose()); // beim Verlassen der Seite ein letztes Mal speichern
      setController(null);
      set({ active: false });
    };
    // target ist über `key` abgedeckt; version wird nur beim Anhängen gelesen (danach führt der Controller sie selbst)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, key]);
}
