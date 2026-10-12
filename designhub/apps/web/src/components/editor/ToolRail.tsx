import { ArrowRight, Circle, ImagePlus, Minus, Square, Star, Type } from 'lucide-react';
import { useRef } from 'react';
import type { ShapeKind } from '@designhub/shared';
import { Menu } from '@/components/ui/menu';
import { useToast } from '@/components/ui/toast';
import { TEXT_KINDS, createShape, createText, readImageFile, createImage, type TextKind } from '@/editor/engine/factories';
import { useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';

const SHAPES: { kind: ShapeKind; label: string; Icon: typeof Square }[] = [
  { kind: 'rect', label: 'Rechteck', Icon: Square }, { kind: 'ellipse', label: 'Kreis', Icon: Circle },
  { kind: 'line', label: 'Linie', Icon: Minus }, { kind: 'arrow', label: 'Pfeil', Icon: ArrowRight }, { kind: 'star', label: 'Stern', Icon: Star },
];

const btn = 'flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-16';

/** Platziert ein neues Element mittig auf der Seite und wählt es aus. */
export function useAddElements() {
  const { toast } = useToast();
  const add = (build: (page: { width: number; height: number }) => ReturnType<typeof createText> | ReturnType<typeof createShape>, edit = false) => {
    const doc = useDocumentStore.getState().doc;
    if (!doc) return;
    const el = build(doc);
    useDocumentStore.getState().addElement(el);
    useUiStore.getState().select([el.id]);
    if (edit) useUiStore.getState().setEditing(el.id); // neuer Text: direkt tippen
  };
  const addImage = async (file: File) => {
    try {
      const doc = useDocumentStore.getState().doc;
      if (!doc) return;
      const { src, width, height } = await readImageFile(file);
      const el = createImage(doc, src, { width, height });
      useDocumentStore.getState().addElement(el);
      useUiStore.getState().select([el.id]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Das Bild konnte nicht eingefügt werden.', 'error');
    }
  };
  return {
    addText: (kind: TextKind) => add((p) => createText(p, kind), true),
    addShape: (kind: ShapeKind) => add((p) => createShape(p, kind)),
    addImage,
  };
}

export function ToolRail() {
  const { addText, addShape, addImage } = useAddElements();
  const file = useRef<HTMLInputElement>(null);
  return (
    <nav aria-label="Elemente hinzufügen" className="flex shrink-0 items-center justify-around gap-1 border-t border-border bg-background p-1 md:w-[4.5rem] md:flex-col md:justify-start md:border-r md:border-t-0 md:p-1.5">
      <Menu label="Text hinzufügen" className="md:w-full" popoverClassName="bottom-full left-0 mb-1 md:bottom-auto md:left-full md:top-0 md:mb-0 md:ml-1"
        trigger={<span className={btn}><Type className="h-5 w-5" />Text</span>}
        items={TEXT_KINDS.map((t) => ({ label: t.label, onSelect: () => addText(t.kind) }))} />
      {SHAPES.map(({ kind, label, Icon }) => (
        <button key={kind} onClick={() => addShape(kind)} className={btn} aria-label={`${label} hinzufügen`}><Icon className="h-5 w-5" />{label}</button>
      ))}
      <button onClick={() => file.current?.click()} className={btn} aria-label="Bild hinzufügen"><ImagePlus className="h-5 w-5" />Bild</button>
      <input ref={file} type="file" accept="image/*" hidden data-testid="image-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = ''; }} />
    </nav>
  );
}
