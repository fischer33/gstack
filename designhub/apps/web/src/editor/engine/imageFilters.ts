import type { ImageElement } from '@designhub/shared';

/**
 * Regler (−100…100, Blur in px) → Konva-Filterwerte. Brighten −1…1, Contrast −100…100.
 * Konvas HSL-Filter multipliziert die Sättigung mit 2^s und erreicht damit nie völlig Grau. Wir wollen: Regler −100 = ganz
 * grau (Faktor 0), 0 = unverändert (Faktor 1), +100 = doppelt (Faktor 2). Also s = log2(Faktor), mit kleiner Untergrenze.
 */
export function filterParams(f: ImageElement['filters']) {
  return { brightness: f.brightness / 100, contrast: f.contrast, saturation: Math.log2(Math.max(0.001, 1 + f.saturation / 100)), blurRadius: f.blur };
}
export const hasFilters = (f: ImageElement['filters']) => !!(f.brightness || f.contrast || f.saturation || f.blur);

