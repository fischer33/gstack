import { create } from 'zustand';
import type { Element } from '@designhub/shared';
import { MAX_ZOOM, MIN_ZOOM, type Point } from '../engine/viewport';
import { useDocumentStore, selectActivePage } from './documentStore';

/** Vom Nutzer aus den Linealen gezogene Hilfslinie. `x` = senkrecht (Position von links), `y` = waagerecht (von oben). */
export interface Guide { id: string; axis: 'x' | 'y'; pos: number }

export interface Upload { id: string; name: string; src: string; width: number; height: number }

interface UiState {
  selectedIds: string[];
  /** Element, dessen Text gerade inline bearbeitet wird */
  editingId: string | null;
  zoom: number;
  pan: Point;
  /** Leertaste gehalten: Hand-Werkzeug */
  spaceDown: boolean;
  clipboard: Element[];
  /** Lineale und Hilfslinien sichtbar */
  rulers: boolean;
  guides: Guide[];
  /** Bild, das gerade zugeschnitten wird */
  croppingId: string | null;
  /** Bilder, die in dieser Sitzung hochgeladen wurden (Uploads-Panel); dauerhaft erst mit dem Speichern (Etappe f) */
  uploads: Upload[];
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
  toggleRulers(): void;
  addGuide(axis: Guide['axis'], pos: number): void;
  moveGuide(id: string, pos: number): void;
  removeGuide(id: string): void;
  clearGuides(): void;
  setCropping(id: string | null): void;
  addUpload(u: Upload): void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedIds: [],
  editingId: null,
  zoom: 0.5,
  pan: { x: 0, y: 0 },
  spaceDown: false,
  clipboard: [],
  rulers: true,
  guides: [],
  croppingId: null,
  uploads: [],
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
  toggleRulers: () => set((s) => ({ rulers: !s.rulers })),
  addGuide: (axis, pos) => set((s) => ({ guides: [...s.guides, { id: crypto.randomUUID(), axis, pos }] })),
  moveGuide: (id, pos) => set((s) => ({ guides: s.guides.map((g) => (g.id === id ? { ...g, pos } : g)) })),
  removeGuide: (id) => set((s) => ({ guides: s.guides.filter((g) => g.id !== id) })),
  clearGuides: () => set({ guides: [] }),
  setCropping: (croppingId) => set({ croppingId }),
  addUpload: (u) => set((s) => ({ uploads: [u, ...s.uploads].slice(0, 30) })),
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
