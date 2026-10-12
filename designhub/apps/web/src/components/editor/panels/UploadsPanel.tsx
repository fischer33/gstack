import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAssets } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/editor/store/uiStore';
import { useAddElements } from '../useAddElements';
import { PanelSection } from './panelUi';

export default function UploadsPanel() {
  const add = useAddElements();
  const uploads = useUiStore((s) => s.uploads);
  const input = useRef<HTMLInputElement>(null);
  const { token } = useParams();
  const assets = useAssets(!token);
  const sessionUrls = new Set(uploads.map((u) => u.src));
  const saved = (assets.data ?? []).filter((a) => !sessionUrls.has(a.url));
  return (
    <div>
      <Button className="w-full" onClick={() => input.current?.click()}><ImagePlus className="h-4 w-4" /> Bild hochladen</Button>
      <input ref={input} type="file" accept="image/*" multiple hidden data-testid="image-input" onChange={(e) => { [...(e.target.files ?? [])].forEach((f) => void add.addImage(f)); e.target.value = ''; }} />
      <p className="mt-2 text-xs text-muted-foreground">Du kannst Bilder auch auf die Arbeitsfläche ziehen oder mit Strg/Cmd+V einfügen. Maximal 10 MB je Bild.</p>
      <div className="mt-5">
        <PanelSection title="Diese Sitzung">
          {uploads.length ? (
            <div className="grid grid-cols-2 gap-2">
              {uploads.map((u) => (
                <button key={u.id} onClick={() => add.addUpload(u)} aria-label={`${u.name} einfügen`} title={u.name}
                  className="grid aspect-square place-items-center overflow-hidden rounded-md border border-border bg-muted p-1 transition-all hover:border-primary hover:shadow-md">
                  <img src={u.src} alt="" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Noch keine Bilder in dieser Sitzung.</p>}
        </PanelSection>
        {saved.length > 0 && (
          <div className="mt-5">
            <PanelSection title="Meine Bilder">
              <div className="grid grid-cols-2 gap-2" data-testid="saved-assets">
                {saved.map((a) => (
                  <button key={a.id} onClick={() => void add.addAssetUrl(a.url)} aria-label="Gespeichertes Bild einfügen"
                    className="grid aspect-square place-items-center overflow-hidden rounded-md border border-border bg-muted p-1 transition-all hover:border-primary hover:shadow-md">
                    <img src={a.url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  </button>
                ))}
              </div>
            </PanelSection>
          </div>
        )}
      </div>
    </div>
  );
}
