"use client";
import { Check } from "lucide-react";
import { PLANS } from "@/data/mock";

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-center text-2xl font-bold">Pläne und Credits</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className={`rounded-2xl p-6 ${p.highlight ? "border-2 border-accent bg-surface" : "border border-line bg-surface"}`}>
            <h2 className="text-lg font-semibold">{p.name}</h2>
            <p className="mt-2 text-3xl font-bold">{p.price}<span className="text-sm font-normal text-muted"> / Monat</span></p>
            <p className="mt-1 text-sm text-muted">{p.credits} Credits</p>
            <ul className="my-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2"><Check size={14} className="text-accent" /> {f}</li>
              ))}
            </ul>
            <button className={`w-full rounded-full py-2 text-sm font-semibold ${p.highlight ? "bg-accent text-accent-fg" : "bg-surface2"}`} onClick={() => alert("Demo: keine echte Zahlung")}>
              Auswählen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
