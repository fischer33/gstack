import { ASPECT_SIZE, type Aspect, type MediaType } from "../types";

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

export function getProvider(): Provider {
  // Erweiterungspunkt: process.env.PROVIDER auswerten und echten Provider zurückgeben.
  return mockProvider;
}
