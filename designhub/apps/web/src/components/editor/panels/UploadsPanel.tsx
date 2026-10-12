import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/editor/store/uiStore';
import { useAddElements } from '../useAddElements';
import { PanelSection } from './panelUi';

export default function UploadsPanel() {
  const add = useAddElements();
  const uploads = useUiStore((s) => s.uploads);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Button className="w-full" onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" /> Bild hochladen</Button>
      <input ref={input} type="file" accept="image/*" multiple hidden data-testid="image-input" onChange={(e) => { [...(e.target.files ?? [])].forEach((f) => void add.addImage(f)); e.target.value = ''; }} />
      <p className="mt-2 text-xs text-muted-foreground">Du kannst Bilder auch auf die Arbeitsfläche ziehen oder mit Strg/Cmd+V einfügen. Maximal 10 MB je Bild.</p>
      <div className="mt-5">
        <PanelSection title="Hochgeladen in dieser Sitzung">
          {uploads.length ? (
            <div className="grid grid-cols-2 gap-2">
              {uploads.map((u) => (
                <button key={u.id} onClick={() => add.addUpload(u)} aria-label={`${u.name} einfügen`} title={u.name}
                  className="grid aspect-square place-items-center overflow-hidden rounded-md border border-border bg-muted p-1 transition-all hover:border-primary hover:shadow-md">
                  <img src={u.src} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Noch keine Bilder. Dauerhaft speichern lassen sie sich mit dem Speichern in Etappe (f).</p>}
        </PanelSection>
      </div>
    </div>
  );
}
