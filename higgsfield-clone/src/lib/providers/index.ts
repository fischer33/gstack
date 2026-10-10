import { ASPECT_SIZE, type Aspect, type MediaType } from "../types";
import { replicateProvider } from "./replicate";

export interface GenerateRequest {
  type: MediaType;
  prompt: string;
  model: string;
  aspect: Aspect;
  duration?: number;
}

export interface GenerateResult {
  id: string;
  url: string;
  model?: string; // tatsächlich genutztes Modell (überschreibt die Anfrage)
}

// Provider-Schnittstelle: Hier kann später eine echte Bild-/Video-API angebunden werden
// (Request an den Anbieter senden, Ergebnis-URL zurückgeben). Standard ist der Mock.
export interface Provider {
  name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export const mockProvider: Provider = {
  name: "mock",
  async generate(req) {
    await new Promise((r) => setTimeout(r, 1200)); // simulierte Rechenzeit
    const id = crypto.randomUUID();
    const [w, h] = ASPECT_SIZE[req.aspect];
    const q = new URLSearchParams({
      w: String(w),
      h: String(h),
      v: req.type === "video" ? "1" : "0",
      p: req.prompt.slice(0, 70),
    });
    return { id, url: `/api/media/${id}?${q}` };
  },
};

// Bilder gehen an Replicate, sobald REPLICATE_API_TOKEN gesetzt ist (PROVIDER=mock erzwingt den Mock).
// Videos laufen weiterhin über den Mock.
export function getProvider(type: MediaType): Provider {
  if (type === "image" && process.env.REPLICATE_API_TOKEN && process.env.PROVIDER !== "mock") {
    return replicateProvider;
  }
  return mockProvider;
}
