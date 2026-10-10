import { NextResponse } from "next/server";
import { addItem } from "@/lib/db";
import { getProvider } from "@/lib/providers";
import type { Aspect, MediaItem, MediaType } from "@/lib/types";

const ASPECTS: Aspect[] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

// POST /api/generate  { type, prompt, model?, aspect?, duration?, source? }
// Wird von der UI und vom MCP-Server (Claude) genutzt.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const type = body?.type as MediaType;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if ((type !== "image" && type !== "video") || !prompt || prompt.length > 1000) {
    return NextResponse.json({ error: "type (image|video) und prompt (1-1000 Zeichen) erforderlich" }, { status: 400 });
  }
  const aspect: Aspect = ASPECTS.includes(body?.aspect) ? body.aspect : type === "video" ? "16:9" : "1:1";
  const model = typeof body?.model === "string" ? body.model : type === "video" ? "Kling Mock" : "Soul Mock";
  const duration = type === "video" ? ([5, 10].includes(body?.duration) ? body.duration : 5) : undefined;

  const { id, url } = await getProvider().generate({ type, prompt, model, aspect, duration });
  const item: MediaItem = {
    id,
    type,
    prompt,
    model,
    aspect,
    duration,
    url,
    source: body?.source === "claude" ? "claude" : "ui",
    createdAt: new Date().toISOString(),
  };
  await addItem(item);
  return NextResponse.json(item, { status: 201 });
}
