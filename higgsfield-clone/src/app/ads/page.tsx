"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clapperboard, Loader2, Plus, Trash2 } from "lucide-react";
import { HEX_COLOR, drawOverlay } from "@/lib/overlay-canvas";
import type { MediaItem } from "@/lib/types";

const FORMATS = { "9:16": [720, 1280], "1:1": [1080, 1080], "16:9": [1280, 720] } as const;
type Format = keyof typeof FORMATS;
const MAX_SLIDES = 10;

interface Slide {
  mediaId: string;
  url: string;
  headline: string;
  sub: string;
  fit?: "cover" | "contain"; // leer = Einstellung des ganzen Films
  tone?: "light" | "dark"; // Textfarbe: light = weiß (dunkle Bilder), dark = dunkel (helle Bilder)
}

// Nur echte Bilder: Platzhalter (Mock) haben keine Datei und lassen sich nicht rendern.
const usable = (i: MediaItem) => i.type === "image" && !!i.provider && i.provider !== "mock";

export default function AdsPage() {
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [format, setFormat] = useState<Format>("9:16");
  const [secs, setSecs] = useState(3);
  const [fade, setFade] = useState(0.5);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [textStyle, setTextStyle] = useState<"standard" | "brand">("standard");
  const [ctaColor, setCtaColor] = useState("#ffffff");
  const [showScript, setShowScript] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [scriptMsg, setScriptMsg] = useState("");
  const [title, setTitle] = useState("");
  const [cta, setCta] = useState("Jetzt entdecken");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MediaItem | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const [w, h] = FORMATS[format];
  const current = slides[sel];
  const isLast = sel === slides.length - 1;
  const slideFit = current?.fit ?? fit;
  const [cornerColor, setCornerColor] = useState("#000");

  // Farbe der oberen linken Bildecke für die Vorschau im Modus "einpassen" (wie im fertigen Film)
  useEffect(() => {
    if (!current || slideFit !== "contain") return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 16, 16, 0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      setCornerColor(`rgb(${d[0]},${d[1]},${d[2]})`);
    };
    img.src = current.url;
  }, [current?.url, slideFit]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = slides.length ? slides.length * secs - (slides.length - 1) * fade : 0;

  useEffect(() => {
    fetch("/api/library", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLibrary);
  }, []);

  useEffect(() => {
    const c = previewRef.current;
    if (c && current) drawOverlay(c, { headline: current.headline, sub: current.sub, cta: isLast ? cta : undefined, tone: current.tone, style: textStyle, ctaColor });
  }, [current, isLast, cta, textStyle, ctaColor, format, w, h]);

  const update = (i: number, patch: Partial<Slide>) => setSlides((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= slides.length) return;
    setSlides((s) => {
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setSel(j);
  };
  const remove = (i: number) => {
    setSlides((s) => s.filter((_, k) => k !== i));
    setSel((p) => Math.max(0, Math.min(p, slides.length - 2)));
  };
  const add = (m: MediaItem) => {
    if (slides.length >= MAX_SLIDES) return setError(`Maximal ${MAX_SLIDES} Folien`);
    setError("");
    setSlides((s) => [...s, { mediaId: m.id, url: m.url, headline: "", sub: "" }]);
    setSel(slides.length);
  };

  // Drehbuch (JSON) einlesen: setzt Format, Zeiten, Call-to-Action und die Folien samt Texten.
  // Bilder werden über "match" gefunden: ein Teil des Bildtitels (z. B. "hoodie-black-front").
  function applyScript() {
    setScriptMsg("");
    setError("");
    try {
      const d = JSON.parse(scriptText);
      if (!d || typeof d !== "object") throw new Error("Das Drehbuch muss ein JSON-Objekt sein");
      if (!(d.format in FORMATS)) throw new Error("format muss 9:16, 1:1 oder 16:9 sein");
      const sec = Number(d.secondsPerSlide ?? 3);
      const tr = Number(d.transition ?? 0.5);
      if (!(sec >= 2 && sec <= 6)) throw new Error("secondsPerSlide muss zwischen 2 und 6 liegen");
      if (!(tr >= 0 && tr <= 1.5 && tr <= sec - 0.5)) throw new Error("transition passt nicht zur Folienlänge");
      if (!Array.isArray(d.slides) || d.slides.length < 1 || d.slides.length > MAX_SLIDES) throw new Error(`slides: 1 bis ${MAX_SLIDES} Folien`);
      const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const next: Slide[] = [];
      const missing: string[] = [];
      for (const sl of d.slides) {
        const key = norm(String(sl.match ?? ""));
        const hits = images.filter((m) => key && norm(m.prompt).includes(key)).sort((a, b) => a.prompt.length - b.prompt.length);
        if (!hits.length) { missing.push(String(sl.match)); continue; }
        next.push({ mediaId: hits[0].id, url: hits[0].url, headline: String(sl.headline ?? "").slice(0, 80), sub: String(sl.sub ?? "").slice(0, 140), fit: sl.fit === "contain" || sl.fit === "cover" ? sl.fit : undefined, tone: sl.tone === "dark" || sl.tone === "light" ? sl.tone : undefined });
      }
      if (missing.length) throw new Error(`Diese Bilder fehlen in der Library (zuerst importieren): ${missing.join(", ")}`);
      setFormat(d.format);
      setSecs(sec);
      setFade(tr);
      setFit(d.fit === "contain" ? "contain" : "cover");
      if (typeof d.cta === "string") setCta(d.cta.slice(0, 40));
      if (d.style === "brand" || d.style === "standard") setTextStyle(d.style);
      if (typeof d.ctaColor === "string" && HEX_COLOR.test(d.ctaColor)) setCtaColor(d.ctaColor);
      if (typeof d.title === "string") setTitle(d.title.slice(0, 100));
      setSlides(next);
      setSel(0);
      setScriptMsg(`${next.length} Folien übernommen.`);
    } catch (e) {
      setError(e instanceof SyntaxError ? "Das Drehbuch ist kein gültiges JSON" : (e as Error).message);
    }
  }

  async function render() {
    setError("");
    setResult(null);
    if (!slides.length) return setError("Füge mindestens ein Bild hinzu.");
    setBusy(true);
    try {
      const payload = slides.map((s, i) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        drawOverlay(c, { headline: s.headline, sub: s.sub, cta: i === slides.length - 1 ? cta : undefined, tone: s.tone, style: textStyle, ctaColor });
        return { mediaId: s.mediaId, overlay: c.toDataURL("image/png"), fit: s.fit };
      });
      const res = await fetch("/api/ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, secondsPerSlide: secs, transition: fade, fit, title, slides: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Rendern");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const images = (library ?? []).filter(usable);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold"><Clapperboard size={20} /> Ad-Maker</h1>
      <p className="mb-4 text-sm text-muted">
        Aus Bildern wird ein kurzer Werbefilm (MP4) mit Zoom, Überblendung und Text. Läuft lokal und kostenlos.
        Das ist eine Bilder-Show, kein KI-Video.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section>
            <h2 className="mb-2 text-sm font-semibold">1. Bilder wählen ({slides.length}/{MAX_SLIDES})</h2>
            {library === null && <p className="text-sm text-muted">Lädt…</p>}
            {library && images.length === 0 && (
              <p className="text-sm text-muted">
                Noch keine echten Bilder. Lade eigene in der <Link href="/library" className="text-accent underline">Library</Link> hoch
                oder erzeuge welche unter <Link href="/create" className="text-accent underline">Create</Link>.
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((m) => (
                <button key={m.id} onClick={() => add(m)} title={m.prompt} className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.prompt} className="h-full w-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100"><Plus size={20} /></span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <button onClick={() => setShowScript((v) => !v)} className="text-sm text-accent underline">{showScript ? "Drehbuch ausblenden" : "Drehbuch einfügen (alles auf einmal ausfüllen)"}</button>
            {showScript && (
              <div className="mt-2 rounded-xl border border-line bg-surface p-3">
                <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} rows={8} aria-label="Drehbuch" placeholder='{"format":"9:16","fit":"contain","slides":[{"match":"hoodie-black-front","headline":"Bald."}]}'
                  className="w-full resize-y rounded-lg border border-line bg-bg p-2 font-mono text-xs outline-none focus:border-accent" />
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={applyScript} disabled={!scriptText.trim() || library === null} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">Übernehmen</button>
                  {scriptMsg && <span className="text-sm text-muted">{scriptMsg}</span>}
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">2. Folien und Texte</h2>
            {slides.length === 0 && <p className="text-sm text-muted">Klicke oben auf ein Bild, um es hinzuzufügen.</p>}
            <ul className="space-y-2">
              {slides.map((s, i) => (
                <li key={i} onClick={() => setSel(i)} className={`flex gap-3 rounded-xl border p-2 ${sel === i ? "border-accent bg-surface" : "border-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <input value={s.headline} onChange={(e) => update(i, { headline: e.target.value })} maxLength={80} placeholder="Überschrift" aria-label={`Überschrift Folie ${i + 1}`}
                      className="w-full rounded-md border border-line bg-bg px-2 py-1 text-sm outline-none focus:border-accent" />
                    <input value={s.sub} onChange={(e) => update(i, { sub: e.target.value })} maxLength={140} placeholder="Unterzeile (optional)" aria-label={`Unterzeile Folie ${i + 1}`}
                      className="w-full rounded-md border border-line bg-bg px-2 py-1 text-xs outline-none focus:border-accent" />
                    <select value={s.fit ?? ""} onChange={(e) => update(i, { fit: (e.target.value || undefined) as Slide["fit"] })} aria-label={`Bildausschnitt Folie ${i + 1}`}
                      className="rounded-md border border-line bg-bg px-1 py-0.5 text-xs text-muted">
                      <option value="">Bild: wie im ganzen Film</option>
                      <option value="cover">Bild: füllen</option>
                      <option value="contain">Bild: einpassen</option>
                    </select>
                    <select value={s.tone ?? ""} onChange={(e) => update(i, { tone: (e.target.value || undefined) as Slide["tone"] })} aria-label={`Textfarbe Folie ${i + 1}`}
                      className="ml-1 rounded-md border border-line bg-bg px-1 py-0.5 text-xs text-muted">
                      <option value="">Text: weiß</option>
                      <option value="dark">Text: dunkel (helle Bilder)</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-between">
                    <button onClick={(e) => { e.stopPropagation(); move(i, -1); }} aria-label="Nach oben" disabled={i === 0} className="disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); move(i, 1); }} aria-label="Nach unten" disabled={i === slides.length - 1} className="disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label="Folie entfernen" className="text-red-500"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted">Call-to-Action (letzte Folie)</span>
              <input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={40} className="w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted">Titel in der Library (optional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className="w-full rounded-lg border border-line bg-surface px-3 py-2 outline-none focus:border-accent" />
            </label>
          </section>
        </div>

        <aside className="space-y-4">
          <div>
            <span className="mb-1 block text-sm text-muted">Format</span>
            <div className="flex gap-2">
              {(Object.keys(FORMATS) as Format[]).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={`rounded-lg px-3 py-1 text-sm ${format === f ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm text-muted">Textstil</span>
            <div className="flex gap-2">
              <button onClick={() => setTextStyle("standard")} className={`rounded-lg px-3 py-1 text-sm ${textStyle === "standard" ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>Standard</button>
              <button onClick={() => setTextStyle("brand")} className={`rounded-lg px-3 py-1 text-sm ${textStyle === "brand" ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>Marke (GROSS, weit)</button>
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm text-muted">Farbe des Call-to-Action-Knopfs</span>
            <div className="flex items-center gap-2">
              {["#ffffff", "#EDEAE3", "#d1fe17"].map((c) => (
                <button key={c} onClick={() => setCtaColor(c)} aria-label={`Farbe ${c}`} style={{ background: c }} className={`h-7 w-7 rounded-full border ${ctaColor.toLowerCase() === c.toLowerCase() ? "border-accent ring-2 ring-accent" : "border-line"}`} />
              ))}
              <span className="text-xs text-muted">{ctaColor}</span>
            </div>
          </div>
          <div>
            <span className="mb-1 block text-sm text-muted">Bild im Format</span>
            <div className="flex gap-2">
              <button onClick={() => setFit("cover")} className={`rounded-lg px-3 py-1 text-sm ${fit === "cover" ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>Füllen</button>
              <button onClick={() => setFit("contain")} className={`rounded-lg px-3 py-1 text-sm ${fit === "contain" ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`}>Einpassen</button>
            </div>
            <p className="mt-1 text-xs text-muted">{fit === "cover" ? "Das Bild füllt alles, Ränder werden abgeschnitten." : "Das ganze Bild bleibt sichtbar, der Rest wird unscharf aufgefüllt."}</p>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Sekunden pro Folie: {secs}</span>
            <input type="range" min={2} max={6} step={0.5} value={secs} onChange={(e) => { const v = Number(e.target.value); setSecs(v); setFade((f) => Math.min(f, v - 0.5)); }} className="w-full accent-[#d1fe17]" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Überblendung: {fade} s</span>
            <input type="range" min={0} max={1.5} step={0.25} value={fade} onChange={(e) => setFade(Math.min(Number(e.target.value), secs - 0.5))} className="w-full accent-[#d1fe17]" />
          </label>

          <div>
            <span className="mb-1 block text-sm text-muted">Vorschau{current ? ` (Folie ${sel + 1})` : ""}</span>
            <div className="relative mx-auto max-h-[50vh] overflow-hidden rounded-xl bg-surface" style={{ aspectRatio: `${w}/${h}`, maxWidth: format === "9:16" ? 260 : "100%", ...(current && slideFit === "contain" ? { background: cornerColor } : {}) }}>
              {current ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current.url} alt="" className={`absolute inset-0 h-full w-full ${slideFit === "contain" ? "object-contain" : "object-cover"}`} style={slideFit === "contain" ? { objectPosition: "50% 22%" } : undefined} />
                  <canvas ref={previewRef} width={w} height={h} className="absolute inset-0 h-full w-full" />
                </>
              ) : (
                <div className="grid h-full place-items-center p-4 text-center text-sm text-muted">Wähle ein Bild</div>
              )}
            </div>
          </div>

          <button onClick={render} disabled={busy || !slides.length} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-semibold text-accent-fg disabled:opacity-60">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Clapperboard size={18} />}
            Werbefilm erstellen{slides.length ? ` (${total.toFixed(1)} s)` : ""}
          </button>
          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}
        </aside>
      </div>

      {result && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold">Fertig</h2>
          <video src={result.url} controls loop playsInline className="mx-auto max-h-[70vh] rounded-xl" />
          <p className="mt-2 text-center text-sm">
            <a href={result.url} download={`${result.id}.mp4`} className="text-accent underline">MP4 herunterladen</a>
            {" · "}
            <Link href="/library" className="text-accent underline">In der Library ansehen</Link>
          </p>
        </section>
      )}
    </div>
  );
}
