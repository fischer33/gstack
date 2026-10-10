"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, Download, Trash2 } from "lucide-react";
import type { MediaItem } from "@/lib/types";

export default function LibraryPage() {
  const [items, setItems] = useState<MediaItem[] | null>(null);

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

  if (!items) return <p className="text-muted">Lädt…</p>;
  if (items.length === 0) return <p className="text-muted">Noch nichts erzeugt. Starte unter „Create“ oder lass Claude etwas generieren.</p>;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 text-xl font-bold">Library ({items.length})</h1>
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {items.map((i) => (
          <figure key={i.id} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.url} alt={i.prompt} className="w-full" />
            {i.source === "claude" && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
                <Bot size={12} /> Claude
              </span>
            )}
            <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-white opacity-0 transition group-hover:opacity-100">
              <p className="line-clamp-2 text-xs">{i.prompt}</p>
              <div className="flex gap-1">
                <a href={i.url} download={`${i.id}.svg`} aria-label="Download" className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Download size={14} /></a>
                <button onClick={() => remove(i.id)} aria-label="Löschen" className="grid h-8 w-8 place-items-center rounded-full bg-white/20"><Trash2 size={14} /></button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
