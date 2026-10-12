import { ArrowRight, Circle, Minus, Square, Star } from 'lucide-react';
import type { ShapeKind } from '@designhub/shared';
import { ICONS, ICON_VIEWBOX, STICKERS } from '@/editor/lib/icons';
import { useAddElements } from '../useAddElements';
import { PanelSection, tile } from './panelUi';

const SHAPES: { kind: ShapeKind; label: string; Icon: typeof Square }[] = [
  { kind: 'rect', label: 'Rechteck', Icon: Square }, { kind: 'ellipse', label: 'Kreis', Icon: Circle }, { kind: 'line', label: 'Linie', Icon: Minus },
  { kind: 'arrow', label: 'Pfeil', Icon: ArrowRight }, { kind: 'star', label: 'Stern', Icon: Star },
];

export default function ElementsPanel() {
  const add = useAddElements();
  return (
    <div>
      <PanelSection title="Formen">
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map(({ kind, label, Icon }) => (
            <button key={kind} className={tile} onClick={() => add.addShape(kind)} aria-label={`${label} hinzufügen`} title={label}><Icon className="h-5 w-5" /></button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Icons">
        <div className="grid grid-cols-4 gap-2">
          {ICONS.map((i) => (
            <button key={i.name} className={tile} onClick={() => add.addIcon(i)} aria-label={`Icon ${i.name} hinzufügen`} title={i.name}>
              <svg viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`} className="h-6 w-6 fill-current" aria-hidden><path d={i.path} /></svg>
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Sticker">
        <div className="grid grid-cols-6 gap-1.5">
          {STICKERS.map((s) => (
            <button key={s} className="grid aspect-square place-items-center rounded-md text-2xl transition-transform hover:scale-110 hover:bg-muted" onClick={() => add.addSticker(s)} aria-label={`Sticker ${s} hinzufügen`}>{s}</button>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
