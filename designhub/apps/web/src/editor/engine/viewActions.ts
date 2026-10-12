import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { centerPan, clampZoom, fitZoom, zoomAround } from './viewport';

/** Zoom/Pan-Aktionen, die Dokumentgröße und Viewport aus den Stores lesen (für Toolbar, Tastenkürzel, Canvas). */
export function fitToView() {
  const doc = useDocumentStore.getState().doc;
  const { viewport, setView } = useUiStore.getState();
  if (!doc) return;
  const z = fitZoom(viewport, doc);
  setView(z, centerPan(viewport, doc, z));
}

/** Auf Prozentwert zoomen (1 = 100 %), um die Mitte des Viewports. */
export function zoomTo(next: number) {
  const { zoom, pan, viewport, setView } = useUiStore.getState();
  const z = clampZoom(next);
  setView(z, zoomAround(pan, zoom, z, { x: viewport.width / 2, y: viewport.height / 2 }));
}

export const zoomBy = (factor: number) => zoomTo(useUiStore.getState().zoom * factor);
