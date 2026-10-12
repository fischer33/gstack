import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { create } from 'zustand';
import type { DesignDocument, Element, Page } from '@designhub/shared';
import { newId } from '@designhub/shared';
import { alignOffsets, distributeOffsets, type AlignMode, type Offsets } from './alignOps';
import { groupElements as groupOp, ungroupElement as ungroupOp } from './groupOps';
import { cloneElement, moveItem, reorder, reorderToIndex, type ReorderDirection } from './pageOps';

enablePatches();

const MAX_HISTORY = 200;
/** Aufeinanderfolgende Änderungen mit gleichem Schlüssel in diesem Zeitfenster werden zu einem Undo-Schritt. */
const COALESCE_MS = 600;

interface Entry { patches: Patch[]; inverse: Patch[]; key?: string; at: number }
export interface MutateOptions {
  /** Änderungen mit gleichem Schlüssel (z. B. Pfeiltasten, Schieberegler) zu einem Schritt zusammenfassen */
  coalesce?: string;
  /** Ohne Undo-Eintrag anwenden (z. B. gemessene Texthöhe) */
  silent?: boolean;
}

export type ElementPatch = Partial<Record<string, unknown>>;

interface DocumentState {
  doc: DesignDocument | null;
  activePageId: string | null;
  past: Entry[];
  future: Entry[];
  /** Zählt jede Änderung am Dokument (auch Undo/Redo); Basis für Autosave in Etappe (f). */
  revision: number;

  load(doc: DesignDocument): void;
  reset(): void;
  mutate(recipe: (draft: DesignDocument) => void, opts?: MutateOptions): void;
  undo(): void;
  redo(): void;

  addElement(el: Element): void;
  updateElements(ids: readonly string[], patch: ElementPatch, opts?: MutateOptions): void;
  /** Je Element eigene Änderungen in einem Undo-Schritt (Transformer, Mehrfach-Drag). */
  updateEach(patches: Record<string, ElementPatch>, opts?: MutateOptions): void;
  moveElements(ids: readonly string[], dx: number, dy: number, opts?: MutateOptions): void;
  removeElements(ids: readonly string[]): void;
  /** Dupliziert die Elemente (leicht versetzt) und liefert die neuen IDs. */
  duplicateElements(ids: readonly string[]): string[];
  /** Fügt Kopien ein (Einfügen aus der Zwischenablage) und liefert die neuen IDs. */
  pasteElements(elements: readonly Element[], offset?: number): string[];
  reorderElements(ids: readonly string[], dir: ReorderDirection): void;
  /** Elemente als Block an eine Position setzen (Ebenenpanel, Drag-Sortierung); Index zählt ohne die Verschobenen */
  reorderToIndex(ids: readonly string[], index: number): void;
  setBackground(bg: Page['background']): void;

  /** Fasst Elemente zusammen und liefert die ID der Gruppe (oder null bei weniger als zwei Elementen). */
  group(ids: readonly string[]): string | null;
  /** Löst eine Gruppe auf und liefert die IDs der Kinder. */
  ungroup(groupId: string): string[];
  align(ids: readonly string[], mode: AlignMode): void;
  distribute(ids: readonly string[], axis: 'x' | 'y'): void;

  // ---- Seiten ----
  setActivePage(id: string): void;
  addPage(): string;
  duplicatePage(id: string): string | null;
  removePage(id: string): void;
  movePage(id: string, toIndex: number): void;
  /** Ersetzt Inhalt und Hintergrund der aktiven Seite (z. B. beim Anwenden einer Vorlage). */
  replaceActivePage(page: Pick<Page, 'background' | 'elements'>): void;
}

const pageOf = (doc: DesignDocument, id: string | null): Page | undefined => doc.pages.find((p) => p.id === id) ?? doc.pages[0];

/** Nach Undo/Redo kann die aktive Seite verschwunden sein (z. B. Undo von "Seite hinzufügen"): dann auf die erste ausweichen. */
const validPage = (doc: DesignDocument, id: string | null) => (doc.pages.some((p) => p.id === id) ? id : (doc.pages[0]?.id ?? null));

export const useDocumentStore = create<DocumentState>((set, get) => ({
  doc: null,
  activePageId: null,
  past: [],
  future: [],
  revision: 0,

  load: (doc) => set({ doc, activePageId: doc.pages[0]?.id ?? null, past: [], future: [], revision: 0 }),
  reset: () => set({ doc: null, activePageId: null, past: [], future: [], revision: 0 }),

  mutate(recipe, opts = {}) {
    const { doc, past } = get();
    if (!doc) return;
    const [next, patches, inverse] = produceWithPatches(doc, recipe);
    if (!patches.length) return; // nichts geändert: kein Undo-Eintrag, keine Revision
    if (opts.silent) return void set((s) => ({ doc: next, revision: s.revision + 1 }));

    const now = Date.now();
    const last = past[past.length - 1];
    const merge = opts.coalesce && last && last.key === opts.coalesce && now - last.at < COALESCE_MS;
    const entry: Entry = merge
      ? { patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], key: opts.coalesce, at: now }
      : { patches, inverse, key: opts.coalesce, at: now };
    const nextPast = merge ? [...past.slice(0, -1), entry] : [...past, entry].slice(-MAX_HISTORY);
    set((s) => ({ doc: next, past: nextPast, future: [], revision: s.revision + 1 }));
  },

  undo() {
    const { doc, past, future } = get();
    const entry = past[past.length - 1];
    if (!doc || !entry) return;
    const next = applyPatches(doc, entry.inverse);
    set((s) => ({ doc: next, activePageId: validPage(next, s.activePageId), past: past.slice(0, -1), future: [...future, entry], revision: s.revision + 1 }));
  },

  redo() {
    const { doc, past, future } = get();
    const entry = future[future.length - 1];
    if (!doc || !entry) return;
    // `key` bleibt erhalten, `at` wird zurückgesetzt, damit ein Redo nie mit späteren Änderungen verschmilzt
    const next = applyPatches(doc, entry.patches);
    set((s) => ({ doc: next, activePageId: validPage(next, s.activePageId), past: [...past, { ...entry, at: 0 }], future: future.slice(0, -1), revision: s.revision + 1 }));
  },

  addElement(el) {
    get().mutate((d) => { pageOf(d, get().activePageId)?.elements.push(el); });
  },

  updateElements(ids, patch, opts) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      for (const el of page?.elements ?? []) if (ids.includes(el.id)) Object.assign(el, patch);
    }, opts);
  },

  updateEach(patches, opts) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      for (const el of page?.elements ?? []) if (patches[el.id]) Object.assign(el, patches[el.id]);
    }, opts);
  },

  moveElements(ids, dx, dy, opts) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      for (const el of page?.elements ?? []) if (ids.includes(el.id)) { el.x += dx; el.y += dy; }
    }, opts);
  },

  removeElements(ids) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      if (page) page.elements = page.elements.filter((e) => !ids.includes(e.id));
    });
  },

  duplicateElements(ids) {
    const page = get().doc && pageOf(get().doc!, get().activePageId);
    return get().pasteElements((page?.elements ?? []).filter((e) => ids.includes(e.id)), 24);
  },

  pasteElements(elements, offset = 24) {
    const copies = elements.map((e) => cloneElement(e, newId, offset, offset));
    if (copies.length) get().mutate((d) => { pageOf(d, get().activePageId)?.elements.push(...copies); });
    return copies.map((c) => c.id);
  },

  reorderElements(ids, dir) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      if (page) page.elements = reorder(page.elements, ids, dir);
    });
  },

  reorderToIndex(ids, index) {
    get().mutate((d) => {
      const page = pageOf(d, get().activePageId);
      if (page) page.elements = reorderToIndex(page.elements, ids, index);
    });
  },

  setBackground(bg) {
    get().mutate((d) => { const p = pageOf(d, get().activePageId); if (p) p.background = bg; });
  },

  group(ids) {
    const page = get().doc && pageOf(get().doc!, get().activePageId);
    if (!page) return null;
    const { elements, groupId } = groupOp(page.elements, ids);
    if (!groupId) return null;
    get().mutate((d) => { const p = pageOf(d, get().activePageId); if (p) p.elements = elements; });
    return groupId;
  },

  ungroup(groupId) {
    const page = get().doc && pageOf(get().doc!, get().activePageId);
    if (!page) return [];
    const { elements, childIds } = ungroupOp(page.elements, groupId);
    if (!childIds.length) return [];
    get().mutate((d) => { const p = pageOf(d, get().activePageId); if (p) p.elements = elements; });
    return childIds;
  },

  align(ids, mode) {
    const { doc } = get();
    const page = doc && pageOf(doc, get().activePageId);
    if (page) applyOffsets(get(), alignOffsets(page.elements.filter((e) => ids.includes(e.id) && !e.locked), mode, doc!));
  },

  distribute(ids, axis) {
    const { doc } = get();
    const page = doc && pageOf(doc, get().activePageId);
    if (page) applyOffsets(get(), distributeOffsets(page.elements.filter((e) => ids.includes(e.id) && !e.locked), axis));
  },

  setActivePage: (id) => set((s) => (s.doc?.pages.some((p) => p.id === id) ? { activePageId: id } : s)),

  addPage() {
    const page: Page = { id: newId(), background: { type: 'solid', color: '#ffffff' }, elements: [] };
    const { doc, activePageId } = get();
    if (!doc) return page.id;
    const at = Math.max(0, doc.pages.findIndex((p) => p.id === activePageId)) + 1; // direkt hinter der aktiven Seite
    get().mutate((d) => { d.pages.splice(at, 0, page); });
    set({ activePageId: page.id });
    return page.id;
  },

  duplicatePage(id) {
    const src = get().doc?.pages.find((p) => p.id === id);
    if (!src) return null;
    const copy: Page = { id: newId(), background: JSON.parse(JSON.stringify(src.background)), elements: src.elements.map((e) => cloneElement(e, newId)) };
    const at = get().doc!.pages.findIndex((p) => p.id === id) + 1;
    get().mutate((d) => { d.pages.splice(at, 0, copy); });
    set({ activePageId: copy.id });
    return copy.id;
  },

  removePage(id) {
    const { doc, activePageId } = get();
    if (!doc || doc.pages.length <= 1) return; // ein Design hat immer mindestens eine Seite
    const index = doc.pages.findIndex((p) => p.id === id);
    if (index < 0) return;
    get().mutate((d) => { d.pages.splice(index, 1); });
    if (activePageId === id) set({ activePageId: get().doc!.pages[Math.min(index, get().doc!.pages.length - 1)].id });
  },

  movePage(id, toIndex) {
    const from = get().doc?.pages.findIndex((p) => p.id === id) ?? -1;
    if (from < 0 || from === toIndex) return;
    get().mutate((d) => { d.pages = moveItem(d.pages, from, toIndex); });
  },

  replaceActivePage(next) {
    get().mutate((d) => {
      const p = pageOf(d, get().activePageId);
      if (p) { p.background = next.background; p.elements = next.elements as Element[]; }
    });
  },
}));

function applyOffsets(s: Pick<DocumentState, 'updateEach' | 'doc' | 'activePageId'>, offsets: Offsets) {
  const page = s.doc && pageOf(s.doc, s.activePageId);
  const patches: Record<string, ElementPatch> = {};
  for (const e of page?.elements ?? []) {
    const o = offsets[e.id];
    if (o && (o.dx || o.dy)) patches[e.id] = { x: Math.round((e.x + o.dx) * 100) / 100, y: Math.round((e.y + o.dy) * 100) / 100 };
  }
  s.updateEach(patches);
}

// ---- Lese-Helfer (außerhalb von Komponenten und in Tests) ----
export const selectActivePage = (s: Pick<DocumentState, 'doc' | 'activePageId'>): Page | undefined => (s.doc ? pageOf(s.doc, s.activePageId) : undefined);
export const canUndo = (s: DocumentState) => s.past.length > 0;
export const canRedo = (s: DocumentState) => s.future.length > 0;
