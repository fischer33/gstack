import { renderSvg } from "@/lib/media-svg";

export async function GET(req: Request, { params }: { params: { id: string } }) {
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
