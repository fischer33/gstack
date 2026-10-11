import { promises as fs } from "fs";
import path from "path";

export const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", mp4: "video/mp4" };

// Bildformat an den ersten Bytes erkennen, nicht am (oft falschen) Content-Type der Quelle.
export function detectImageExt(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

export async function saveImage(buf: Buffer): Promise<string> {
  const id = crypto.randomUUID();
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  // Quellen liefern gelegentlich Formate ohne klare Signatur; dann als PNG ablegen (Browser erkennen am Inhalt).
  await fs.writeFile(path.join(MEDIA_DIR, `${id}.${detectImageExt(buf) ?? "png"}`), buf);
  return id;
}

export const videoPath = (id: string) => path.join(MEDIA_DIR, `${id}.mp4`);

export interface MediaFile {
  file: string;
  type: string;
  isImage: boolean;
}

// Die UUID-Prüfung verhindert Pfad-Tricks wie "../".
export async function findMediaFile(id: string): Promise<MediaFile | null> {
  if (!UUID.test(id)) return null;
  for (const [ext, type] of Object.entries(TYPES)) {
    const file = path.join(MEDIA_DIR, `${id}.${ext}`);
    try {
      await fs.access(file);
      return { file, type, isImage: ext !== "mp4" };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return null;
}

export async function findImage(id: string): Promise<{ buf: Buffer; type: string } | null> {
  const m = await findMediaFile(id);
  if (!m) return null;
  return { buf: await fs.readFile(m.file), type: m.type };
}
