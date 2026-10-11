// Zeichnet die Text-Ebene einer Folie (Überschrift, Unterzeile, optional Call-to-Action) auf ein Canvas.
// Dieselbe Funktion rendert die Vorschau und die PNG-Ebene für den Export, damit beides gleich aussieht.

export interface OverlayText {
  headline: string;
  sub: string;
  cta?: string; // nur auf der letzten Folie
  tone?: "light" | "dark"; // light = weißer Text (für dunkle Bilder), dark = dunkler Text (für helle Bilder)
  style?: "standard" | "brand"; // brand = Großbuchstaben mit weitem Buchstabenabstand
  ctaColor?: string; // Farbe des Call-to-Action-Knopfs, z. B. "#EDEAE3"
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type TrackingCtx = CanvasRenderingContext2D & { letterSpacing?: string };

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
  const ctx = canvas.getContext("2d") as TrackingCtx | null;
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const brand = o.style === "brand";
  const dark = o.tone === "dark";
  const headline = brand ? o.headline.trim().toUpperCase() : o.headline.trim();
  const sub = brand ? o.sub.trim().toUpperCase() : o.sub.trim();
  const cta = o.cta?.trim();
  if (!headline && !sub && !cta) return;

  const margin = w * 0.08;
  const maxW = w - 2 * margin;
  const unit = Math.min(w, h * 0.7); // skaliert Schrift auch bei Querformat sinnvoll
  const hSize = Math.round(unit * (brand ? 0.062 : 0.085));
  const sSize = Math.round(unit * (brand ? 0.03 : 0.042));
  const cSize = Math.round(unit * 0.04);
  const hTrack = brand ? "0.14em" : "0em";
  const sTrack = brand ? "0.2em" : "0em";
  const font = (px: number, weight: number) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const setSpacing = (v: string) => { ctx.letterSpacing = v; }; // ältere Browser ignorieren das einfach

  setSpacing(hTrack);
  ctx.font = font(hSize, brand ? 600 : 800);
  const hLines = headline ? wrap(ctx, headline, maxW) : [];
  setSpacing(sTrack);
  ctx.font = font(sSize, 500);
  const sLines = sub ? wrap(ctx, sub, maxW) : [];

  const hLine = hSize * 1.18;
  const sLine = sSize * (brand ? 1.7 : 1.3);
  const hBlock = hLines.length * hLine;
  const sBlock = sLines.length * sLine;
  const ctaH = cta ? cSize * 2.4 : 0;
  const gap = hLines.length && sLines.length ? sSize * 0.7 : 0;
  const ctaGap = cta && (hBlock || sBlock) ? cSize * 1.1 : 0;
  const total = hBlock + gap + sBlock + ctaGap + ctaH;
  // Im Hochformat (Reels, TikTok) liegen unten Bedienelemente und Bildunterschrift: Text höher setzen.
  const bottom = h - h * (h > w ? 0.2 : 0.08);
  const top = bottom - total;

  // Verlauf hinter dem Text, damit er lesbar bleibt: dunkel für weißen Text, hell für dunklen Text.
  const gradTop = Math.max(0, top - h * 0.14);
  const rgb = dark ? "255,255,255" : "0,0,0";
  const grad = ctx.createLinearGradient(0, gradTop, 0, h);
  const stop = Math.min(0.95, (bottom + h * 0.02 - gradTop) / (h - gradTop));
  grad.addColorStop(0, `rgba(${rgb},0)`);
  grad.addColorStop(stop, `rgba(${rgb},${dark ? 0.9 : 0.78})`);
  grad.addColorStop(1, `rgba(${rgb},${dark ? 0.92 : 0.85})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, w, h - gradTop);

  ctx.textBaseline = "top";
  const ink = dark ? "#0d0d0d" : "#ffffff";
  ctx.shadowColor = dark ? "rgba(255,255,255,0.0)" : "rgba(0,0,0,0.5)";
  ctx.shadowBlur = dark ? 0 : hSize * 0.15;
  let y = top;

  ctx.fillStyle = ink;
  setSpacing(hTrack);
  ctx.font = font(hSize, brand ? 600 : 800);
  for (const line of hLines) {
    ctx.fillText(line, margin, y);
    y += hLine;
  }
  y += gap;
  ctx.fillStyle = dark ? "rgba(13,13,13,0.78)" : "rgba(255,255,255,0.88)";
  setSpacing(sTrack);
  ctx.font = font(sSize, 500);
  for (const line of sLines) {
    ctx.fillText(line, margin, y);
    y += sLine;
  }

  if (cta) {
    y += ctaGap;
    ctx.shadowBlur = 0;
    setSpacing(brand ? "0.12em" : "0em");
    ctx.font = font(cSize, 700);
    const label = brand ? cta.toUpperCase() : cta;
    const padX = cSize * 1.5;
    const btnW = Math.min(maxW, ctx.measureText(label).width + 2 * padX);
    ctx.fillStyle = o.ctaColor && HEX_COLOR.test(o.ctaColor) ? o.ctaColor : "#ffffff";
    ctx.beginPath();
    ctx.roundRect(margin, y, btnW, ctaH, brand ? 4 : ctaH / 2);
    ctx.fill();
    ctx.fillStyle = "#0d0d0d";
    ctx.textBaseline = "middle";
    ctx.fillText(label, margin + padX, y + ctaH / 2, btnW - 2 * padX);
  }
  setSpacing("0em");
}
