"use client";
import { useEffect, useState } from "react";
import { MediaCard } from "@/components/feed/MediaCard";
import { FEED } from "@/data/mock";
import type { MediaItem } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export default function ProfilePage() {
  const { likes, credits } = useAppStore();
  const [mine, setMine] = useState<MediaItem[]>([]);

  useEffect(() => {
    fetch("/api/library", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then(setMine);
  }, []);

  const liked = FEED.filter((f) => likes.includes(f.id));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl font-bold text-accent-fg">Y</div>
        <div>
          <h1 className="text-xl font-bold">Du</h1>
          <p className="text-sm text-muted">@creator</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        {[
          ["Beiträge", mine.length],
          ["Likes vergeben", likes.length],
          ["Credits", credits],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface p-4">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 font-semibold">Mit „Gefällt mir“ markiert</h2>
      {liked.length === 0 ? (
        <p className="text-muted">Noch keine Likes. Im Explore-Feed Herz anklicken.</p>
      ) : (
        <div className="columns-2 gap-4 md:columns-3">{liked.map((f) => <MediaCard key={f.id} {...f} />)}</div>
      )}
    </div>
  );
}
