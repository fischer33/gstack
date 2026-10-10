import { promises as fs } from "fs";
import path from "path";
import { renderSvg } from "@/lib/media-svg";
import { MEDIA_DIR } from "@/lib/providers/replicate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Echte (heruntergeladene) Bilder haben Vorrang; die UUID-Prüfung verhindert Pfad-Tricks.
  if (UUID.test(params.id)) {
    try {
      const file = await fs.readFile(path.join(MEDIA_DIR, `${params.id}.png`));
      return new Response(file, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  const q = new URL(req.url).searchParams;
  const clamp = (v: string | null, d: number) => Math.min(2000, Math.max(100, Number(v) || d));
  const svg = renderSvg({
    seed: params.id,
    w: clamp(q.get("w"), 768),
    h: clamp(q.get("h"), 768),
    animated: q.get("v") === "1",
    label: q.get("p") ?? undefined,
  });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
