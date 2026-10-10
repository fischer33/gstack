export type MediaType = "image" | "video";
export type Aspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface MediaItem {
  id: string;
  type: MediaType;
  prompt: string;
  model: string;
  aspect: Aspect;
  duration?: number; // Sekunden, nur Video
  url: string;
  provider?: string; // "mock" | "replicate"
  source: "ui" | "claude";
  createdAt: string;
}

export const ASPECT_SIZE: Record<Aspect, [number, number]> = {
  "1:1": [768, 768],
  "16:9": [960, 540],
  "9:16": [540, 960],
  "4:3": [800, 600],
  "3:4": [600, 800],
};

export const CREDIT_COST: Record<MediaType, number> = { image: 2, video: 10 };
