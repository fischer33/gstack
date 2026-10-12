import Konva from 'konva';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Layer, Rect, Stage } from 'react-konva';
import type { DesignDocument, Element, Page } from '@designhub/shared';
import { ElementNode, type NodeHandlers } from '../engine/ElementNode';
import { BackgroundImage, backgroundProps } from '../engine/PageBackground';
import { loadHtmlImage } from '../engine/useHtmlImage';
import { fontsOf } from '../lib/docFonts';
import { ensureFont } from '../lib/fonts';

const noop = () => undefined;
const HANDLERS: NodeHandlers = { onDown: noop, onDragStart: noop, onDragMove: noop, onDragEnd: noop, onTextDblClick: noop, onImageDblClick: noop, onMeasured: noop };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function imageSrcs(elements: readonly Element[], into = new Set<string>()): Set<string> {
  for (const e of elements) {
    if (e.type === 'image') into.add(e.src);
    else if (e.type === 'group') imageSrcs(e.children, into);
  }
  return into;
}

/** Schriften und Bilder der Seiten laden, damit das Rendern danach synchron und vollständig ist. */
export async function preparePages(pages: readonly Page[]): Promise<void> {
  const fonts = new Set<string>(), srcs = new Set<string>();
  for (const p of pages) {
    fontsOf(p.elements, fonts);
    imageSrcs(p.elements, srcs);
    if (p.background.type === 'image') srcs.add(p.background.src);
  }
  await Promise.all([...[...fonts].map(ensureFont), ...[...srcs].map(loadHtmlImage)]);
}

/** Zeichnet eine Seite mit denselben Bausteinen wie der Editor in einen unsichtbaren Stage und gibt ein Canvas zurück. */
export async function renderPageToCanvas(doc: Pick<DesignDocument, 'width' | 'height'>, page: Page, scale: number, opaque = false): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  let stage: Konva.Stage | null = null;
  try {
    flushSync(() => root.render(
      <Stage width={doc.width} height={doc.height} listening={false} ref={(s) => { stage = s; }}>
        <Layer listening={false}>
          <Rect x={0} y={0} width={doc.width} height={doc.height} {...backgroundProps(page.background, doc.width, doc.height)} />
          {page.background.type === 'image' && <BackgroundImage src={page.background.src} fit={page.background.fit} width={doc.width} height={doc.height} />}
        </Layer>
        <Layer listening={false}>
          {page.elements.map((el) => el.visible && <ElementNode key={el.id} el={el} handlers={HANDLERS} interactive={false} />)}
        </Layer>
      </Stage>,
    ));
    // Filter-Caches entstehen in Effekten; zwei Takte abwarten, dann sicher neu zeichnen.
    await tick(); await tick();
    const st = stage as Konva.Stage | null;
    if (!st) throw new Error('Export-Fläche konnte nicht erstellt werden.');
    st.draw();
    const raw = st.toCanvas({ pixelRatio: scale });
    if (!opaque) return raw;
    const out = document.createElement('canvas');
    out.width = raw.width; out.height = raw.height;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(raw, 0, 0);
    return out;
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Die tatsächlichen Zeilen, in die Konva die Texte umbricht – der SVG-Export übernimmt sie 1:1. */
export function measureTextLines(elements: readonly Element[], into: Record<string, string[]> = {}): Record<string, string[]> {
  for (const el of elements) {
    if (el.type === 'group') measureTextLines(el.children, into);
    else if (el.type === 'text') {
      const fontStyle = [el.italic && 'italic', el.fontWeight >= 700 && 'bold'].filter(Boolean).join(' ') || 'normal';
      const t = new Konva.Text({
        width: el.width, text: el.text, fontFamily: `${el.fontFamily}, sans-serif`, fontSize: el.fontSize, fontStyle,
        align: el.align, lineHeight: el.lineHeight, letterSpacing: el.letterSpacing, wrap: 'word',
      });
      into[el.id] = t.textArr.map((l) => l.text);
      t.destroy();
    }
  }
  return into;
}
