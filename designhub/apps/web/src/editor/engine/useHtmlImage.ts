import { useEffect, useState } from 'react';

const cache = new Map<string, HTMLImageElement>();

/** Lädt ein Bild einmal pro URL und teilt es zwischen allen Knoten. Liefert undefined, solange es lädt oder fehlschlägt. */
export function useHtmlImage(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() => (cache.get(src)?.complete ? cache.get(src) : undefined));
  useEffect(() => {
    if (!src) return setImg(undefined);
    const hit = cache.get(src);
    if (hit?.complete && hit.naturalWidth) return setImg(hit);
    const el = hit ?? new Image();
    if (!hit) { el.src = src; cache.set(src, el); }
    const done = () => setImg(el.naturalWidth ? el : undefined);
    el.addEventListener('load', done);
    el.addEventListener('error', done);
    return () => { el.removeEventListener('load', done); el.removeEventListener('error', done); };
  }, [src]);
  return img;
}
