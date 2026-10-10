"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/data/mock";
import { ASPECT_SIZE, CREDIT_COST, type Aspect, type MediaItem, type MediaType } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

function CreateForm() {
  const params = useSearchParams();
  const { credits, spend } = useAppStore();
  const [type, setType] = useState<MediaType>(params.get("type") === "video" ? "video" : "image");
  const [prompt, setPrompt] = useState(params.get("prompt") ?? "");
  const [model, setModel] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MediaItem | null>(null);

  const models = type === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const cost = CREDIT_COST[type] * (type === "video" && duration === 10 ? 2 : 1);

  async function generate() {
    setError("");
    if (!prompt.trim()) return setError("Bitte einen Prompt eingeben.");
    if (!spend(cost)) return setError("Nicht genug Credits.");
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, prompt, aspect, duration: type === "video" ? duration : undefined, model: model || models[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [rw, rh] = ASPECT_SIZE[aspect];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[360px_1fr]">
      <div className="space-y-4">
        <div className="flex rounded-full bg-surface p-1">
          {(["image", "video"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setModel(""); setAspect(t === "video" ? "16:9" : "1:1"); }}
              className={`flex-1 rounded-full py-1.5 text-sm ${type === t ? "bg-accent font-semibold text-accent-fg" : "text-muted"}`}
            >
              {t === "image" ? "Bild" : "Video"}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={1000}
          rows={5}
          placeholder="Beschreibe deine Szene…"
          className="w-full resize-none rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-accent"
        />

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Modell</span>
          <select value={model || models[0]} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-line bg-surface p-2">
            {models.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-sm text-muted">Seitenverhältnis</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ASPECT_SIZE) as Aspect[]).map((a) => (
              <button key={a} onClick={() => setAspect(a)} className={`rounded-lg px-3 py-1 text-sm ${aspect === a ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {type === "video" && (
          <div>
            <span className="mb-1 block text-sm text-muted">Dauer</span>
            <div className="flex gap-2">
              {([5, 10] as const).map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={`rounded-lg px-3 py-1 text-sm ${duration === d ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>
                  {d} s
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
          Generieren ({cost} Credits)
        </button>
        <p className="text-xs text-muted">Guthaben: {credits} Credits</p>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-line bg-surface p-4">
        {busy && (
          <div className="text-center text-muted">
            <Loader2 className="mx-auto mb-2 animate-spin" /> Generiere…
          </div>
        )}
        {!busy && result && (
          <div className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.url} alt={result.prompt} className="mx-auto max-h-[70vh] rounded-xl" style={{ aspectRatio: `${rw}/${rh}` }} />
            <Link href="/library" className="mt-3 block text-center text-sm text-accent underline">In der Library ansehen</Link>
          </div>
        )}
        {!busy && !result && <p className="text-muted">Dein Ergebnis erscheint hier.</p>}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateForm />
    </Suspense>
  );
}
