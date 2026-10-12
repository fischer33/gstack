import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import type { Element, Page } from '@designhub/shared';
import { selectActivePage, useDocumentStore, type ElementPatch } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { ELEMENT_NAME, ElementNode, modelBoxFromNode, type NodeHandlers } from './ElementNode';
import { boundingRect, intersects, normalizeRotation } from './geometry';
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
  // Bildhintergrund folgt in Etappe (d); bis dahin neutrale Fläche
  return { fill: bg.type === 'solid' ? bg.color : '#ffffff' };
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
  const { zoom, pan, selectedIds, editingId, spaceDown, viewport } = useUiStore();

  // Aktuelle Werte für stabile Event-Handler (sonst würden alle Knoten bei jeder Änderung neu gerendert)
  const live = useRef({ page, zoom, spaceDown });
  live.current = { page, zoom, spaceDown };
  const dragging = useRef(false);
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
  const anchors = single?.type === 'shape' && (single.kind === 'line' || single.kind === 'arrow')
    ? ['middle-left', 'middle-right']
    : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'].filter((a) => !(single?.type === 'text' && a.includes('center')));

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
    // dragstart/dragend). Wir merken uns nur den Beginn und schreiben beim ersten dragend EINEN Undo-Schritt.
    onDragStart() { dragging.current = true; },

    onDragMove() { /* Konva bewegt alle gewählten Knoten */ },

    onDragEnd() {
      if (!dragging.current) return; // weitere dragend-Ereignisse derselben Geste
      dragging.current = false;
      const patches: Record<string, ElementPatch> = {};
      for (const id of useUiStore.getState().selectedIds) {
        const el = elementOf(id), n = nodeOf(id);
        if (!el || !n || el.locked) continue;
        const box = modelBoxFromNode(el, n, el.width, el.height);
        if (r2(box.x) !== el.x || r2(box.y) !== el.y) patches[id] = { x: r2(box.x), y: r2(box.y) };
      }
      useDocumentStore.getState().updateEach(patches);
    },

    onTextDblClick: (id) => { const el = elementOf(id); if (el && !el.locked) useUiStore.getState().setEditing(id); },
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
    for (const node of tr.nodes()) {
      const el = elementOf(node.id());
      if (!el) continue;
      const sx = Math.abs(node.scaleX()), sy = Math.abs(node.scaleY());
      node.scaleX(1); node.scaleY(1); // Skalierung ins Modell überführen, Knoten bleibt unskaliert
      // Nur Text hat eine echte Knotenbreite (Seitengriffe setzen sie live). Sterne, Gruppen u. a. liefern 0, dort gilt das Modell.
      const w = Math.max(MIN_SIZE, (el.type === 'text' ? node.width() : el.width) * sx), patch: ElementPatch = {};
      let height = Math.max(MIN_SIZE, el.height * sy);
      if (el.type === 'text') {
        if (Math.abs(sx - 1) > 1e-3) patch.fontSize = Math.max(6, Math.round(el.fontSize * sx));
        height = el.height; // echte Höhe misst der Text selbst nach dem Rendern
      }
      const box = modelBoxFromNode(el, node, w, height);
      Object.assign(patch, { x: r2(box.x), y: r2(box.y), width: r2(w), height: r2(height), rotation: normalizeRotation(box.rotation) });
      patches[el.id] = patch;
    }
    useDocumentStore.getState().updateEach(patches);
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
          </Layer>
          <Layer>
            {page.elements.map((el) => el.visible && <ElementNode key={el.id} el={el} handlers={handlers} hidden={el.id === editingId} />)}
          </Layer>
          <Layer>
            <Transformer ref={trRef} flipEnabled={false} rotateEnabled enabledAnchors={anchors} rotationSnaps={[0, 45, 90, 135, 180, -135, -90, -45]} rotationSnapTolerance={4}
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
