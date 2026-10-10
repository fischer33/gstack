"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { EFFECTS } from "@/data/mock";

export default function EffectsPage() {
  const [q, setQ] = useState("");
  const list = EFFECTS.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-xl font-bold">Effects</h1>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen…" className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {list.map((e) => (
          <Link key={e.id} href={`/create?type=video&prompt=${encodeURIComponent(e.name + " – ")}`} className="group relative overflow-hidden rounded-xl bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${e.id}?w=480&h=640&v=1`} alt={e.name} className="aspect-[3/4] w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white">
              <p className="text-xs text-white/70">{e.kind}</p>
              <p className="font-medium">{e.name}</p>
            </div>
          </Link>
        ))}
        {list.length === 0 && <p className="text-muted">Keine Treffer.</p>}
      </div>
    </div>
  );
}
