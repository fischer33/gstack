import { promises as fs } from "fs";
import { renderSvg } from "@/lib/media-svg";
import { findMediaFile } from "@/lib/media-store";

const CACHE = "public, max-age=31536000, immutable";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // Gespeicherte Dateien (Bilder, Videos) haben Vorrang vor dem Platzhalter.
  const media = await findMediaFile(params.id);
  if (media) {
    const buf = await fs.readFile(media.file);
    // Range-Unterstützung: Safari spielt Videos nur mit Teilabrufen (206) ab.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (range && buf.length > 0) {
      let start = range[1] ? Number(range[1]) : buf.length - Number(range[2] || 0);
      let end = range[1] && range[2] ? Number(range[2]) : buf.length - 1;
      start = Math.max(0, start);
      end = Math.min(buf.length - 1, end);
      if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${buf.length}` } });
      return new Response(new Uint8Array(buf.subarray(start, end + 1)), {
        status: 206,
        headers: {
          "Content-Type": media.type,
          "Content-Range": `bytes ${start}-${end}/${buf.length}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": CACHE,
        },
      });
    }
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": media.type, "Accept-Ranges": "bytes", "Cache-Control": CACHE },
    });
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
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE } });
}
