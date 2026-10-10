// Mock-Renderer: erzeugt aus einem Seed ein Farbverlauf-Bild (SVG).
// animated=true liefert ein SVG mit SMIL-Animation und dient als Platzhalter-"Video".

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderSvg(opts: {
  seed: string;
  w: number;
  h: number;
  animated?: boolean;
  label?: string;
}): string {
  const { seed, w, h, animated, label } = opts;
  const n = hash(seed);
  const h1 = n % 360;
  const h2 = (h1 + 50 + ((n >> 8) % 90)) % 360;
  const h3 = (h1 + 180 + ((n >> 16) % 60)) % 360;
  const circles = [0, 1, 2].map((i) => {
    const r = Math.round(Math.min(w, h) * (0.28 + ((n >> (i * 5)) % 20) / 100));
    const cx = Math.round(w * (0.2 + (((n >> (i * 7)) % 60) / 100)));
    const cy = Math.round(h * (0.2 + (((n >> (i * 3 + 2)) % 60) / 100)));
    const col = `hsl(${[h2, h3, h1][i]} 85% ${55 + i * 5}%)`;
    const anim = animated
      ? `<animate attributeName="cx" values="${cx};${w - cx};${cx}" dur="${6 + i * 2}s" repeatCount="indefinite"/>` +
        `<animate attributeName="cy" values="${cy};${h - cy};${cy}" dur="${5 + i * 3}s" repeatCount="indefinite"/>`
      : "";
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="0.75">${anim}</circle>`;
  });
  const text = label
    ? `<rect x="0" y="${h - 64}" width="${w}" height="64" fill="black" opacity="0.45"/>` +
      `<text x="16" y="${h - 28}" fill="white" font-family="system-ui,sans-serif" font-size="${Math.max(
        14,
        Math.round(w / 40),
      )}">${esc(label.slice(0, 70))}</text>`
    : "";
  const badge = animated
    ? `<g><circle cx="${w - 32}" cy="32" r="14" fill="black" opacity="0.5"/><path d="M${w - 37} 24 L${w - 37} 40 L${w - 24} 32 Z" fill="white"/></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 70% 18%)"/><stop offset="1" stop-color="hsl(${h2} 70% 35%)"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) / 10)}"/></filter></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<g filter="url(#b)">${circles.join("")}</g>${badge}${text}</svg>`;
}
