import { useEffect } from 'react';
import { selectActivePage, useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { fitToView, zoomBy, zoomTo } from './viewActions';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/** Alle Tastenkürzel des Editors. Ignoriert Eingaben in Formularfeldern und während der Textbearbeitung. */
export function useEditorShortcuts() {
  useEffect(() => {
    const doc = () => useDocumentStore.getState();
    const ui = () => useUiStore.getState();
    const selected = () => {
      const page = selectActivePage(doc());
      return (page?.elements ?? []).filter((e) => ui().selectedIds.includes(e.id));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || ui().editingId) return;
      const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();

      if (ui().croppingId && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); return ui().setCropping(null); }

      if (e.code === 'Space') { e.preventDefault(); if (!ui().spaceDown) ui().setSpaceDown(true); return; }

      if (mod) {
        switch (key) {
          case 'z': e.preventDefault(); return void (e.shiftKey ? doc().redo() : doc().undo());
          case 'y': e.preventDefault(); return doc().redo();
          case 'a': e.preventDefault(); return ui().select((selectActivePage(doc())?.elements ?? []).filter((x) => x.visible).map((x) => x.id));
          case 'c': { const els = selected(); if (els.length) ui().setClipboard(JSON.parse(JSON.stringify(els))); return; }
          case 'x': {
            const els = selected(); if (!els.length) return;
            e.preventDefault(); ui().setClipboard(JSON.parse(JSON.stringify(els))); return doc().removeElements(els.map((x) => x.id));
          }
          case 'v': {
            const clip = ui().clipboard;
            if (!clip.length) return; // leer: das Browser-paste-Event kümmert sich um Bilder aus der Zwischenablage
            e.preventDefault(); return ui().select(doc().pasteElements(clip));
          }
          case 'g': { // Strg+G gruppiert, Strg+Umschalt+G löst die Gruppe auf
            e.preventDefault();
            const els = selected();
            if (e.shiftKey) { const g = els.length === 1 && els[0].type === 'group' ? els[0] : null; if (g) ui().select(doc().ungroup(g.id)); return; }
            const id = doc().group(els.map((x) => x.id)); if (id) ui().select([id]); return;
          }
          case 'd': { e.preventDefault(); const ids = selected().map((x) => x.id); if (ids.length) ui().select(doc().duplicateElements(ids)); return; }
          case '0': e.preventDefault(); return fitToView();
          case '1': e.preventDefault(); return zoomTo(1);
          case '=': case '+': e.preventDefault(); return zoomBy(1.25);
          case '-': e.preventDefault(); return zoomBy(0.8);
        }
        return;
      }

      if (e.shiftKey && key === 'r') { e.preventDefault(); return ui().toggleRulers(); }

      const els = selected();
      if (key === 'delete' || key === 'backspace') { if (els.length) { e.preventDefault(); doc().removeElements(els.map((x) => x.id)); } return; }
      if (key === 'escape') return ui().clearSelection();
      if (key === 'enter' && els.length === 1 && els[0].type === 'text' && !els[0].locked) { e.preventDefault(); return ui().setEditing(els[0].id); }
      if (key.startsWith('arrow') && els.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = key === 'arrowleft' ? [-step, 0] : key === 'arrowright' ? [step, 0] : key === 'arrowup' ? [0, -step] : [0, step];
        // coalesce: Gedrückthalten einer Pfeiltaste ist ein einziger Undo-Schritt
        doc().moveElements(els.filter((x) => !x.locked).map((x) => x.id), dx, dy, { coalesce: 'nudge' });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') ui().setSpaceDown(false); };
    const onBlur = () => ui().setSpaceDown(false); // Fokus weg bei gedrückter Leertaste: Hand-Werkzeug nicht hängen lassen
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur); };
  }, []);
}
