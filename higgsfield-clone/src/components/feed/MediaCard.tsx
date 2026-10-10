"use client";
import { Heart, Play, Repeat2 } from "lucide-react";
import Link from "next/link";
import { ASPECT_SIZE, type Aspect, type MediaType } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  id: string;
  title: string;
  author?: string;
  type: MediaType;
  aspect: Aspect;
  likes?: number;
  src?: string; // wenn nicht gesetzt: Mock-Bild aus id
}

export function MediaCard({ id, title, author, type, aspect, likes = 0, src }: Props) {
  const { likes: liked, toggleLike } = useAppStore();
  const [w, h] = ASPECT_SIZE[aspect];
  const isLiked = liked.includes(id);
  const url = src ?? `/api/media/${id}?w=${w}&h=${h}&v=${type === "video" ? 1 : 0}`;

  return (
    <figure className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} loading="lazy" className="w-full" style={{ aspectRatio: `${w}/${h}` }} />
      {type === "video" && (
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <Play size={10} fill="currentColor" /> Video
        </span>
      )}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3 text-white opacity-0 transition group-hover:opacity-100">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {author && <p className="text-xs text-white/70">@{author}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/create?prompt=${encodeURIComponent(title)}&type=${type}`}
            aria-label="Remix"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <Repeat2 size={16} />
          </Link>
          <button
            onClick={() => toggleLike(id)}
            aria-label="Like"
            className="flex h-8 items-center gap-1 rounded-full bg-white/20 px-2 text-xs hover:bg-white/30"
          >
            <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : ""} />
            {likes + (isLiked ? 1 : 0)}
          </button>
        </div>
      </figcaption>
    </figure>
  );
}
