import type { Aspect } from "../types";
import { saveImage } from "../media-store";
import { createLimiter } from "./rate-limit";
import type { GenerateRequest, GenerateResult, Provider } from "./index";

const MODEL_RE = /^[\w.-]+\/[\w.-]+$/;
const MAX_BYTES = 20 * 1024 * 1024;
const POLL_TIMEOUT_MS = 120_000;

// flux-schnell kennt kein 4:3 / 3:4, daher die nächstliegenden Formate.
const ASPECT_MAP: Record<Aspect, string> = { "1:1": "1:1", "16:9": "16:9", "9:16": "9:16", "4:3": "5:4", "3:4": "4:5" };

const checkRateLimit = createLimiter("REPLICATE_MAX_PER_HOUR", 30);

const base = () => (process.env.REPLICATE_API_BASE || "https://api.replicate.com").replace(/\/$/, "");

function assertAllowedUrl(raw: string, what: string): URL {
  const u = new URL(raw);
  const apiHost = new URL(base()).hostname;
  const h = u.hostname;
  const replicateHost =
    h === "replicate.delivery" || h.endsWith(".replicate.delivery") || h === "replicate.com" || h.endsWith(".replicate.com");
  if (!(h === apiHost || (u.protocol === "https:" && replicateHost))) {
    throw new Error(`Unerwartete ${what}-URL von Replicate`);
  }
  return u;
}

export const replicateProvider: Provider = {
  name: "replicate",
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN fehlt");
    const model = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell";
    if (!MODEL_RE.test(model)) throw new Error("REPLICATE_IMAGE_MODEL muss die Form owner/name haben");
    checkRateLimit();

    const auth = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${base()}/v1/models/${model}/predictions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({
        input: { prompt: req.prompt, aspect_ratio: ASPECT_MAP[req.aspect], num_outputs: 1, output_format: "png" },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Replicate HTTP ${res.status}: ${String(body.detail ?? body.title ?? "Fehler").slice(0, 200)}`);
    }

    let pred = await res.json();
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (pred.status === "starting" || pred.status === "processing") {
      if (Date.now() > deadline) throw new Error("Replicate: Zeitüberschreitung");
      await new Promise((r) => setTimeout(r, 2000));
      const getUrl = assertAllowedUrl(pred.urls?.get, "Status");
      if (getUrl.origin !== new URL(base()).origin) throw new Error("Unerwartete Status-URL von Replicate");
      const r = await fetch(getUrl, { headers: auth });
      if (!r.ok) throw new Error(`Replicate Status HTTP ${r.status}`);
      pred = await r.json();
    }
    if (pred.status !== "succeeded") throw new Error(`Replicate: ${String(pred.error ?? pred.status).slice(0, 200)}`);

    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (typeof out !== "string") throw new Error("Replicate lieferte kein Bild");
    const imgRes = await fetch(assertAllowedUrl(out, "Bild"));
    if (!imgRes.ok) throw new Error(`Bild-Download fehlgeschlagen (HTTP ${imgRes.status})`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("Bild zu groß");

    const id = await saveImage(buf);
    return { id, url: `/api/media/${id}`, model };
  },
};
