import type { Aspect, MediaType } from "@/lib/types";

export interface FeedItem {
  id: string;
  title: string;
  author: string;
  type: MediaType;
  aspect: Aspect;
  category: string;
  likes: number;
}

export const CATEGORIES = ["Alle", "Portrait", "Cinematic", "Fashion", "Anime", "Product"];

const base: Omit<FeedItem, "id">[] = [
  { title: "Neon Rain Alley", author: "kira", type: "video", aspect: "16:9", category: "Cinematic", likes: 1280 },
  { title: "Golden Hour Portrait", author: "lenz", type: "image", aspect: "3:4", category: "Portrait", likes: 842 },
  { title: "Runway Chrome", author: "mara", type: "image", aspect: "9:16", category: "Fashion", likes: 2104 },
  { title: "Samurai Dawn", author: "ito", type: "video", aspect: "16:9", category: "Anime", likes: 960 },
  { title: "Perfume on Marble", author: "studio9", type: "image", aspect: "1:1", category: "Product", likes: 411 },
  { title: "Desert Chase", author: "kira", type: "video", aspect: "9:16", category: "Cinematic", likes: 3320 },
  { title: "Soft Light Closeup", author: "nova", type: "image", aspect: "4:3", category: "Portrait", likes: 677 },
  { title: "Street Couture", author: "mara", type: "image", aspect: "3:4", category: "Fashion", likes: 1509 },
  { title: "Spirit Forest", author: "ito", type: "image", aspect: "16:9", category: "Anime", likes: 733 },
  { title: "Sneaker Orbit", author: "studio9", type: "video", aspect: "1:1", category: "Product", likes: 1890 },
  { title: "Noir Detective", author: "lenz", type: "video", aspect: "4:3", category: "Cinematic", likes: 540 },
  { title: "Pastel Dreamer", author: "nova", type: "image", aspect: "9:16", category: "Fashion", likes: 998 },
  { title: "Cyber Ronin", author: "ito", type: "image", aspect: "3:4", category: "Anime", likes: 2210 },
  { title: "Watch Macro", author: "studio9", type: "image", aspect: "4:3", category: "Product", likes: 305 },
  { title: "Storm Over Tokyo", author: "kira", type: "video", aspect: "16:9", category: "Cinematic", likes: 4120 },
  { title: "Studio Gaze", author: "nova", type: "image", aspect: "1:1", category: "Portrait", likes: 1175 },
];

export const FEED: FeedItem[] = base.map((b, i) => ({ id: `feed-${i + 1}`, ...b }));

export const IMAGE_MODELS = ["Soul Mock", "Flux Mock", "Nano Mock"];
export const VIDEO_MODELS = ["Kling Mock", "Veo Mock", "Seedance Mock"];

export const EFFECTS = [
  "Dolly Zoom", "Crash Zoom", "Orbit 360", "Handheld Shake", "Bullet Time", "Rack Focus",
  "Whip Pan", "Drone Rise", "Glitch Cut", "Film Grain 35mm", "Neon Noir", "Vintage VHS",
].map((name, i) => ({ id: `fx-${i + 1}`, name, kind: i % 3 === 0 ? "Kamera" : i % 3 === 1 ? "Look" : "Effekt" }));

export const PLANS = [
  { name: "Free", price: "0 €", credits: 50, features: ["Standard-Modelle", "Wasserzeichen", "Community-Feed"] },
  { name: "Pro", price: "29 €", credits: 1200, features: ["Alle Modelle", "Kein Wasserzeichen", "Priorität in der Queue"], highlight: true },
  { name: "Studio", price: "99 €", credits: 5000, features: ["Team-Plätze", "API-Zugriff", "Commercial License"] },
];
