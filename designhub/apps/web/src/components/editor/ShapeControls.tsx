import type { IconElement, ShapeElement } from '@designhub/shared';
import { ColorPicker } from './ColorPicker';
import { Divider, NumberStepper } from './toolbarUi';

type Patch = (p: Record<string, unknown>, coalesce?: string) => void;

/** Füllung, Kontur und Rundung für Formen; Linien und Pfeile färbt die Kontur. */
export function ShapeControls({ els, patch }: { els: ShapeElement[]; patch: Patch }) {
  const s = els[0];
  const lineLike = els.every((e) => e.kind === 'line' || e.kind === 'arrow');
  if (lineLike) {
    return (
      <>
        <ColorPicker label="Linienfarbe" value={s.stroke} onChange={(c) => patch({ stroke: c }, 'strokeColor')} />
        <NumberStepper label="Linienstärke" value={s.strokeWidth} min={1} max={60} onChange={(v) => patch({ strokeWidth: v }, 'strokeWidth')} />
      </>
    );
  }
  return (
    <>
      <ColorPicker label="Füllfarbe" value={s.fill} onChange={(c) => patch({ fill: c }, 'fill')} allowTransparent />
      <Divider />
      <ColorPicker label="Konturfarbe" value={s.stroke} allowTransparent
        // Eine gewählte Konturfarbe ist nur sichtbar, wenn die Kontur eine Stärke hat
        onChange={(c) => patch({ stroke: c, ...(s.strokeWidth === 0 && c !== 'transparent' ? { strokeWidth: 4 } : {}) }, 'strokeColor')} />
      <NumberStepper label="Konturstärke" value={s.strokeWidth} min={0} max={80} onChange={(v) => patch({ strokeWidth: v }, 'strokeWidth')} />
      {els.every((e) => e.kind === 'rect') && <NumberStepper label="Eckenradius" value={s.cornerRadius ?? 0} min={0} max={500} onChange={(v) => patch({ cornerRadius: v }, 'radius')} />}
    </>
  );
}

export function IconControls({ els, patch }: { els: IconElement[]; patch: Patch }) {
  return <ColorPicker label="Icon-Farbe" value={els[0].fill} onChange={(c) => patch({ fill: c }, 'fill')} />;
}
