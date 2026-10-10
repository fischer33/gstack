"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  theme: "dark" | "light";
  credits: number;
  likes: string[];
  toggleTheme: () => void;
  toggleLike: (id: string) => void;
  spend: (n: number) => boolean;
  refund: (n: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      credits: 150,
      likes: [],
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      toggleLike: (id) =>
        set({ likes: get().likes.includes(id) ? get().likes.filter((l) => l !== id) : [...get().likes, id] }),
      spend: (n) => {
        if (get().credits < n) return false;
        set({ credits: get().credits - n });
        return true;
      },
      refund: (n) => set({ credits: get().credits + n }),
    }),
    { name: "hf-clone" },
  ),
);
