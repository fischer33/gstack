import { promises as fs } from "fs";
import path from "path";

export const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

// Dateityp an den ersten Bytes erkennen, nicht am (oft falschen) Content-Type der Quelle.
function detectExt(buf: Buffer): keyof typeof TYPES {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return "png";
}

export async function saveImage(buf: Buffer): Promise<string> {
  const id = crypto.randomUUID();
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, `${id}.${detectExt(buf)}`), buf);
  return id;
}

// Die UUID-Prüfung verhindert Pfad-Tricks wie "../".
export async function findImage(id: string): Promise<{ buf: Buffer; type: string } | null> {
  if (!UUID.test(id)) return null;
  for (const [ext, type] of Object.entries(TYPES)) {
    try {
      return { buf: await fs.readFile(path.join(MEDIA_DIR, `${id}.${ext}`)), type };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return null;
}
