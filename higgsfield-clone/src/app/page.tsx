"use client";
import { useState } from "react";
import Link from "next/link";
import { MediaCard } from "@/components/feed/MediaCard";
import { CATEGORIES, FEED } from "@/data/mock";

export default function ExplorePage() {
  const [cat, setCat] = useState("Alle");
  const items = cat === "Alle" ? FEED : FEED.filter((f) => f.category === cat);

  return (
    <div className="mx-auto max-w-6xl">
      <section className="mb-6 rounded-2xl bg-surface p-6 md:p-10">
        <h1 className="text-2xl font-bold md:text-4xl">Erschaffe Bilder und Videos mit KI</h1>
        <p className="mt-2 max-w-xl text-muted">Beschreibe eine Szene, wähle ein Modell und lass dir ein Ergebnis generieren.</p>
        <Link href="/create" className="mt-4 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-fg">
          Jetzt erstellen
        </Link>
      </section>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
              cat === c ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:bg-surface2"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {items.map((f) => (
          <MediaCard key={f.id} {...f} />
        ))}
      </div>
    </div>
  );
}
