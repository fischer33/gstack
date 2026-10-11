import { InferenceClient } from "@huggingface/inference";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { saveImage } from "../media-store";
import { createLimiter } from "./rate-limit";
import type { GenerateRequest, GenerateResult, Provider } from "./index";

const checkLimit = createLimiter("HF_MAX_PER_HOUR", 30);
const MODEL_RE = /^[\w.-]+\/[\w.-]+$/;
const PROVIDER_RE = /^[a-z0-9-]+$/;
const MAX_BYTES = 20 * 1024 * 1024;

// Token aus HF_TOKEN oder aus der Datei, die `hf auth login` bzw. unsere Anleitung anlegt.
async function readToken(): Promise<string> {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN.trim();
  const file = path.join(process.env.HF_HOME || path.join(os.homedir(), ".cache", "huggingface"), "token");
  try {
    return (await fs.readFile(file, "utf8")).trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    throw new Error("Kein Hugging-Face-Token gefunden (HF_TOKEN in .env.local oder ~/.cache/huggingface/token)");
  }
}

// Bilder über Hugging Face Inference Providers (Standard: nscale + FLUX.1-schnell).
// Die Berechnung läuft beim Anbieter, es ist kein lokaler Modell-Download nötig.
export const huggingfaceProvider: Provider = {
  name: "huggingface",
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const token = await readToken();
    const model = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
    const provider = process.env.HF_PROVIDER || "nscale";
    if (!MODEL_RE.test(model)) throw new Error("HF_IMAGE_MODEL muss die Form owner/name haben");
    if (!PROVIDER_RE.test(provider)) throw new Error("HF_PROVIDER enthält ungültige Zeichen");
    checkLimit();

    const client = new InferenceClient(token);
    // Das Seitenverhältnis wird bewusst nicht gesendet: Welche Größen der Anbieter akzeptiert, ist nicht
    // geprüft, und eine abgelehnte Größe würde jede Generierung scheitern lassen. Optional: HF_IMAGE_SIZE.
    const size = process.env.HF_IMAGE_SIZE;
    let blob: Blob;
    try {
      blob = await client.textToImage(
        {
          provider: provider as never,
          model,
          inputs: req.prompt,
          ...(size ? { parameters: { size } as never } : {}),
        },
        { outputType: "blob" },
      );
    } catch (err) {
      // Falls ein Fehlertext den Token enthält, wird er vor der Ausgabe geschwärzt.
      throw new Error(`Hugging Face: ${String((err as Error).message).replace(token, "***").slice(0, 300)}`);
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("Bild zu groß");
    const id = await saveImage(buf);
    return { id, url: `/api/media/${id}`, model: `${model} (${provider})` };
  },
};
