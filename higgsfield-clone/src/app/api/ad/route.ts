import { NextResponse } from "next/server";
import { addItem } from "@/lib/db";
import { AD_FORMATS, renderAd, type AdFormat, type AdSlide } from "@/lib/ad-render";
import { findMediaFile } from "@/lib/media-store";
import type { MediaItem } from "@/lib/types";

const MAX_SLIDES = 10;
const MAX_OVERLAY_BYTES = 4 * 1024 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// POST /api/ad  { format, secondsPerSlide, transition, title?, slides: [{ mediaId, overlay }] }
// "overlay" ist ein transparentes PNG (Data-URL) in voller Videogröße mit dem Text der Folie.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Ungültige Anfrage");

  const format = body.format as AdFormat;
  if (!(format in AD_FORMATS)) return bad("format muss 9:16, 1:1 oder 16:9 sein");
  const secs = Number(body.secondsPerSlide);
  const fade = Number(body.transition);
  if (!(secs >= 2 && secs <= 8)) return bad("secondsPerSlide muss zwischen 2 und 8 liegen");
  if (!(fade >= 0 && fade <= 1.5 && fade < secs)) return bad("transition muss zwischen 0 und 1,5 liegen und kürzer als eine Folie sein");
  if (!Array.isArray(body.slides) || body.slides.length < 1 || body.slides.length > MAX_SLIDES) {
    return bad(`1 bis ${MAX_SLIDES} Folien erforderlich`);
  }

  const slides: AdSlide[] = [];
  for (const [i, s] of body.slides.entries()) {
    const media = typeof s?.mediaId === "string" ? await findMediaFile(s.mediaId) : null;
    if (!media || !media.isImage) {
      return bad(`Folie ${i + 1}: Bild nicht gefunden (Platzhalter-Bilder lassen sich nicht verwenden)`);
    }
    const m = typeof s.overlay === "string" ? DATA_URL.exec(s.overlay) : null;
    const overlayPng = m ? Buffer.from(m[1], "base64") : null;
    if (!overlayPng || overlayPng.length > MAX_OVERLAY_BYTES || !overlayPng.subarray(0, 8).equals(PNG_MAGIC)) {
      return bad(`Folie ${i + 1}: Text-Ebene ungültig`);
    }
    slides.push({ imageFile: media.file, overlayPng, fit: s.fit === "contain" || s.fit === "cover" ? s.fit : undefined });
  }

  let result;
  try {
    result = await renderAd({ slides, format, secondsPerSlide: secs, transition: fade, fit: body.fit === "contain" ? "contain" : "cover" });
  } catch (err) {
    console.error("[ad]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const title = typeof body.title === "string" ? body.title.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 100) : "";
  const item: MediaItem = {
    id: result.id,
    type: "video",
    prompt: title || "Werbefilm",
    model: "Ad-Maker (ffmpeg)",
    aspect: format,
    duration: result.seconds,
    url: `/api/media/${result.id}`,
    provider: "ffmpeg",
    source: "ui",
    createdAt: new Date().toISOString(),
  };
  await addItem(item);
  return NextResponse.json(item, { status: 201 });
}
