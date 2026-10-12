import type Konva from 'konva';
import { memo, useLayoutEffect, useRef } from 'react';
import { Arrow, Ellipse, Group, Image as KImage, Line, Rect, Text } from 'react-konva';
import { starUnitPoints, type Element, type TextElement } from '@designhub/shared';
import { fromNodePose, toNodePose } from './geometry';
import { useHtmlImage } from './useHtmlImage';

/** Wird als `name` an jeden Wurzelknoten gehängt, damit der Canvas Elemente von Hilfsobjekten unterscheiden kann. */
export const ELEMENT_NAME = 'el';

/** Ellipsen sind in Konva mittig verankert, alles andere oben links. */
export const isCenterOrigin = (el: Element) => el.type === 'shape' && el.kind === 'ellipse';

/** Modell → Konva-Position/Drehung des Wurzelknotens. */
export function nodeProps(el: Element) {
  if (isCenterOrigin(el)) return { x: el.x + el.width / 2, y: el.y + el.height / 2, rotation: el.rotation };
  return toNodePose(el);
}

/** Konva-Knoten (nach Verschieben/Transformieren) → Modellposition bei gegebener Größe. */
export function modelBoxFromNode(el: Element, node: Konva.Node, width: number, height: number) {
  if (isCenterOrigin(el)) return { x: node.x() - width / 2, y: node.y() - height / 2, width, height, rotation: node.rotation() };
  return fromNodePose({ x: node.x(), y: node.y(), rotation: node.rotation() }, width, height);
}

export interface NodeHandlers {
  onDown(e: Konva.KonvaEventObject<Event>): void;
  onDragStart(e: Konva.KonvaEventObject<DragEvent>): void;
  onDragMove(e: Konva.KonvaEventObject<DragEvent>): void;
  onDragEnd(e: Konva.KonvaEventObject<DragEvent>): void;
  onTextDblClick(id: string): void;
  /** Gemessene Texthöhe zurückmelden (ohne Undo-Eintrag) */
  onMeasured(id: string, height: number): void;
}

interface Props { el: Element; handlers: NodeHandlers; hidden?: boolean; interactive?: boolean }

const HIT_FILL = 'rgba(0,0,0,0.001)';

/**
 * Ein Dokumentelement als Konva-Knoten. `memo` + strukturelles Teilen von Immer sorgen dafür, dass bei einer
 * Änderung nur das betroffene Element neu gerendert wird (wichtig bei 100+ Objekten).
 */
export const ElementNode = memo(function ElementNode({ el, handlers, hidden, interactive = true }: Props) {
  const root = {
    id: el.id, name: ELEMENT_NAME, opacity: el.opacity, visible: !hidden, listening: interactive,
    draggable: interactive && !el.locked,
    onMouseDown: handlers.onDown, onTouchStart: handlers.onDown,
    onDragStart: handlers.onDragStart, onDragMove: handlers.onDragMove, onDragEnd: handlers.onDragEnd,
    ...nodeProps(el),
  };
  const size = { width: el.width, height: el.height };

  switch (el.type) {
    case 'shape': {
      const stroke = { stroke: el.stroke, strokeWidth: el.strokeWidth, strokeScaleEnabled: false };
      if (el.kind === 'rect') return <Rect {...root} {...size} fill={el.fill} {...stroke} cornerRadius={el.cornerRadius ?? 0} perfectDrawEnabled={false} />;
      if (el.kind === 'ellipse') return <Ellipse {...root} radiusX={el.width / 2} radiusY={el.height / 2} fill={el.fill} {...stroke} perfectDrawEnabled={false} />;
      if (el.kind === 'star') {
        const pts = starUnitPoints(el.points ?? 5).flatMap(([x, y]) => [x * el.width, y * el.height]);
        // Die echte Sternform füllt ihren Rahmen nicht aus. Ein unsichtbares, nicht klickbares Rechteck in voller Größe
        // sorgt dafür, dass der Auswahlrahmen dem Modellrahmen entspricht (wie bei allen anderen Formen).
        return (
          <Group {...root} {...size}>
            <Rect {...size} fill={HIT_FILL} listening={false} />
            <Line points={pts} closed fill={el.fill} {...stroke} perfectDrawEnabled={false} />
          </Group>
        );
      }
      // Linie/Pfeil: Gruppe mit unsichtbarer Trefferfläche, damit dünne Striche greifbar bleiben
      const y = el.height / 2, color = el.strokeWidth > 0 ? el.stroke : el.fill;
      return (
        <Group {...root} {...size}>
          <Rect {...size} fill={HIT_FILL} />
          {el.kind === 'arrow'
            ? <Arrow points={[0, y, el.width, y]} stroke={color} fill={color} strokeWidth={el.strokeWidth} pointerLength={el.strokeWidth * 3} pointerWidth={el.strokeWidth * 3} lineCap="round" strokeScaleEnabled={false} />
            : <Line points={[0, y, el.width, y]} stroke={color} strokeWidth={el.strokeWidth} lineCap="round" strokeScaleEnabled={false} />}
        </Group>
      );
    }
    case 'text': return <TextNode el={el} root={root} onMeasured={handlers.onMeasured} onDblClick={handlers.onTextDblClick} />;
    case 'image': return <ImageNode el={el} root={root} />;
    case 'group':
      return <Group {...root} {...size}>{el.children.map((c) => <ElementNode key={c.id} el={c} handlers={handlers} interactive={false} />)}</Group>;
    case 'icon':
      return null; // Icons enthalten fremdes SVG; kommen mit Sanitizing in Etappe (d)
  }
});

function TextNode({ el, root, onMeasured, onDblClick }: { el: TextElement; root: object; onMeasured: NodeHandlers['onMeasured']; onDblClick: (id: string) => void }) {
  const ref = useRef<Konva.Text>(null);
  // Konva bestimmt die Höhe selbst (Umbruch, Schrift). Das Ergebnis fließt ohne Undo-Eintrag ins Modell zurück,
  // damit Auswahlrahmen und Drehpunkt stimmen.
  useLayoutEffect(() => {
    const h = ref.current?.height();
    if (h && Math.abs(h - el.height) > 0.5) onMeasured(el.id, h);
  });
  const fontStyle = [el.italic && 'italic', el.fontWeight >= 700 && 'bold'].filter(Boolean).join(' ') || 'normal';
  return (
    <Text
      ref={ref} {...root} onDblClick={() => onDblClick(el.id)} onDblTap={() => onDblClick(el.id)}
      width={el.width} text={el.text} fontFamily={`${el.fontFamily}, sans-serif`} fontSize={el.fontSize} fontStyle={fontStyle}
      fill={el.fill} align={el.align} lineHeight={el.lineHeight} letterSpacing={el.letterSpacing}
      textDecoration={el.underline ? 'underline' : ''} wrap="word" perfectDrawEnabled={false}
    />
  );
}

function ImageNode({ el, root }: { el: Extract<Element, { type: 'image' }>; root: object }) {
  const img = useHtmlImage(el.src);
  const size = { width: el.width, height: el.height };
  // Solange das Bild lädt (oder fehlt), bleibt ein grauer Platzhalter greifbar.
  if (!img) return <Rect {...root} {...size} fill="#d9dbe3" perfectDrawEnabled={false} />;
  return <KImage {...root} {...size} image={img} perfectDrawEnabled={false} />;
}
