import { useLayoutEffect, useRef } from 'react';
import { selectActivePage, useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { toNodePose } from './geometry';

/**
 * Inline-Textbearbeitung: ein <textarea> liegt exakt über dem Text (gleiche Schrift, Größe, Drehung, Zoom).
 * Beim Verlassen (Klick daneben, Esc) wird der Text übernommen; leerer Text löscht das Element.
 */
export function TextEditorOverlay() {
  const editingId = useUiStore((s) => s.editingId);
  const { zoom, pan } = useUiStore();
  const el = useDocumentStore((s) => selectActivePage(s)?.elements.find((e) => e.id === editingId));
  const ref = useRef<HTMLTextAreaElement>(null);

  // Beim Öffnen fokussieren und alles markieren (wie beim Umbenennen)
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.select();
    ta.style.height = `${ta.scrollHeight}px`;
  }, [editingId]);

  if (!el || el.type !== 'text') return null;
  const pose = toNodePose(el);

  const commit = (value: string) => {
    const { removeElements, updateElements } = useDocumentStore.getState();
    useUiStore.getState().setEditing(null);
    if (!value.trim()) return removeElements([el.id]);
    if (value !== el.text) updateElements([el.id], { text: value });
  };

  return (
    <textarea
      ref={ref} defaultValue={el.text} aria-label="Text bearbeiten" spellCheck={false}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
      onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; }}
      style={{
        position: 'absolute', left: pan.x + pose.x * zoom, top: pan.y + pose.y * zoom, width: el.width * zoom,
        transform: `rotate(${el.rotation}deg)`, transformOrigin: '0 0',
        font: `${el.italic ? 'italic ' : ''}${el.fontWeight} ${el.fontSize * zoom}px/${el.lineHeight} "${el.fontFamily}", sans-serif`,
        letterSpacing: el.letterSpacing * zoom, textAlign: el.align === 'justify' ? 'justify' : el.align, color: el.fill,
        textDecoration: el.underline ? 'underline' : 'none', opacity: el.opacity,
        margin: 0, padding: 0, border: '1px dashed #7d2ae8', outline: 'none', background: 'transparent', resize: 'none', overflow: 'hidden',
        whiteSpace: 'pre-wrap', overflowWrap: 'break-word', boxSizing: 'content-box', zIndex: 5,
      }}
    />
  );
}
