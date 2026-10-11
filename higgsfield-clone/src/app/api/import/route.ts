import { NextResponse } from "next/server";
import { addItem } from "@/lib/db";
import { fetchImage } from "@/lib/import-url";
import { saveImage } from "@/lib/media-store";
import type { MediaItem } from "@/lib/types";

const MAX_URLS = 30;

// POST /api/import  { urls: string[] }: Bilder von erlaubten Adressen (cdn.shopify.com) in die Library laden.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const urls: unknown = body?.urls;
  if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS || urls.some((u) => typeof u !== "string")) {
    return NextResponse.json({ error: `urls: 1 bis ${MAX_URLS} Adressen erforderlich` }, { status: 400 });
  }

  const items: MediaItem[] = [];
  const errors: { url: string; error: string }[] = [];
  for (const url of [...new Set(urls as string[])]) {
    try {
      const { buf } = await fetchImage(url);
      const id = await saveImage(buf);
      // Dateiname ohne Endung und Hash-Anhang als Titel, z. B. "unisex-oversized-heavyweight-hoodie-black-front"
      const base = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").replace(/\.[^.]*$/, "");
      const title = base.replace(/-[0-9a-f]{12,}$/i, "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 100) || "Import";
      const item: MediaItem = {
        id,
        type: "image",
        prompt: title,
        model: "Import",
        aspect: "1:1",
        url: `/api/media/${id}`,
        provider: "upload",
        source: "ui",
        createdAt: new Date().toISOString(),
      };
      await addItem(item);
      items.push(item);
    } catch (err) {
      errors.push({ url: url.slice(0, 200), error: (err as Error).message });
    }
  }
  return NextResponse.json({ items, errors }, { status: items.length ? 201 : 422 });
}
