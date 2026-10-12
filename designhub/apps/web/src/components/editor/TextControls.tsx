import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, Sparkles, Underline, WrapText } from 'lucide-react';
import { useState } from 'react';
import type { TextElement } from '@designhub/shared';
import { Popover } from '@/components/ui/popover';
import { ensureFont } from '@/editor/lib/fonts';
import { ColorPicker } from './ColorPicker';
import { FontPicker } from './FontPicker';
import { Divider, IconButton, NumberStepper, SliderRow, toolBtn } from './toolbarUi';

type Patch = (p: Record<string, unknown>, coalesce?: string) => void;
const DEFAULT_SHADOW = { color: '#000000', blur: 8, offsetX: 4, offsetY: 4, opacity: 0.4 };

/** Schrift, Größe, Farbe, Stil, Ausrichtung, Abstände, Schatten und Kontur für Textelemente. */
export function TextControls({ els, patch }: { els: TextElement[]; patch: Patch }) {
  const t = els[0];
  const [loading, setLoading] = useState(false);

  const pickFont = async (family: string) => {
    setLoading(true);
    await ensureFont(family); // erst laden, dann zuweisen: so misst Konva gleich mit der echten Schrift
    setLoading(false);
    patch({ fontFamily: family });
  };
  const aligns = [['left', AlignLeft, 'Linksbündig'], ['center', AlignCenter, 'Zentriert'], ['right', AlignRight, 'Rechtsbündig'], ['justify', AlignJustify, 'Blocksatz']] as const;

  return (
    <>
      <FontPicker value={t.fontFamily} onPick={pickFont} busy={loading} />
      <NumberStepper label="Schriftgröße" value={Math.round(t.fontSize)} min={6} max={600} onChange={(v) => patch({ fontSize: v }, 'fontSize')} />
      <ColorPicker label="Textfarbe" value={t.fill} onChange={(c) => patch({ fill: c }, 'textColor')} />
      <Divider />
      <IconButton label="Fett" active={t.fontWeight >= 700} onClick={() => patch({ fontWeight: t.fontWeight >= 700 ? 400 : 700 })}><Bold className="h-4 w-4" /></IconButton>
      <IconButton label="Kursiv" active={t.italic} onClick={() => patch({ italic: !t.italic })}><Italic className="h-4 w-4" /></IconButton>
      <IconButton label="Unterstrichen" active={t.underline} onClick={() => patch({ underline: !t.underline })}><Underline className="h-4 w-4" /></IconButton>
      <Divider />
      {aligns.map(([value, Icon, label]) => <IconButton key={value} label={label} active={t.align === value} onClick={() => patch({ align: value })}><Icon className="h-4 w-4" /></IconButton>)}
      <Divider />
      <Popover label="Abstände" width={280} triggerClassName={toolBtn} trigger={<WrapText className="h-4 w-4" />}>
        <div className="space-y-3">
          <SliderRow label="Zeilenabstand" value={t.lineHeight} min={0.8} max={2.5} step={0.05} onChange={(v) => patch({ lineHeight: v }, 'lineHeight')} />
          <SliderRow label="Buchstabenabstand" value={t.letterSpacing} min={-5} max={40} step={0.5} unit=" px" onChange={(v) => patch({ letterSpacing: v }, 'letterSpacing')} />
        </div>
      </Popover>
      <Popover label="Effekte: Schatten und Kontur" width={300} triggerClassName={toolBtn} trigger={<Sparkles className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!t.shadow} onChange={(e) => patch({ shadow: e.target.checked ? DEFAULT_SHADOW : undefined })} /> Schatten</label>
            {t.shadow && (
              <div className="space-y-2 pl-6">
                <div className="flex items-center gap-2 text-sm"><span className="w-24 text-muted-foreground">Farbe</span><ColorPicker label="Schattenfarbe" value={t.shadow.color} onChange={(c) => patch({ shadow: { ...t.shadow!, color: c } }, 'shadowColor')} /></div>
                <SliderRow label="Weichzeichnung" value={t.shadow.blur} min={0} max={40} onChange={(v) => patch({ shadow: { ...t.shadow!, blur: v } }, 'shadowBlur')} />
                <SliderRow label="Abstand X" value={t.shadow.offsetX} min={-40} max={40} onChange={(v) => patch({ shadow: { ...t.shadow!, offsetX: v } }, 'shadowX')} />
                <SliderRow label="Abstand Y" value={t.shadow.offsetY} min={-40} max={40} onChange={(v) => patch({ shadow: { ...t.shadow!, offsetY: v } }, 'shadowY')} />
                <SliderRow label="Deckkraft" value={Math.round(t.shadow.opacity * 100)} min={0} max={100} unit=" %" onChange={(v) => patch({ shadow: { ...t.shadow!, opacity: v / 100 } }, 'shadowOpacity')} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={(t.strokeWidth ?? 0) > 0} onChange={(e) => patch(e.target.checked ? { stroke: t.stroke ?? '#000000', strokeWidth: 2 } : { strokeWidth: 0 })} /> Kontur</label>
            {(t.strokeWidth ?? 0) > 0 && (
              <div className="space-y-2 pl-6">
                <div className="flex items-center gap-2 text-sm"><span className="w-24 text-muted-foreground">Farbe</span><ColorPicker label="Konturfarbe" value={t.stroke ?? '#000000'} onChange={(c) => patch({ stroke: c }, 'strokeColor')} /></div>
                <SliderRow label="Stärke" value={t.strokeWidth ?? 0} min={1} max={20} step={0.5} unit=" px" onChange={(v) => patch({ strokeWidth: v }, 'strokeWidth')} />
              </div>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}

