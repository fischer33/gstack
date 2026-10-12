import { newId, type Element } from '@designhub/shared';

/** Erzeugt `n` gemischte Testobjekte (Rechtecke, Ellipsen, Sterne, Text) für Leistungsmessungen: `/design/:id?bench=300`. */
export function makeBenchElements(n: number, page: { width: number; height: number }): Element[] {
  const out: Element[] = [];
  const colors = ['#7d2ae8', '#00b8c4', '#ffbd59', '#ff5757', '#1e2030'];
  let seed = 42;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < n; i++) {
    const w = 60 + rnd() * 160, h = 60 + rnd() * 160;
    const base = { id: newId(), x: rnd() * (page.width - w), y: rnd() * (page.height - h), width: w, height: h, rotation: rnd() * 60 - 30, opacity: 0.9, locked: false, visible: true };
    const kind = i % 4;
    out.push(kind === 3
      ? { ...base, type: 'text', text: `Objekt ${i}`, fontFamily: 'Inter', fontSize: 28, fontWeight: 400, italic: false, underline: false, align: 'left', fill: colors[i % 5], lineHeight: 1.2, letterSpacing: 0, height: 34 }
      : { ...base, type: 'shape', kind: (['rect', 'ellipse', 'star'] as const)[kind], fill: colors[i % 5], stroke: '#000000', strokeWidth: i % 8 === 0 ? 2 : 0 });
  }
  return out;
}
