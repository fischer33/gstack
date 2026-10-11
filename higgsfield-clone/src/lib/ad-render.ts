import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { MEDIA_DIR, videoPath } from "./media-store";

export const AD_FORMATS = { "9:16": [720, 1280], "1:1": [1080, 1080], "16:9": [1280, 720] } as const;
export type AdFormat = keyof typeof AD_FORMATS;
// cover: Bild füllt das Format (Ränder werden abgeschnitten). contain: ganzes Bild sichtbar, Rest = unscharfer Hintergrund.
export type AdFit = "cover" | "contain";

export interface AdSlide {
  imageFile: string; // Pfad zu einem Bild in MEDIA_DIR
  overlayPng: Buffer; // transparentes PNG in voller Videogröße mit Text
}

const FPS = 30;
const TIMEOUT_MS = 5 * 60 * 1000;

function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@ffmpeg-installer/ffmpeg").path as string;
}

// Ein Render nach dem anderen: ffmpeg belegt viel CPU.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
};

// Baut den Filtergraphen. Bewusst ohne `xfade` (fehlt in älteren ffmpeg-Versionen): Jede Folie
// bekommt einen Alpha-Einblendeffekt und wird zeitversetzt über die vorherige gelegt = echte Überblendung.
export function buildFilter(n: number, w: number, h: number, secs: number, fade: number, fit: AdFit = "cover"): string {
  const frames = Math.round(secs * FPS);
  const step = secs - fade;
  const total = n * secs - (n - 1) * fade;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const img = 2 * i;
    const txt = 2 * i + 1;
    // Zoom abwechselnd hinein und heraus; Bild vorher 2x vergrößern, damit der Zoom nicht ruckelt.
    const z = i % 2 === 0 ? `1+0.14*on/${frames}` : `1.14-0.14*on/${frames}`;
    const zoom = `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${w}x${h}:fps=${FPS},setsar=1`;
    if (fit === "contain") {
      const [qw, qh] = [Math.round(w / 4), Math.round(h / 4)];
      parts.push(
        `[${img}:v]split[bs${i}][fs${i}]`,
        `[bs${i}]scale=${qw}:${qh}:force_original_aspect_ratio=increase,crop=${qw}:${qh},boxblur=6:2,scale=${w * 2}:${h * 2}[bb${i}]`,
        `[fs${i}]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=decrease[ff${i}]`,
        `[bb${i}][ff${i}]overlay=(W-w)/2:(H-h)/2,${zoom}[z${i}]`,
      );
    } else {
      parts.push(`[${img}:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},${zoom}[z${i}]`);
    }
    parts.push(`[${txt}:v]scale=${w}:${h},format=rgba[t${i}]`);
    const fadeIn = i > 0 && fade > 0 ? `,fade=t=in:st=0:d=${fade}:alpha=1` : "";
    const shift = i > 0 ? `,setpts=PTS+${(i * step).toFixed(3)}/TB` : "";
    parts.push(`[z${i}][t${i}]overlay=0:0:format=auto,format=yuva420p${fadeIn}${shift}[s${i}]`);
  }
  parts.push(`color=c=black:s=${w}x${h}:r=${FPS}:d=${total.toFixed(3)},format=yuva420p[b0]`);
  for (let i = 0; i < n; i++) {
    parts.push(`[b${i}][s${i}]overlay=0:0:eof_action=pass:format=auto[b${i + 1}]`);
  }
  parts.push(`[b${n}]format=yuv420p[out]`);
  return parts.join(";");
}

export async function renderAd(opts: {
  slides: AdSlide[];
  format: AdFormat;
  secondsPerSlide: number;
  transition: number;
  fit?: AdFit;
}): Promise<{ id: string; seconds: number }> {
  return enqueue(async () => {
    const { slides, format, secondsPerSlide: secs, transition: fade } = opts;
    const [w, h] = AD_FORMATS[format];
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ad-"));
    const id = crypto.randomUUID();
    const out = videoPath(id);
    try {
      await fs.mkdir(MEDIA_DIR, { recursive: true });
      const args = ["-y", "-hide_banner", "-loglevel", "error"];
      for (let i = 0; i < slides.length; i++) {
        const overlay = path.join(tmp, `overlay${i}.png`);
        await fs.writeFile(overlay, slides[i].overlayPng);
        args.push("-i", slides[i].imageFile); // ein einzelnes Bild, zoompan erzeugt die Bilder
        args.push("-loop", "1", "-framerate", String(FPS), "-t", String(secs), "-i", overlay);
      }
      args.push("-filter_complex", buildFilter(slides.length, w, h, secs, fade, opts.fit), "-map", "[out]");
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out);

      await new Promise<void>((resolve, reject) => {
        execFile(ffmpegPath(), args, { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (err, _o, stderr) => {
          if (!err) return resolve();
          const e = err as NodeJS.ErrnoException & { killed?: boolean };
          if (e.code === "ENOENT") return reject(new Error("ffmpeg nicht gefunden (FFMPEG_PATH setzen oder `brew install ffmpeg`)"));
          if (e.killed) return reject(new Error("Rendern nach 5 Minuten abgebrochen"));
          reject(new Error(`ffmpeg-Fehler: ${String(stderr || e.message).trim().slice(-300)}`));
        });
      });
      const seconds = slides.length * secs - (slides.length - 1) * fade;
      return { id, seconds: Math.round(seconds * 10) / 10 };
    } catch (err) {
      await fs.rm(out, { force: true });
      throw err;
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
}
