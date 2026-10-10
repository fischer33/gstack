import { ASPECT_SIZE, type Aspect, type MediaType } from "../types";
import { localProvider } from "./local";
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

// PROVIDER=local     -> Bilder lokal per mflux (kostenlos, nichts verlässt den Rechner)
// PROVIDER=replicate -> Bilder über Replicate (kostenpflichtig, braucht REPLICATE_API_TOKEN)
// PROVIDER=mock      -> Platzhalter
// Ohne PROVIDER: Replicate, falls ein Token gesetzt ist, sonst Mock. Videos laufen immer über den Mock.
export function getProvider(type: MediaType): Provider {
  if (type !== "image") return mockProvider;
  const choice = process.env.PROVIDER;
  if (choice === "local") return localProvider;
  if (choice === "mock") return mockProvider;
  if (process.env.REPLICATE_API_TOKEN) return replicateProvider;
  return mockProvider;
}
