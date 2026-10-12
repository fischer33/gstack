import { Image as KImage } from 'react-konva';
import type { Page } from '@designhub/shared';
import { useHtmlImage } from './useHtmlImage';

export function backgroundProps(bg: Page['background'], w: number, h: number) {
  if (bg.type === 'gradient') {
    // CSS-Winkel (0° = nach oben, 90° = nach rechts) → Start/Endpunkt durch die Mitte
    const a = ((bg.angle - 90) * Math.PI) / 180, cx = w / 2, cy = h / 2, r = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
    return {
      fillLinearGradientStartPoint: { x: cx - Math.cos(a) * r, y: cy - Math.sin(a) * r },
      fillLinearGradientEndPoint: { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
      fillLinearGradientColorStops: bg.stops.flatMap((s) => [s.offset, s.color]),
    };
  }
  return { fill: bg.type === 'solid' ? bg.color : '#ffffff' };
}

/** Bildhintergrund: "cover" füllt die Seite (Rand wird beschnitten), "contain" passt das ganze Bild ein. */
export function BackgroundImage({ src, fit, width, height }: { src: string; fit: 'cover' | 'contain'; width: number; height: number }) {
  const img = useHtmlImage(src);
  if (!img) return null;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (fit === 'contain') {
    const k = Math.min(width / iw, height / ih);
    return <KImage image={img} x={(width - iw * k) / 2} y={(height - ih * k) / 2} width={iw * k} height={ih * k} listening={false} />;
  }
  const k = Math.max(width / iw, height / ih), cw = width / k, ch = height / k;
  return <KImage image={img} width={width} height={height} crop={{ x: (iw - cw) / 2, y: (ih - ch) / 2, width: cw, height: ch }} listening={false} />;
}
