import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/theme/ThemeProvider';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { RULER_SIZE, guidePosition, rulerTicks } from './rulers';

const GUIDE = '#00c4cc';

function css(name: string) { return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`; }

/** Zeichnet ein Lineal auf ein Canvas. Der Seitenbereich ist heller hinterlegt, damit man sieht, wo das Dokument liegt. */
function draw(canvas: HTMLCanvasElement, horizontal: boolean, zoom: number, pan: number, length: number, page: number) {
  const dpr = window.devicePixelRatio || 1;
  const w = horizontal ? length : RULER_SIZE, h = horizontal ? RULER_SIZE : length;
  canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  g.fillStyle = css('--card'); g.fillRect(0, 0, w, h);
  const a = pan, b = pan + page * zoom; // Seitenbereich entlang der Achse
  g.fillStyle = css('--muted');
  if (horizontal) g.fillRect(a, 0, b - a, h); else g.fillRect(0, a, w, b - a);

  g.strokeStyle = css('--muted-foreground'); g.fillStyle = css('--muted-foreground'); g.lineWidth = 1; g.font = '10px Inter, system-ui, sans-serif';
  g.textBaseline = 'top';
  for (const t of rulerTicks(zoom, pan, length).ticks) {
    const x = Math.round(t.screen) + 0.5, len = t.major ? RULER_SIZE : t.pos % 1 === 0 ? 5 : 3;
    g.beginPath();
    if (horizontal) { g.moveTo(x, h); g.lineTo(x, h - len); } else { g.moveTo(w, x); g.lineTo(w - len, x); }
    g.stroke();
    if (t.label) {
      if (horizontal) g.fillText(t.label, x + 3, 2);
      else { g.save(); g.translate(2, x + 3); g.rotate(-Math.PI / 2); g.textBaseline = 'top'; g.fillText(t.label, -g.measureText(t.label).width, 0); g.restore(); }
    }
  }
  g.strokeStyle = css('--border'); // Kante zum Arbeitsbereich
  g.beginPath();
  if (horizontal) { g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); } else { g.moveTo(w - 0.5, 0); g.lineTo(w - 0.5, h); }
  g.stroke();
}

/**
 * Lineale oben und links (in Dokumentpixeln, folgen Zoom und Pan). Ziehen aus einem Lineal erzeugt eine Hilfslinie:
 * aus dem oberen Lineal eine waagerechte, aus dem linken eine senkrechte.
 */
export function Rulers() {
  const { zoom, pan, viewport } = useUiStore();
  const doc = useDocumentStore((s) => s.doc);
  const { pref } = useTheme();
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLCanvasElement>(null);
  const left = useRef<HTMLCanvasElement>(null);
  const [ghost, setGhost] = useState<{ axis: 'x' | 'y'; screen: number } | null>(null);

  useEffect(() => {
    if (!doc || !viewport.width) return;
    if (top.current) draw(top.current, true, zoom, pan.x, viewport.width, doc.width);
    if (left.current) draw(left.current, false, zoom, pan.y, viewport.height, doc.height);
  }, [zoom, pan.x, pan.y, viewport.width, viewport.height, doc?.width, doc?.height, pref, doc]);

  const start = (axis: 'x' | 'y') => (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = root.current!.getBoundingClientRect();
    const origin = { x: rect.left + RULER_SIZE, y: rect.top + RULER_SIZE };
    const inside = (ev: PointerEvent) => ev.clientX >= origin.x && ev.clientY >= origin.y && ev.clientX <= rect.right && ev.clientY <= rect.bottom;
    const move = (ev: PointerEvent) => setGhost(inside(ev) ? { axis, screen: axis === 'x' ? ev.clientX - origin.x : ev.clientY - origin.y } : null);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setGhost(null);
      if (!inside(ev)) return; // zurück ins Lineal gezogen: verwerfen
      const ui = useUiStore.getState();
      ui.addGuide(axis, guidePosition(axis === 'x' ? ev.clientX : ev.clientY, axis === 'x' ? origin.x : origin.y, axis === 'x' ? ui.pan.x : ui.pan.y, ui.zoom));
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-10 select-none" data-testid="rulers">
      <div className="pointer-events-auto absolute left-0 top-0 border-b border-r border-border bg-card" style={{ width: RULER_SIZE, height: RULER_SIZE }} />
      <canvas ref={top} data-testid="ruler-top" aria-label="Lineal oben, ziehen für eine waagerechte Hilfslinie" className="pointer-events-auto absolute top-0 cursor-row-resize" style={{ left: RULER_SIZE }} onPointerDown={start('y')} />
      <canvas ref={left} data-testid="ruler-left" aria-label="Lineal links, ziehen für eine senkrechte Hilfslinie" className="pointer-events-auto absolute left-0 cursor-col-resize" style={{ top: RULER_SIZE }} onPointerDown={start('x')} />
      {ghost && <div aria-hidden style={ghost.axis === 'x'
        ? { position: 'absolute', top: RULER_SIZE, bottom: 0, left: RULER_SIZE + ghost.screen, width: 1, background: GUIDE }
        : { position: 'absolute', left: RULER_SIZE, right: 0, top: RULER_SIZE + ghost.screen, height: 1, background: GUIDE }} />}
    </div>
  );
}
