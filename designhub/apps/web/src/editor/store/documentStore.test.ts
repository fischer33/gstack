import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blankDocument, type ShapeElement } from '@designhub/shared';
import { canRedo, canUndo, selectActivePage, useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

const rect = (id: string, o: Partial<ShapeElement> = {}): ShapeElement => ({
  id, type: 'shape', kind: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, locked: false, visible: true,
  fill: '#f00', stroke: '#000', strokeWidth: 0, ...o,
});

const s = () => useDocumentStore.getState();
const els = () => selectActivePage(s())!.elements;
const order = () => els().map((e) => e.id).join('');

beforeEach(() => {
  vi.useRealTimers();
  useDocumentStore.getState().load(blankDocument(1000, 1000));
  useUiStore.setState({ selectedIds: [], editingId: null });
});

describe('Undo/Redo', () => {
  it('addElement → undo → redo', () => {
    s().addElement(rect('a'));
    expect(order()).toBe('a');
    expect(canUndo(s())).toBe(true);
    s().undo();
    expect(order()).toBe('');
    expect(canRedo(s())).toBe(true);
    s().redo();
    expect(order()).toBe('a');
  });

  it('eine neue Änderung verwirft den Redo-Zweig', () => {
    s().addElement(rect('a'));
    s().undo();
    s().addElement(rect('b'));
    expect(canRedo(s())).toBe(false);
    s().redo(); // wirkungslos
    expect(order()).toBe('b');
  });

  it('undo/redo ohne Historie sind wirkungslos', () => {
    s().undo(); s().redo();
    expect(order()).toBe('');
    expect(s().revision).toBe(0);
  });

  it('mehrere Schritte rückwärts und vorwärts', () => {
    s().addElement(rect('a')); s().addElement(rect('b')); s().updateElements(['a'], { x: 50 });
    s().undo(); expect(els()[0].x).toBe(0);
    s().undo(); expect(order()).toBe('a');
    s().undo(); expect(order()).toBe('');
    s().redo(); s().redo(); s().redo();
    expect(order()).toBe('ab');
    expect(els()[0].x).toBe(50);
  });

  it('Änderung ohne Effekt erzeugt keinen Eintrag', () => {
    s().addElement(rect('a'));
    const before = s().past.length;
    s().updateElements(['a'], { x: 0 }); // gleicher Wert
    s().updateElements(['gibt-es-nicht'], { x: 5 });
    expect(s().past.length).toBe(before);
  });

  it('coalesce fasst schnelle Änderungen zu einem Schritt zusammen, undo stellt den Ausgangszustand her', () => {
    s().addElement(rect('a'));
    s().moveElements(['a'], 1, 0, { coalesce: 'nudge' });
    s().moveElements(['a'], 1, 0, { coalesce: 'nudge' });
    s().moveElements(['a'], 1, 0, { coalesce: 'nudge' });
    expect(els()[0].x).toBe(3);
    expect(s().past.length).toBe(2); // add + 1 zusammengefasster Schritt
    s().undo();
    expect(els()[0].x).toBe(0);
    s().redo();
    expect(els()[0].x).toBe(3);
  });

  it('coalesce verschmilzt nicht nach Ablauf des Zeitfensters oder bei anderem Schlüssel', () => {
    vi.useFakeTimers();
    s().addElement(rect('a'));
    s().moveElements(['a'], 1, 0, { coalesce: 'nudge' });
    vi.advanceTimersByTime(1000);
    s().moveElements(['a'], 1, 0, { coalesce: 'nudge' });
    s().moveElements(['a'], 1, 0, { coalesce: 'other' });
    expect(s().past.length).toBe(4);
  });

  it('silent: Änderung ohne Undo-Eintrag, erhöht aber die Revision', () => {
    s().addElement(rect('a'));
    const past = s().past.length, rev = s().revision;
    s().updateElements(['a'], { height: 77 }, { silent: true });
    expect(els()[0].height).toBe(77);
    expect(s().past.length).toBe(past);
    expect(s().revision).toBe(rev + 1);
  });

  it('Historie ist auf 200 Schritte begrenzt', () => {
    for (let i = 0; i < 230; i++) s().addElement(rect(`e${i}`));
    expect(s().past.length).toBe(200);
  });

  it('load setzt Historie und Revision zurück', () => {
    s().addElement(rect('a'));
    s().load(blankDocument(500, 500));
    expect(s().past).toEqual([]);
    expect(s().revision).toBe(0);
    expect(order()).toBe('');
  });

  it('Revision zählt jede Änderung inkl. Undo/Redo', () => {
    s().addElement(rect('a'));
    s().undo();
    s().redo();
    expect(s().revision).toBe(3);
  });
});

describe('Elementoperationen', () => {
  it('updateEach: verschiedene Änderungen je Element in einem Schritt', () => {
    s().addElement(rect('a')); s().addElement(rect('b'));
    const before = s().past.length;
    s().updateEach({ a: { x: 10 }, b: { y: 20, rotation: 45 } });
    expect(s().past.length).toBe(before + 1);
    expect(els().map((e) => [e.x, e.y, e.rotation])).toEqual([[10, 0, 0], [0, 20, 45]]);
    s().undo();
    expect(els().map((e) => [e.x, e.y, e.rotation])).toEqual([[0, 0, 0], [0, 0, 0]]);
  });

  it('removeElements ist per Undo umkehrbar und behält die Position in der Reihenfolge', () => {
    for (const id of 'abc') s().addElement(rect(id));
    s().removeElements(['b']);
    expect(order()).toBe('ac');
    s().undo();
    expect(order()).toBe('abc');
  });

  it('duplicateElements: neue IDs, Versatz, Kopien liegen oben', () => {
    s().addElement(rect('a', { x: 10, y: 10 })); s().addElement(rect('b'));
    const [copy] = s().duplicateElements(['a']);
    expect(copy).not.toBe('a');
    expect(els().map((e) => e.id)).toEqual(['a', 'b', copy]);
    expect(els()[2]).toMatchObject({ x: 34, y: 34 });
    expect(els()[0]).toMatchObject({ x: 10, y: 10 }); // Original unverändert
  });

  it('pasteElements: mehrfaches Einfügen derselben Vorlage erzeugt jeweils eigene IDs', () => {
    const tpl = [rect('a')];
    const [i1] = s().pasteElements(tpl);
    const [i2] = s().pasteElements(tpl);
    expect(new Set([i1, i2, 'a']).size).toBe(3);
  });

  it('reorderElements: Undo stellt die Reihenfolge wieder her', () => {
    for (const id of 'abc') s().addElement(rect(id));
    s().reorderElements(['a'], 'front');
    expect(order()).toBe('bca');
    s().reorderElements(['a'], 'backward');
    expect(order()).toBe('bac');
    s().undo(); s().undo();
    expect(order()).toBe('abc');
  });

  it('setBackground', () => {
    s().setBackground({ type: 'solid', color: '#123456' });
    expect(selectActivePage(s())!.background).toEqual({ type: 'solid', color: '#123456' });
    s().undo();
    expect(selectActivePage(s())!.background).toEqual({ type: 'solid', color: '#ffffff' });
  });

  it('Operationen ohne geladenes Dokument sind wirkungslos', () => {
    s().reset();
    expect(() => { s().addElement(rect('a')); s().undo(); s().removeElements(['a']); }).not.toThrow();
  });
});

describe('Auswahl bleibt konsistent', () => {
  it('gelöschte oder per Undo entfernte Elemente verschwinden aus der Auswahl', () => {
    s().addElement(rect('a')); s().addElement(rect('b'));
    useUiStore.getState().select(['a', 'b']);
    s().removeElements(['a']);
    expect(useUiStore.getState().selectedIds).toEqual(['b']);
    s().undo(); // a ist zurück, Auswahl bleibt wie sie war
    expect(useUiStore.getState().selectedIds).toEqual(['b']);
    s().undo(); // b entfernt (Undo des Hinzufügens)
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });

  it('Bearbeitungsmodus endet, wenn das Element verschwindet', () => {
    s().addElement(rect('a'));
    useUiStore.getState().select(['a']);
    useUiStore.getState().setEditing('a');
    s().undo();
    expect(useUiStore.getState().editingId).toBeNull();
  });
});
