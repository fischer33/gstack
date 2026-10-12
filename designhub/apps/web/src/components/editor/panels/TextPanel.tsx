import { useEffect } from 'react';
import { TEXT_KINDS, TEXT_PRESETS } from '@/editor/engine/factories';
import { ensureFonts } from '@/editor/lib/fonts';
import { useAddElements } from '../useAddElements';
import { PanelSection } from './panelUi';

const SIZES = { heading: 'text-2xl font-bold', subheading: 'text-lg font-semibold', body: 'text-sm' } as const;

export default function TextPanel() {
  const add = useAddElements();
  // Vorschau in der echten Schrift: Schriften der Kombinationen beim Öffnen laden
  useEffect(() => { void ensureFonts(TEXT_PRESETS.map((p) => p.font)); }, []);
  return (
    <div>
      <PanelSection title="Text hinzufügen">
        <div className="space-y-2">
          {TEXT_KINDS.map((t) => (
            <button key={t.kind} onClick={() => add.addText(t.kind)} className={`w-full rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary hover:bg-muted ${SIZES[t.kind]}`}>{t.label}</button>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Schriftkombinationen">
        <div className="grid grid-cols-2 gap-2">
          {TEXT_PRESETS.map((p) => (
            <button key={p.label} onClick={() => void add.addTextPreset(p)} aria-label={`${p.label} hinzufügen`}
              className="flex h-20 flex-col items-center justify-center overflow-hidden rounded-md border border-border bg-white px-2 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
              <span className="max-w-full truncate text-lg leading-tight" style={{ fontFamily: `"${p.font}", sans-serif`, fontWeight: p.weight, color: p.fill, letterSpacing: p.spacing }}>{p.sample}</span>
              <span className="mt-1 text-[10px] text-neutral-500">{p.label}</span>
            </button>
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
