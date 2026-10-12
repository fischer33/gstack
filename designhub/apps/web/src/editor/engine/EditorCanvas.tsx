import Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Group, Image as KImage, Layer, Rect, Stage, Transformer } from 'react-konva';
import { scaleElement, type Element, type ImageElement, type Page } from '@designhub/shared';
import { selectActivePage, useDocumentStore, type ElementPatch } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { ELEMENT_NAME, ElementNode, modelBoxFromNode, resetNodeToModel, type NodeHandlers } from './ElementNode';
import { cropByEdges, effectiveCrop } from './cropMath';
import { boundingRect, fromNodePose, intersects, normalizeRotation, toNodePose } from './geometry';
import { computeSnap, type Guides, type Rect as Box } from './snap';
import { useHtmlImage } from './useHtmlImage';
import { fitToView } from './viewActions';
import { clampZoom, zoomAround } from './viewport';

const BRAND = '#7d2ae8';
const MIN_SIZE = 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

function backgroundProps(bg: Page['background'], w: number, h: number) {
  if (bg.type === 'gradient') {
    // CSS-Winkel (0° = nach oben, 90° = nach rechts) → Start/Endpunkt durch die Mitte
    const a = ((bg.angle - 90) * Math.PI) / 180, cx = w / 2, cy = h / 2, r = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
    return {
      fillLinearGradientStartPoint: { x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r },
      fillLinearGradientEndPoint: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      fillLinearGradientColorStops: bg.stops.flatMap((s) => [s.offset, s.color]),
    };
  }
  return { fill: bg.type === 'solid' ? bg.color : '#ffffff' };
}

/** Bildhintergrund: "cover" füllt die Seite (Rand wird beschnitten), "contain" passt das ganze Bild ein. */
function BackgroundImage({ src, fit, width, height }: { src: string; fit: 'cover' | 'contain'; width: number; height: number }) {
  const img = useHtmlImage(src);
  if (!img) return null;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (fit === 'contain') {
    const k = Math.min(width / iw, height / ih);
    return <KImage image={img} x={(width - iw * k) / 2} y={(height - ih * k) / 2} width={iw * k} height={ih * k} listening={false} />;
  }
  const k = Math.max(width / iw, height / ih), cw = width / k, ch = height / k;
  return <KImage image={img} width={width} height={height} crop={{ x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch }} listening={false} />;
}

/** Beim Zuschneiden: das ganze Bild abgedunkelt hinter dem Ausschnitt, damit man sieht, was ausgeblendet ist. */
function CropGhost({ el }: { el: ImageElement }) {
  const img = useHtmlImage(el.src);
  if (!img) return null;
  const nw = el.naturalWidth ?? img.naturalWidth, nh = el.naturalHeight ?? img.naturalHeight;
  const c = effectiveCrop({ width: el.width, height: el.height, crop: el.crop, naturalWidth: nw, naturalHeight: nh });
  const kx = el.width / c.width, ky = el.height / c.height;
  const pose = toNodePose(el);
  return (
    <Group {...pose} listening={false}>
      <KImage image={img} x={-c.x * kx} y={-c.y * ky} width={nw * kx} height={nh * ky} opacity={0.35} />
    </Group>
  );
}

const SNAP_PX = 6; // Einrast-Abstand in Bildschirmpixeln

function unionRect(rects: Box[]): Box {
  if (!rects.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
  return { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
}

/** Zuschneide-Geste → neue Modellwerte. Die neuen Kanten werden im lokalen Rahmen des Bildes gelesen. */
function cropPatch(el: ImageElement, node: Konva.Node, sx: number, sy: number): ElementPatch {
  const nw = el.naturalWidth ?? 0, nh = el.naturalHeight ?? 0;
  if (!nw || !nh) return {}; // ohne Originalgröße kein Zuschnitt (ältere Dokumente)
  const old = toNodePose(el), rot = (el.rotation * Math.PI) / 180, cos = Math.cos(rot), sin = Math.sin(rot);
  const dxp = node.x() - old.x, dyp = node.y() - old.y;
  const left = dxp * cos + dyp * sin, top = -dxp * sin + dyp * cos; // Verschiebung der Ecke im alten lokalen Rahmen
  const res = cropByEdges({ width: el.width, height: el.height, crop: el.crop, naturalWidth: nw, naturalHeight: nh },
    { left, top, right: left + el.width * sx, bottom: top + el.height * sy });
  const pose = { x: old.x + res.offsetX * cos - res.offsetY * sin, y: old.y + res.offsetX * sin + res.offsetY * cos, rotation: el.rotation };
  const box = fromNodePose(pose, res.width, res.height);
  return { x: r2(box.x), y: r2(box.y), width: r2(res.width), height: r2(res.height), crop: res.crop };
}

/**
 * Die Arbeitsfläche: Seite, Elemente, Auswahl-Transformer, Marquee, Zoom und Pan.
 *
 * Drag und Transformation laufen direkt auf den Konva-Knoten (60 FPS, kein React-Render pro Mausbewegung);
 * erst beim Loslassen wird EIN Undo-Schritt in den Store geschrieben.
 */
export function EditorCanvas({ stageRef }: { stageRef: RefObject<Konva.Stage> }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const doc = useDocumentStore((s) => s.doc);
  const page = useDocumentStore(selectActivePage);
  const { zoom, pan, selectedIds, editingId, spaceDown, viewport, croppingId } = useUiStore();
  const guidesRef = useRef<Konva.Group>(null);

  // Aktuelle Werte für stabile Event-Handler (sonst würden alle Knoten bei jeder Änderung neu gerendert)
  const live = useRef({ page, zoom, spaceDown, doc });
  live.current = { page, zoom, spaceDown, doc };
  const dragging = useRef<{ anchor: string; start: { x: number; y: number }; moving: Box; others: Box[] } | null>(null);
  const panning = useRef<{ client: { x: number; y: number }; pan: { x: number; y: number } } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; shift: boolean } | null>(null);
  const marqueeRect = useRef<typeof marquee>(null);

  const elementOf = (id: string) => live.current.page?.elements.find((e) => e.id === id);
  const nodeOf = (id: string) => stageRef.current?.findOne<Konva.Node>(`#${id}`);

  // ---- Größe der Arbeitsfläche beobachten ----
  // Der Container wird immer gerendert (auch bevor das Design geladen ist), sonst fehlt der Beobachter später.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      useUiStore.getState().setViewport({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Beim ersten Anzeigen (Dokument geladen und Größe bekannt) die Seite einpassen; spätere Größenänderungen lassen den Zoom in Ruhe
  const fitted = useRef(false);
  const measured = viewport.width > 0 && viewport.height > 0;
  useEffect(() => {
    if (!doc) { fitted.current = false; return; }
    if (!fitted.current && measured) { fitted.current = true; fitToView(); }
  }, [doc, measured]);

  // ---- Auswahl → Transformer ----
  const selectedElements = useMemo(() => (page?.elements ?? []).filter((e) => selectedIds.includes(e.id)), [page, selectedIds]);
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const nodes = selectedElements.filter((e) => !e.locked && e.visible && e.id !== editingId).map((e) => nodeOf(e.id)).filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElements, editingId]);

  const single = selectedElements.length === 1 ? selectedElements[0] : null;
  const cropping = !!croppingId && single?.id === croppingId && single.type === 'image';
  // Zuschneiden endet, sobald etwas anderes (oder nichts) ausgewählt ist
  useEffect(() => {
    if (croppingId && !cropping) useUiStore.getState().setCropping(null);
  }, [croppingId, cropping]);

  const anchors = single?.type === 'shape' && (single.kind === 'line' || single.kind === 'arrow')
    ? ['middle-left', 'middle-right']
    : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'].filter((a) => !(single?.type === 'text' && a.includes('center')));

  /** Knoten nach einer Geste auf den (gerade geschriebenen) Modellzustand setzen, auch wenn sich das Modell nicht geändert hat. */
  const syncNodes = useCallback((ids: string[]) => {
    const page = selectActivePage(useDocumentStore.getState());
    for (const id of ids) {
      const el = page?.elements.find((e) => e.id === id), node = stageRef.current?.findOne<Konva.Node>(`#${id}`);
      if (el && node) resetNodeToModel(node, el);
    }
    stageRef.current?.batchDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Führungslinien direkt auf Konva-Ebene zeichnen (kein React-Render pro Mausbewegung)
  const showGuides = useCallback((g: Guides) => {
    const group = guidesRef.current, d = live.current.doc;
    if (!group || !d) return;
    group.destroyChildren();
    const sw = 1 / live.current.zoom;
    const line = (points: number[]) => new Konva.Line({ points, stroke: '#ff3d8b', strokeWidth: sw, dash: [6 * sw, 4 * sw], listening: false });
    for (const x of g.vertical) group.add(line([x, 0, x, d.height]));
    for (const y of g.horizontal) group.add(line([0, y, d.width, y]));
    group.getLayer()?.batchDraw();
  }, []);

  // ---- Knoten-Handler (stabil) ----
  const handlers = useMemo<NodeHandlers>(() => ({
    onDown(e) {
      if (live.current.spaceDown || (e.evt as MouseEvent).button === 1) return;
      const id = e.currentTarget.id();
      const ui = useUiStore.getState();
      if ((e.evt as MouseEvent).shiftKey) ui.toggleSelect(id);
      else if (!ui.selectedIds.includes(id)) ui.select([id]);
      e.cancelBubble = true; // nicht als Klick auf den Hintergrund werten
    },

    // Bei Mehrfachauswahl verschiebt der Transformer alle angehängten Knoten selbst mit (und feuert für jeden
    // dragstart/dragend). Wir merken uns nur den Beginn der Geste und schreiben am Ende EINEN Undo-Schritt.
    onDragStart(e) {
      if (dragging.current) return;
      const sel = new Set(useUiStore.getState().selectedIds);
      const els = live.current.page?.elements ?? [];
      const moving = unionRect(els.filter((x) => sel.has(x.id)).map(boundingRect));
      dragging.current = {
        anchor: e.target.id(), start: { x: e.target.x(), y: e.target.y() }, moving,
        others: els.filter((x) => x.visible && !sel.has(x.id)).map(boundingRect),
      };
    },

    // Smart Guides: Position des gezogenen Knotens korrigieren (die übrigen gewählten Knoten folgen dem Anker).
    // Mit gedrückter Alt-Taste wird nicht eingerastet.
    onDragMove(e) {
      const d = dragging.current;
      if (!d || e.target.id() !== d.anchor || !live.current.doc) return;
      if ((e.evt as MouseEvent).altKey) return void showGuides({ vertical: [], horizontal: [] });
      const moving = { ...d.moving, x: d.moving.x + e.target.x() - d.start.x, y: d.moving.y + e.target.y() - d.start.y };
      const snap = computeSnap(moving, d.others, live.current.doc, SNAP_PX / live.current.zoom);
      if (snap.dx || snap.dy) e.target.position({ x: e.target.x() + snap.dx, y: e.target.y() + snap.dy });
      showGuides(snap.guides);
    },

    onDragEnd() {
      if (!dragging.current) return; // weitere dragend-Ereignisse derselben Geste
      dragging.current = null;
      showGuides({ vertical: [], horizontal: [] });
      const patches: Record<string, ElementPatch> = {};
      for (const id of useUiStore.getState().selectedIds) {
        const el = elementOf(id), n = nodeOf(id);
        if (!el || !n || el.locked) continue;
        const box = modelBoxFromNode(el, n, el.width, el.height);
        if (r2(box.x) !== el.x || r2(box.y) !== el.y) patches[id] = { x: r2(box.x), y: r2(box.y) };
      }
      useDocumentStore.getState().updateEach(patches);
      syncNodes(useUiStore.getState().selectedIds);
    },

    onTextDblClick: (id) => { const el = elementOf(id); if (el && !el.locked) useUiStore.getState().setEditing(id); },
    onImageDblClick: (id) => { const el = elementOf(id); if (el && !el.locked) { useUiStore.getState().select([id]); useUiStore.getState().setCropping(id); } },
    onMeasured: (id, height) => useDocumentStore.getState().updateElements([id], { height: r2(height) }, { silent: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // ---- Transformer: Live-Anpassung bei Text, Commit beim Loslassen ----
  const onTransform = useCallback(() => {
    const tr = trRef.current;
    if (!tr) return;
    const side = tr.getActiveAnchor()?.includes('left') || tr.getActiveAnchor()?.includes('right');
    const corner = tr.getActiveAnchor()?.includes('top-') || tr.getActiveAnchor()?.includes('bottom-');
    for (const node of tr.nodes()) {
      // Textbreite ändert sich über die Seitengriffe wirklich (Umbruch), Eckgriffe skalieren die Schrift
      if (node.getClassName() === 'Text' && side && !corner) node.setAttrs({ width: Math.max(20, node.width() * node.scaleX()), scaleX: 1 });
    }
  }, []);

  const onTransformEnd = useCallback(() => {
    const tr = trRef.current;
    if (!tr) return;
    const patches: Record<string, ElementPatch> = {};
    const cropId = useUiStore.getState().croppingId;
    for (const node of tr.nodes()) {
      const el = elementOf(node.id());
      if (!el) continue;
      const sx = Math.abs(node.scaleX()), sy = Math.abs(node.scaleY());
      node.scaleX(1); node.scaleY(1); // Skalierung ins Modell überführen, Knoten bleibt unskaliert

      // Zuschneiden: Rahmenkanten bewegen den Ausschnitt, das Bild wird nicht gestreckt
      if (cropId === el.id && el.type === 'image') {
        patches[el.id] = cropPatch(el, node, sx, sy);
        continue;
      }

      // Nur Text hat eine echte Knotenbreite (Seitengriffe setzen sie live). Sterne, Gruppen u. a. liefern 0, dort gilt das Modell.
      const w = Math.max(MIN_SIZE, (el.type === 'text' ? node.width() : el.width) * sx), patch: ElementPatch = {};
      let height = Math.max(MIN_SIZE, el.height * sy);
      if (el.type === 'text') {
        if (Math.abs(sx - 1) > 1e-3) patch.fontSize = Math.max(6, Math.round(el.fontSize * sx));
        height = el.height; // echte Höhe misst der Text selbst nach dem Rendern
      }
      // Gruppen: Kinder liegen relativ zur Gruppe und skalieren mit
      if (el.type === 'group') patch.children = el.children.map((c) => scaleElement(c, w / el.width, height / el.height));
      const box = modelBoxFromNode(el, node, w, height);
      Object.assign(patch, { x: r2(box.x), y: r2(box.y), width: r2(w), height: r2(height), rotation: normalizeRotation(box.rotation) });
      patches[el.id] = patch;
    }
    useDocumentStore.getState().updateEach(patches);
    syncNodes(tr.nodes().map((n) => n.id()));
    tr.forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Hintergrund: Marquee-Auswahl, Pan ----
  const pagePoint = () => stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 };

  const onStageDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const evt = e.evt as MouseEvent;
    if (live.current.spaceDown || evt.button === 1) { // Hand-Werkzeug oder mittlere Maustaste
      evt.preventDefault();
      panning.current = { client: { x: evt.clientX, y: evt.clientY }, pan: useUiStore.getState().pan };
      return;
    }
    if (e.target.hasName(ELEMENT_NAME) || e.target.findAncestor(`.${ELEMENT_NAME}`, true) || e.target.getParent()?.className === 'Transformer') return;
    const shift = evt.shiftKey;
    if (!shift) useUiStore.getState().clearSelection();
    const p = pagePoint();
    marqueeStart.current = { ...p, shift };
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (panning.current) {
        const { client, pan: p0 } = panning.current;
        useUiStore.getState().setPan({ x: p0.x + e.clientX - client.x, y: p0.y + e.clientY - client.y });
      } else if (marqueeStart.current) {
        const s = marqueeStart.current, p = pagePoint();
        marqueeRect.current = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y) };
        setMarquee(marqueeRect.current);
      }
    };
    const up = () => {
      panning.current = null;
      const s = marqueeStart.current;
      marqueeStart.current = null;
      if (!s) return;
      const m = marqueeRect.current;
      marqueeRect.current = null;
      setMarquee(null);
      if (m && (m.width > 3 || m.height > 3)) {
        const hit = (live.current.page?.elements ?? []).filter((el: Element) => el.visible && intersects(m, boundingRect(el))).map((el) => el.id);
        const ui = useUiStore.getState();
        ui.select(s.shift ? [...ui.selectedIds, ...hit] : hit);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Zoom und Scrollen ----
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const ui = useUiStore.getState();
    if (e.evt.ctrlKey || e.evt.metaKey) { // Strg/Cmd + Rad oder Trackpad-Pinch: Zoom zum Mauszeiger
      const rect = wrapRef.current!.getBoundingClientRect();
      const anchor = { x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top };
      // Ein Mausrad-Schritt liefert deltaY ≈ 100, ein Trackpad-Pinch viele kleine Werte: begrenzen, damit ein Schritt ~1,6× zoomt
      const next = clampZoom(ui.zoom * Math.exp(-Math.max(-80, Math.min(80, e.evt.deltaY)) * 0.006));
      ui.setView(next, zoomAround(ui.pan, ui.zoom, next, anchor));
    } else {
      ui.setPan({ x: ui.pan.x - (e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX), y: ui.pan.y - (e.evt.shiftKey ? 0 : e.evt.deltaY) });
    }
  };

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-muted" style={{ cursor: spaceDown ? (panning.current ? 'grabbing' : 'grab') : 'default' }} data-testid="canvas-wrap">
      {doc && page && viewport.width > 0 && (
        <Stage ref={stageRef} width={viewport.width} height={viewport.height} x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}
          onMouseDown={onStageDown} onTouchStart={onStageDown} onWheel={onWheel}>
          <Layer listening>
            {/* Seite mit Schatten; Klick darauf zählt als Klick ins Leere */}
            <Rect x={0} y={0} width={doc.width} height={doc.height} {...backgroundProps(page.background, doc.width, doc.height)}
              shadowColor="#14162b" shadowBlur={24 / zoom} shadowOpacity={0.18} shadowOffsetY={6 / zoom} shadowEnabled name="page" />
            {page.background.type === 'image' && <BackgroundImage src={page.background.src} fit={page.background.fit} width={doc.width} height={doc.height} />}
          </Layer>
          <Layer>
            {page.elements.map((el) => el.visible && <ElementNode key={el.id} el={el} handlers={handlers} hidden={el.id === editingId} />)}
          </Layer>
          <Layer>
            {cropping && single?.type === 'image' && <CropGhost el={single} />}
            <Group ref={guidesRef} listening={false} />
            <Transformer ref={trRef} flipEnabled={false} rotateEnabled={!cropping} keepRatio={!cropping} enabledAnchors={cropping ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'] : anchors} rotationSnaps={[0, 45, 90, 135, 180, -135, -90, -45]} rotationSnapTolerance={4}
              borderStroke={BRAND} anchorStroke={BRAND} anchorFill="#fff" anchorSize={10} anchorCornerRadius={5} rotateAnchorOffset={28} ignoreStroke
              boundBoxFunc={(o, n) => (n.width < MIN_SIZE * zoom || n.height < MIN_SIZE * zoom ? o : n)}
              onTransform={onTransform} onTransformEnd={onTransformEnd} />
            {marquee && <Rect {...marquee} fill="rgba(125,42,232,0.12)" stroke={BRAND} strokeWidth={1 / zoom} listening={false} />}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
