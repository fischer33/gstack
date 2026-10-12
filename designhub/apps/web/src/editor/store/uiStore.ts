import { create } from 'zustand';
import type { Element } from '@designhub/shared';
import { MAX_ZOOM, MIN_ZOOM, type Point } from '../engine/viewport';
import { useDocumentStore, selectActivePage } from './documentStore';

interface UiState {
  selectedIds: string[];
  /** Element, dessen Text gerade inline bearbeitet wird */
  editingId: string | null;
  zoom: number;
  pan: Point;
  /** Leertaste gehalten: Hand-Werkzeug */
  spaceDown: boolean;
  clipboard: Element[];
  /** Sichtbare Größe der Arbeitsfläche in Pixeln (vom Canvas gemeldet), 0 bis zur ersten Messung */
  viewport: { width: number; height: number };

  select(ids: string[]): void;
  toggleSelect(id: string): void;
  clearSelection(): void;
  setEditing(id: string | null): void;
  setView(zoom: number, pan: Point): void;
  setPan(pan: Point): void;
  setSpaceDown(v: boolean): void;
  setClipboard(els: Element[]): void;
  setViewport(v: { width: number; height: number }): void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedIds: [],
  editingId: null,
  zoom: 0.5,
  pan: { x: 0, y: 0 },
  spaceDown: false,
  clipboard: [],
  viewport: { width: 0, height: 0 }, // 0 = noch nicht gemessen

  select: (ids) => set({ selectedIds: [...new Set(ids)] }),
  toggleSelect: (id) => set((s) => ({ selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] })),
  clearSelection: () => set({ selectedIds: [] }),
  setEditing: (editingId) => set({ editingId }),
  setView: (zoom, pan) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)), pan }),
  setPan: (pan) => set({ pan }),
  setSpaceDown: (spaceDown) => set({ spaceDown }),
  setClipboard: (clipboard) => set({ clipboard }),
  setViewport: (viewport) => set({ viewport }),
}));

/** Auswahl bereinigen, wenn Elemente verschwinden (Löschen, Undo). Einmalig beim Laden des Moduls registriert. */
useDocumentStore.subscribe((state) => {
  const { selectedIds, editingId, select, setEditing } = useUiStore.getState();
  if (!selectedIds.length && !editingId) return;
  const ids = new Set(selectActivePage(state)?.elements.map((e) => e.id));
  const kept = selectedIds.filter((id) => ids.has(id));
  if (kept.length !== selectedIds.length) select(kept);
  if (editingId && !ids.has(editingId)) setEditing(null);
});
