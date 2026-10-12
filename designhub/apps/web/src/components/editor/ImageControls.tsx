import { Crop, FlipHorizontal2, FlipVertical2, Loader2, SlidersHorizontal, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { ImageElement } from '@designhub/shared';
import { api } from '@/lib/api';
import { Popover } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import { useDocumentStore } from '@/editor/store/documentStore';
import { useUiStore } from '@/editor/store/uiStore';
import { hasFilters } from '@/editor/engine/imageFilters';
import { Divider, IconButton, NumberStepper, SliderRow, toolBtn } from './toolbarUi';
import { imageSize, removeBackgroundMessage, rescaleCrop } from './removeBackground';

type Patch = (p: Record<string, unknown>, coalesce?: string) => void;
const NO_FILTERS = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };

/** Filter, Spiegeln, Zuschneiden und Hintergrund entfernen für ein Bild. */
export function ImageControls({ els, patch }: { els: ImageElement[]; patch: Patch }) {
  const img = els[0];
  const single = els.length === 1;
  const croppingId = useUiStore((s) => s.croppingId);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const f = img.filters;
  const setFilter = (key: keyof typeof NO_FILTERS) => (v: number) => patch({ filters: { ...img.filters, [key]: v } }, `filter-${key}`);

  const removeBackground = async () => {
    setBusy(true);
    try {
      const { image } = await api<{ image: string }>('/images/remove-background', { body: { image: img.src } });
      const next = await imageSize(image);
      // Der Dienst darf das Ergebnis verkleinern: Originalgröße und Zuschnitt mitführen
      const from = { width: img.naturalWidth ?? next.width, height: img.naturalHeight ?? next.height };
      useDocumentStore.getState().updateElements([img.id], { src: image, naturalWidth: next.width, naturalHeight: next.height, crop: rescaleCrop(img.crop, from, next) });
      toast('Hintergrund entfernt');
    } catch (err) {
      toast(removeBackgroundMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Popover label="Bildfilter" width={300} triggerClassName={`${toolBtn} ${hasFilters(f) ? 'text-primary' : ''}`} trigger={<SlidersHorizontal className="h-4 w-4" />}>
        <div className="space-y-3">
          <SliderRow label="Helligkeit" value={f.brightness} min={-100} max={100} onChange={setFilter('brightness')} />
          <SliderRow label="Kontrast" value={f.contrast} min={-100} max={100} onChange={setFilter('contrast')} />
          <SliderRow label="Sättigung" value={f.saturation} min={-100} max={100} onChange={setFilter('saturation')} />
          <SliderRow label="Weichzeichnen" value={f.blur} min={0} max={40} unit=" px" onChange={setFilter('blur')} />
          <button type="button" disabled={!hasFilters(f)} onClick={() => patch({ filters: NO_FILTERS })} className="w-full rounded-md border border-border py-1.5 text-sm hover:bg-muted disabled:opacity-50">Zurücksetzen</button>
        </div>
      </Popover>
      <IconButton label="Horizontal spiegeln" active={img.flipX} onClick={() => patch({ flipX: !img.flipX })}><FlipHorizontal2 className="h-4 w-4" /></IconButton>
      <IconButton label="Vertikal spiegeln" active={img.flipY} onClick={() => patch({ flipY: !img.flipY })}><FlipVertical2 className="h-4 w-4" /></IconButton>
      <IconButton label={croppingId === img.id ? 'Zuschneiden beenden' : 'Zuschneiden'} active={croppingId === img.id} disabled={!single || !img.naturalWidth || img.locked}
        onClick={() => useUiStore.getState().setCropping(croppingId === img.id ? null : img.id)}><Crop className="h-4 w-4" /></IconButton>
      <IconButton label="Hintergrund entfernen" disabled={!single || busy || img.locked} onClick={() => void removeBackground()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
      </IconButton>
      <Divider />
      <NumberStepper label="Eckenradius" value={img.cornerRadius ?? 0} min={0} max={500} onChange={(v) => patch({ cornerRadius: v }, 'radius')} />
    </>
  );
}
