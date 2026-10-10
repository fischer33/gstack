import { promises as fs } from "fs";
import path from "path";
import type { MediaItem } from "./types";

// Einfacher JSON-Speicher (nur lokale Entwicklung, keine Concurrency-Garantien).
const FILE = path.join(process.cwd(), "data", "library.json");

export async function readLibrary(): Promise<MediaItem[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as MediaItem[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function addItem(item: MediaItem): Promise<void> {
  const all = await readLibrary();
  all.unshift(item);
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function deleteItem(id: string): Promise<void> {
  const all = (await readLibrary()).filter((i) => i.id !== id);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}
