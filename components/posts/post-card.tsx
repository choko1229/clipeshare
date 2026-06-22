import Image from "next/image";
import Link from "next/link";
import { Bookmark, Camera, Clapperboard, Heart, MessageCircle } from "lucide-react";

type PostCardProps = {
  publicId: string;
  title: string;
  gameName: string;
  gameSlug: string;
  type: "CLIP" | "SCREENSHOT";
  thumbnailUrl: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isNsfw: boolean;
};

export function PostCard({
  publicId,
  title,
  gameName,
  gameSlug,
  type,
  thumbnailUrl,
  likeCount,
  commentCount,
  bookmarkCount,
  isNsfw,
}: PostCardProps) {
  return (
    <article className="overflow-hidden rounded-md border border-border bg-card">
      <Link className="block" href={`/c/${publicId}`}>
        <div className="relative aspect-video bg-muted">
          <Image alt="" className={isNsfw ? "object-cover blur-xl" : "object-cover"} fill src={thumbnailUrl} />
          <div className="absolute left-3 top-3 flex gap-2">
            <span className="rounded bg-black/55 px-2 py-1 text-xs font-bold text-white">{type}</span>
            {isNsfw ? <span className="rounded bg-destructive px-2 py-1 text-xs font-bold text-white">NSFW</span> : null}
          </div>
          <div className="absolute right-3 top-3 text-white/80">
            {type === "CLIP" ? <Clapperboard size={28} /> : <Camera size={28} />}
          </div>
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div>
          <Link className="text-xs font-medium uppercase text-primary hover:text-primary/80" href={`/games/${gameSlug}`}>
            {gameName}
          </Link>
          <Link href={`/c/${publicId}`}>
            <h2 className="mt-1 line-clamp-2 text-base font-semibold hover:text-primary">{title}</h2>
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart size={16} /> {likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={16} /> {commentCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bookmark size={16} /> {bookmarkCount}
          </span>
        </div>
      </div>
    </article>
  );
}
