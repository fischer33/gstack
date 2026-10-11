import { NextResponse } from "next/server";
import { addItem } from "@/lib/db";
import { detectImageExt, saveImage } from "@/lib/media-store";
import type { MediaItem } from "@/lib/types";

const MAX_BYTES = 15 * 1024 * 1024;

// POST /api/upload  (multipart/form-data, Feld "file"): eigene Bilder in die Library laden.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage (multipart/form-data erwartet)" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Feld 'file' fehlt" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Datei ist größer als 15 MB" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  // Der Dateityp wird am Inhalt erkannt, nicht am Namen oder Content-Type des Absenders.
  if (!detectImageExt(buf)) return NextResponse.json({ error: "Nur PNG, JPG oder WebP erlaubt" }, { status: 415 });

  const id = await saveImage(buf);
  const name = file.name.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 100) || "Upload";
  const item: MediaItem = {
    id,
    type: "image",
    prompt: name,
    model: "Upload",
    aspect: "1:1",
    url: `/api/media/${id}`,
    provider: "upload",
    source: "ui",
    createdAt: new Date().toISOString(),
  };
  await addItem(item);
  return NextResponse.json(item, { status: 201 });
}
