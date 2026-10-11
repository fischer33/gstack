// Zeichnet die Text-Ebene einer Folie (Überschrift, Unterzeile, optional Call-to-Action) auf ein Canvas.
// Dieselbe Funktion rendert die Vorschau und die PNG-Ebene für den Export, damit beides gleich aussieht.

export interface OverlayText {
  headline: string;
  sub: string;
  cta?: string; // nur auf der letzten Folie
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function drawOverlay(canvas: HTMLCanvasElement, o: OverlayText): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const headline = o.headline.trim();
  const sub = o.sub.trim();
  const cta = o.cta?.trim();
  if (!headline && !sub && !cta) return;

  const margin = w * 0.08;
  const maxW = w - 2 * margin;
  const unit = Math.min(w, h * 0.7); // skaliert Schrift auch bei Querformat sinnvoll
  const hSize = Math.round(unit * 0.085);
  const sSize = Math.round(unit * 0.042);
  const cSize = Math.round(unit * 0.045);
  const font = (px: number, weight = 800) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.font = font(hSize);
  const hLines = headline ? wrap(ctx, headline, maxW) : [];
  ctx.font = font(sSize, 500);
  const sLines = sub ? wrap(ctx, sub, maxW) : [];

  const hBlock = hLines.length * hSize * 1.12;
  const sBlock = sLines.length * sSize * 1.3;
  const ctaH = cta ? cSize * 2.3 : 0;
  const gap = hLines.length && sLines.length ? sSize * 0.6 : 0;
  const ctaGap = cta && (hBlock || sBlock) ? cSize * 0.9 : 0;
  const total = hBlock + gap + sBlock + ctaGap + ctaH;
  // Im Hochformat (Reels, TikTok) liegen unten Bedienelemente und Bildunterschrift: Text höher setzen.
  const bottom = h - h * (h > w ? 0.2 : 0.08);
  const top = bottom - total;

  // Verlauf hinter dem Text, damit er auf hellen Bildern lesbar bleibt.
  const gradTop = Math.max(0, top - h * 0.12);
  const grad = ctx.createLinearGradient(0, gradTop, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, w, h - gradTop);

  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = hSize * 0.15;
  let y = top;

  ctx.fillStyle = "#ffffff";
  ctx.font = font(hSize);
  for (const line of hLines) {
    ctx.fillText(line, margin, y);
    y += hSize * 1.12;
  }
  y += gap;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = font(sSize, 500);
  for (const line of sLines) {
    ctx.fillText(line, margin, y);
    y += sSize * 1.3;
  }

  if (cta) {
    y += ctaGap;
    ctx.shadowBlur = 0;
    ctx.font = font(cSize, 800);
    const padX = cSize * 1.4;
    const btnW = Math.min(maxW, ctx.measureText(cta).width + 2 * padX);
    ctx.fillStyle = "#d1fe17";
    ctx.beginPath();
    ctx.roundRect(margin, y, btnW, ctaH, ctaH / 2);
    ctx.fill();
    ctx.fillStyle = "#09090b";
    ctx.textBaseline = "middle";
    ctx.fillText(cta, margin + padX, y + ctaH / 2, btnW - 2 * padX);
  }
}
