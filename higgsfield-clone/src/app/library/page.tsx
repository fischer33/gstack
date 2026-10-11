"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Download, Loader2, Trash2, Upload } from "lucide-react";
import type { MediaItem } from "@/lib/types";

const downloadName = (i: MediaItem) => `${i.id}${i.provider === "ffmpeg" ? ".mp4" : i.provider === "mock" ? ".svg" : ""}`;

export default function LibraryPage() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/library", { cache: "no-store" });
    if (res.ok) setItems(await res.json());
  }, []);

  // Polling, damit von Claude (MCP) erzeugte Medien automatisch erscheinen
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/library?id=${id}`, { method: "DELETE" });
    load();
  }

  async function upload(files: FileList | File[]) {
    setError("");
    setUploading(true);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) errors.push(`${file.name}: ${(await res.json().catch(() => ({}))).error ?? "Fehler"}`);
    }
    setUploading(false);
    if (errors.length) setError(errors.join(" · "));
    load();
  }

  return (
    <div
      className="mx-auto max-w-6xl"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Library{items ? ` (${items.length})` : ""}</h1>
        <button onClick={() => input.current?.click()} disabled={uploading} className="ml-auto flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Bilder hochladen
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="mb-3 text-sm text-red-500" role="alert">{error}</p>}
      {dragging && <div className="mb-4 rounded-xl border-2 border-dashed border-accent p-6 text-center text-sm">Zum Hochladen hier ablegen (PNG, JPG, WebP, max. 15 MB)</div>}

      {!items && <p className="text-muted">Lädt…</p>}
      {items && items.length === 0 && (
        <p className="text-muted">Noch nichts da. Lade Bilder hoch (auch per Ziehen & Ablegen), starte unter „Create“ oder lass Claude etwas generieren.</p>
      )}
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {items?.map((i) => (
          <figure key={i.id} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-surface">
            {i.provider === "ffmpeg" ? (
              <video src={i.url} controls muted loop playsInline preload="metadata" className="w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.url} alt={i.prompt} className="w-full" />
            )}
            {i.source === "claude" && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
                <Bot size={12} /> Claude
              </span>
            )}
            {i.provider === "upload" && (
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">Upload</span>
            )}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-white opacity-0 transition group-hover:opacity-100">
              <p className="line-clamp-2 text-xs">{i.prompt}</p>
              <div className="pointer-events-auto flex gap-1">
                <a href={i.url} download={downloadName(i)} aria-label="Download" className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Download size={14} /></a>
                <button onClick={() => remove(i.id)} aria-label="Löschen" className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Trash2 size={14} /></button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {items && items.some((i) => i.type === "image" && i.provider && i.provider !== "mock") && (
        <p className="mt-2 text-sm"><Link href="/ads" className="text-accent underline">Aus diesen Bildern einen Werbefilm machen</Link></p>
      )}
    </div>
  );
}
