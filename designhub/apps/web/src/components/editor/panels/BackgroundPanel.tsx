import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Background } from '@designhub/shared';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { readImageFile } from '@/editor/engine/factories';
import { PALETTES } from '@/editor/lib/colors';
import { selectActivePage, useDocumentStore } from '@/editor/store/documentStore';
import { cn } from '@/lib/utils';
import { ColorPicker } from '../ColorPicker';
import { Chip, PanelSection } from './panelUi';

const GRADIENTS: { name: string; angle: number; colors: [string, string] }[] = [
  { name: 'Violett–Türkis', angle: 135, colors: ['#7d2ae8', '#00c2cb'] }, { name: 'Sonnenuntergang', angle: 160, colors: ['#ff914d', '#ff5757'] },
  { name: 'Ozean', angle: 180, colors: ['#0f4c5c', '#5fd3bc'] }, { name: 'Pfirsich', angle: 135, colors: ['#fde8ec', '#ffbd59'] },
  { name: 'Nacht', angle: 180, colors: ['#14161f', '#312e81'] }, { name: 'Wald', angle: 135, colors: ['#1f3a2e', '#7ed957'] },
  { name: 'Rosa', angle: 90, colors: ['#ff66c4', '#7d2ae8'] }, { name: 'Morgen', angle: 0, colors: ['#ffffff', '#d6ecf8'] },
];

type Mode = 'solid' | 'gradient' | 'image';

const gradientCss = (angle: number, [a, b]: [string, string]) => `linear-gradient(${angle}deg, ${a}, ${b})`;
const toBg = (angle: number, [a, b]: [string, string]): Background => ({ type: 'gradient', angle, stops: [{ offset: 0, color: a }, { offset: 1, color: b }] });

export default function BackgroundPanel() {
  const page = useDocumentStore(selectActivePage);
  const setBackground = useDocumentStore((s) => s.setBackground);
  const { toast } = useToast();
  const file = useRef<HTMLInputElement>(null);
  const bg = page?.background ?? { type: 'solid' as const, color: '#ffffff' };
  const [mode, setMode] = useState<Mode>(bg.type);

  const gradient = bg.type === 'gradient' ? { angle: bg.angle, colors: [bg.stops[0]?.color ?? '#7d2ae8', bg.stops.at(-1)?.color ?? '#00c2cb'] as [string, string] } : { angle: 135, colors: ['#7d2ae8', '#00c2cb'] as [string, string] };

  const pickImage = async (f: File) => {
    try { const img = await readImageFile(f); setBackground({ type: 'image', src: img.src, fit: bg.type === 'image' ? bg.fit : 'cover' }); }
    catch (err) { toast(err instanceof Error ? err.message : 'Das Bild konnte nicht gelesen werden.', 'error'); }
  };

  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Hintergrundart">
        <Chip active={mode === 'solid'} onClick={() => setMode('solid')}>Farbe</Chip>
        <Chip active={mode === 'gradient'} onClick={() => setMode('gradient')}>Verlauf</Chip>
        <Chip active={mode === 'image'} onClick={() => setMode('image')}>Bild</Chip>
      </div>

      {mode === 'solid' && (
        <>
          <div className="mb-4 flex items-center gap-3 text-sm">
            <ColorPicker label="Hintergrundfarbe" value={bg.type === 'solid' ? bg.color : '#ffffff'} onChange={(color) => setBackground({ type: 'solid', color })} />
            <span className="text-muted-foreground">Eigene Farbe wählen</span>
          </div>
          {PALETTES.map((p) => (
            <PanelSection key={p.name} title={p.name}>
              <div className="flex flex-wrap gap-1.5">
                {p.colors.map((c) => (
                  <button key={c} aria-label={`Hintergrund ${c}`} title={c} onClick={() => setBackground({ type: 'solid', color: c })}
                    className={cn('h-8 w-8 rounded-md border border-border transition-transform hover:scale-110', bg.type === 'solid' && bg.color === c && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} style={{ background: c }} />
                ))}
              </div>
            </PanelSection>
          ))}
        </>
      )}

      {mode === 'gradient' && (
        <>
          <PanelSection title="Vorlagen">
            <div className="grid grid-cols-2 gap-2">
              {GRADIENTS.map((g) => (
                <button key={g.name} aria-label={`Verlauf ${g.name}`} onClick={() => setBackground(toBg(g.angle, g.colors))}
                  className="h-14 rounded-md border border-border text-xs font-medium text-white shadow-sm transition-transform hover:scale-[1.03]" style={{ background: gradientCss(g.angle, g.colors) }}>
                  <span className="rounded bg-black/30 px-1.5 py-0.5">{g.name}</span>
                </button>
              ))}
            </div>
          </PanelSection>
          <PanelSection title="Eigener Verlauf">
            <div className="flex items-center gap-2">
              <ColorPicker label="Verlauf Startfarbe" value={gradient.colors[0]} onChange={(c) => setBackground(toBg(gradient.angle, [c, gradient.colors[1]]))} />
              <ColorPicker label="Verlauf Endfarbe" value={gradient.colors[1]} onChange={(c) => setBackground(toBg(gradient.angle, [gradient.colors[0], c]))} />
              <label className="ml-2 flex flex-1 items-center gap-2 text-xs text-muted-foreground">Winkel
                <input type="range" min={0} max={360} aria-label="Verlaufswinkel" value={gradient.angle} className="flex-1 accent-[#7d2ae8]"
                  onChange={(e) => setBackground(toBg(Number(e.target.value), gradient.colors))} />
                <span className="w-9 tabular-nums">{gradient.angle}°</span>
              </label>
            </div>
          </PanelSection>
        </>
      )}

      {mode === 'image' && (
        <>
          <Button className="w-full" onClick={() => file.current?.click()}><ImagePlus className="h-4 w-4" /> Hintergrundbild wählen</Button>
          <input ref={file} type="file" accept="image/*" hidden data-testid="background-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickImage(f); e.target.value = ''; }} />
          {bg.type === 'image' && (
            <div className="mt-4 space-y-3">
              <img src={bg.src} alt="" className="max-h-32 w-full rounded-md border border-border object-contain" />
              <div className="flex gap-2" role="radiogroup" aria-label="Anpassung">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button key={fit} role="radio" aria-checked={bg.fit === fit} onClick={() => setBackground({ ...bg, fit })}
                    className={cn('flex-1 rounded-md border px-3 py-1.5 text-sm', bg.fit === fit ? 'border-primary bg-primary/10 font-semibold' : 'border-border hover:bg-muted')}>{fit === 'cover' ? 'Füllen' : 'Einpassen'}</button>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setBackground({ type: 'solid', color: '#ffffff' })}><Trash2 className="h-4 w-4" /> Bild entfernen</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
