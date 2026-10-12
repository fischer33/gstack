import { create } from 'zustand';
import type { SaveStatus } from './autosave';

interface SaveState {
  status: SaveStatus;
  /** Ob der Editor überhaupt speichert (false bei Leistungstest ?bench=…) */
  active: boolean;
  lastSavedAt: number | null;
  errorCode: string | null;
  set(p: Partial<Omit<SaveState, 'set'>>): void;
}

export const useSaveStore = create<SaveState>((set) => ({ status: 'saved', active: false, lastSavedAt: null, errorCode: null, set: (p) => set(p) }));

/** Beim Neu-Laden nach einem Konflikt wird bewusst verworfen; die Browser-Warnung wäre dann falsch. */
export const unloadGuard = { skip: false };

type Controller = { flush(): Promise<void>; overwrite(): Promise<void>; readonly dirty: boolean; readonly busy: boolean };
let current: Controller | null = null;
export const setController = (c: Controller | null) => { current = c; };
/** Sofort speichern (Strg+S, vor dem Verlassen). Ohne aktiven Editor passiert nichts. */
export const flushSave = async () => { await current?.flush(); };
export const overwriteSave = async () => { await current?.overwrite(); };
export const hasUnsaved = () => !!current && (current.dirty || current.busy || useSaveStore.getState().status === 'error' || useSaveStore.getState().status === 'conflict');
