import type { Element, ShapeKind } from '@designhub/shared';
import { useToast } from '@/components/ui/toast';
import { createIcon, createImage, createShape, createSticker, createText, createTextFromPreset, readImageFile, type TextKind, type TextPreset } from '@/editor/engine/factories';
import type { IconDef } from '@/editor/lib/icons';
import { ensureFont } from '@/editor/lib/fonts';
import { useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore, type Upload } from '@/editor/store/uiStore';

type Page = { width: number; height: number };

/** Alle Wege, Elemente einzufügen (Panels, Tastatur, Drag & Drop). Neue Elemente sitzen mittig und sind ausgewählt. */
export function useAddElements() {
  const { toast } = useToast();

  const place = (build: (page: Page) => Element, edit = false) => {
    const doc = useDocumentStore.getState().doc;
    if (!doc) return;
    const el = build(doc);
    useDocumentStore.getState().addElement(el);
    useUiStore.getState().select([el.id]);
    if (edit) useUiStore.getState().setEditing(el.id); // neuer Text: direkt tippen
  };

  const addImageSrc = (src: string, size: { width: number; height: number }) => place((p) => createImage(p, src, size));

  return {
    addText: (kind: TextKind) => place((p) => createText(p, kind), true),
    addTextPreset: async (preset: TextPreset) => { await ensureFont(preset.font); place((p) => createTextFromPreset(p, preset), true); },
    addShape: (kind: ShapeKind) => place((p) => createShape(p, kind)),
    addIcon: (icon: IconDef) => place((p) => createIcon(p, icon)),
    addSticker: (emoji: string) => place((p) => createSticker(p, emoji)),
    addUpload: (u: Upload) => addImageSrc(u.src, u),
    /** Datei lesen, in die Upload-Liste aufnehmen und einfügen. */
    addImage: async (file: File) => {
      try {
        const img = await readImageFile(file);
        useUiStore.getState().addUpload({ id: crypto.randomUUID(), name: file.name, ...img });
        addImageSrc(img.src, img);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Das Bild konnte nicht eingefügt werden.', 'error');
      }
    },
  };
}
