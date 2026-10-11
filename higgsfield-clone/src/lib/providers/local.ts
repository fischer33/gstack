import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { MEDIA_DIR } from "../media-store";
import type { Aspect } from "../types";
import type { GenerateRequest, GenerateResult, Provider } from "./index";

// Verhältnis Breite:Höhe je Seitenverhältnis
const RATIO: Record<Aspect, [number, number]> = { "1:1": [1, 1], "16:9": [16, 9], "9:16": [9, 16], "4:3": [4, 3], "3:4": [3, 4] };

// Flux erwartet Vielfache von 16. longSide steuert Qualität gegen Geschwindigkeit/RAM.
export function dimensions(aspect: Aspect, longSide: number): [number, number] {
  const [rw, rh] = RATIO[aspect];
  const snap = (v: number) => Math.max(256, Math.round(v / 16) * 16);
  return rw >= rh ? [snap(longSide), snap((longSide * rh) / rw)] : [snap((longSide * rw) / rh), snap(longSide)];
}

// Ein Job nach dem anderen: Flux belegt mehrere GB RAM, parallele Läufe würden den Mac in die Knie zwingen.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

const intEnv = (name: string, def: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};

export const localProvider: Provider = {
  name: "local",
  generate(req: GenerateRequest): Promise<GenerateResult> {
    return enqueue(async () => {
      const cmd = process.env.LOCAL_IMAGE_CMD || "mflux-generate";
      const model = process.env.LOCAL_IMAGE_MODEL || "schnell";
      if (!/^[\w.-]+$/.test(model)) throw new Error("LOCAL_IMAGE_MODEL enthält ungültige Zeichen");
      const [w, h] = dimensions(req.aspect, intEnv("LOCAL_IMAGE_LONG_SIDE", 768));
      const id = crypto.randomUUID();
      const out = path.join(MEDIA_DIR, `${id}.png`);
      await fs.mkdir(MEDIA_DIR, { recursive: true });

      // execFile ohne Shell + "--option=wert": der Prompt kann weder Befehle einschleusen
      // noch als eigene Option gelesen werden (z. B. wenn er mit "-" beginnt).
      const args = [
        `--model=${model}`,
        `--prompt=${req.prompt}`,
        `--steps=${intEnv("LOCAL_IMAGE_STEPS", 4)}`,
        `--seed=${Math.floor(Math.random() * 2 ** 31)}`,
        `--width=${w}`,
        `--height=${h}`,
        `--quantize=${intEnv("LOCAL_IMAGE_QUANTIZE", 4)}`,
        `--output=${out}`,
      ];
      const timeoutMs = intEnv("LOCAL_TIMEOUT_SEC", 900) * 1000; // erster Lauf lädt das Modell (mehrere GB)

      await new Promise<void>((resolve, reject) => {
        execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024 }, (err, _stdout, stderr) => {
          if (!err) return resolve();
          const e = err as NodeJS.ErrnoException & { killed?: boolean };
          if (e.code === "ENOENT") {
            return reject(new Error(`"${cmd}" nicht gefunden. Installation: brew install uv && uv tool install --upgrade mflux`));
          }
          if (e.killed) return reject(new Error(`Lokale Generierung nach ${timeoutMs / 1000}s abgebrochen (LOCAL_TIMEOUT_SEC)`));
          reject(new Error(`mflux-Fehler: ${String(stderr || e.message).trim().slice(-300)}`));
        });
      });

      try {
        await fs.access(out);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        throw new Error("mflux lief ohne Fehler, hat aber keine Bilddatei geschrieben");
      }
      return { id, url: `/api/media/${id}`, model: `${model} (lokal, mflux)` };
    });
  },
};
