import Image from "next/image";
import Link from "next/link";
import { Camera, Clapperboard, Images } from "lucide-react";

type PostTileProps = {
  publicId: string;
  title: string;
  gameName: string;
  type: "CLIP" | "SCREENSHOT";
  thumbnailUrl: string;
  isNsfw: boolean;
  mediaCount?: number;
};

export function PostTile({ publicId, title, gameName, type, thumbnailUrl, isNsfw, mediaCount = 1 }: PostTileProps) {
  return (
    <Link className="group block overflow-hidden rounded-md border border-border bg-card" href={`/c/${publicId}`}>
      <article className="relative aspect-square bg-muted">
        <Image
          alt=""
          className={[
            "object-cover transition duration-300 group-hover:scale-105",
            isNsfw ? "blur-xl" : "",
          ].join(" ")}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
          src={thumbnailUrl}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 text-white">
          <p className="line-clamp-1 text-xs font-bold uppercase text-white/80">{gameName}</p>
          <h2 className="mt-1 line-clamp-2 text-sm font-bold">{title}</h2>
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-2 text-white drop-shadow">
          {type === "CLIP" ? <Clapperboard size={22} /> : <Camera size={22} />}
          {type === "SCREENSHOT" && mediaCount > 1 ? (
            <span className="inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs font-bold">
              <Images size={13} />
              {mediaCount}
            </span>
          ) : null}
        </div>
        {isNsfw ? (
          <span className="absolute left-2 top-2 rounded bg-destructive px-2 py-1 text-xs font-bold text-white">NSFW</span>
        ) : null}
      </article>
    </Link>
  );
}
