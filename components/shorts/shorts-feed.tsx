"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Hls from "hls.js";
import { createComment, toggleBookmark, toggleLike } from "@/app/c/[id]/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShortPost = {
  bookmarkCount: number;
  commentCount: number;
  comments: {
    body: string;
    createdAt: string;
    id: string;
    user: {
      avatarUrl: string | null;
      displayName: string | null;
      image: string | null;
      name: string | null;
      username: string | null;
    };
  }[];
  description: string;
  durationSeconds: number | null;
  game: {
    name: string;
    slug: string;
  };
  isBookmarked: boolean;
  isLiked: boolean;
  likeCount: number;
  mediaUrl: string;
  publicId: string;
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
  thumbnailUrl: string;
  title: string;
  user: {
    avatarUrl: string | null;
    displayName: string | null;
    image: string | null;
    name: string | null;
    username: string | null;
  };
  viewCount: number;
};

type ShortsFeedProps = {
  isLoggedIn: boolean;
  posts: ShortPost[];
};

export function ShortsFeed({ isLoggedIn, posts }: ShortsFeedProps) {
  const [activePostId, setActivePostId] = useState(posts[0]?.publicId ?? null);
  const [detailsPostId, setDetailsPostId] = useState<string | null>(null);
  const activePost = useMemo(() => posts.find((post) => post.publicId === activePostId) ?? posts[0], [activePostId, posts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const publicId = visible?.target.getAttribute("data-public-id");
        if (publicId) {
          setActivePostId(publicId);
        }
      },
      {
        root: null,
        threshold: [0.55, 0.75],
      },
    );

    document.querySelectorAll("[data-short-item='true']").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [posts.length]);

  if (posts.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-4 py-12">
        <section className="rounded-md border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold">動画はまだありません</h1>
          <p className="mt-2 text-sm text-muted-foreground">公開済みの動画投稿が表示されます。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="h-[calc(100dvh-4rem)] overflow-hidden bg-background text-foreground">
      <div className="grid h-full lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain">
          {posts.map((post) => (
            <article
              className="grid h-full min-h-full snap-start place-items-center px-3 py-4 sm:px-6 lg:px-8"
              data-public-id={post.publicId}
              data-short-item="true"
              key={post.publicId}
            >
              <div className="relative h-full max-h-[calc(100dvh-6rem)] w-full max-w-[min(100%,520px)] overflow-hidden rounded-md border border-border bg-black shadow-2xl">
                <ShortVideo isActive={activePostId === post.publicId} poster={post.thumbnailUrl} src={post.mediaUrl} title={post.title} />
                <MobileSummary isLoggedIn={isLoggedIn} onOpenDetails={() => setDetailsPostId(post.publicId)} post={post} />
              </div>
            </article>
          ))}
        </section>

        <aside className="hidden h-full overflow-y-auto border-l border-border bg-card lg:block">
          {activePost ? <ShortDetails isLoggedIn={isLoggedIn} post={activePost} /> : null}
        </aside>
      </div>

      {detailsPostId ? (
        <div className="fixed inset-0 z-50 bg-black/55 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 cursor-default" onClick={() => setDetailsPostId(null)} type="button" />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-md border border-border bg-card">
            <div className="sticky top-0 z-10 flex justify-end border-b border-border bg-card p-2">
              <Button className="size-9 px-0" onClick={() => setDetailsPostId(null)} type="button" variant="ghost">
                <X size={18} />
                <span className="sr-only">閉じる</span>
              </Button>
            </div>
            <ShortDetails isLoggedIn={isLoggedIn} post={posts.find((post) => post.publicId === detailsPostId) ?? posts[0]} />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ShortVideo({ isActive, poster, src, title }: { isActive: boolean; poster: string; src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (!Hls.isSupported()) {
      return;
    }

    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(video);

    return () => hls.destroy();
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = isMuted;
    if (isActive) {
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
  }, [isActive, isMuted]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  return (
    <div className="relative h-full w-full">
      <button aria-label={isPlaying ? "一時停止" : "再生"} className="absolute inset-0 z-10" onClick={() => void togglePlay()} type="button" />
      <video
        className="h-full w-full bg-black object-contain"
        loop
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
        poster={poster}
        preload="metadata"
        ref={videoRef}
        title={title}
      />
      {!isPlaying ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid size-16 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            <Play className="ml-1" size={28} />
          </div>
        </div>
      ) : null}
      <button
        aria-label={isMuted ? "ミュート解除" : "ミュート"}
        className="absolute right-3 top-3 z-20 grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/75"
        onClick={() => setIsMuted((current) => !current)}
        type="button"
      >
        {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
      <div className="absolute left-3 top-3 z-20 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        {isPlaying ? <Pause className="mr-1 inline" size={13} /> : <Play className="mr-1 inline" size={13} />}
        {isPlaying ? "再生中" : "停止中"}
      </div>
    </div>
  );
}

function MobileSummary({ isLoggedIn, onOpenDetails, post }: { isLoggedIn: boolean; onOpenDetails: () => void; post: ShortPost }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/70 to-transparent p-4 text-white lg:hidden">
      <Link className="text-xs font-semibold text-white/80" href={`/games/${post.game.slug}`}>
        {post.game.name}
      </Link>
      <h1 className="mt-1 line-clamp-2 text-lg font-bold">{post.title}</h1>
      <p className="mt-1 line-clamp-2 text-xs text-white/75">{post.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <LikeForm isLoggedIn={isLoggedIn} post={post} />
        <Button className="h-9 rounded-full bg-white/15 px-3 text-white hover:bg-white/25" onClick={onOpenDetails} type="button" variant="ghost">
          <MessageCircle size={16} />
          詳細を見る
        </Button>
      </div>
    </div>
  );
}

function ShortDetails({ isLoggedIn, post }: { isLoggedIn: boolean; post: ShortPost }) {
  const displayName = post.user.displayName ?? post.user.name ?? post.user.username ?? "Unknown";

  return (
    <section className="space-y-5 p-4">
      <div>
        <Link className="text-sm font-semibold text-primary" href={`/games/${post.game.slug}`}>
          {post.game.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{post.description}</p>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <p className="text-xs text-muted-foreground">投稿者</p>
        {post.user.username ? (
          <Link className="mt-1 block font-semibold hover:text-primary" href={`/users/${post.user.username}`}>
            {displayName}
          </Link>
        ) : (
          <p className="mt-1 font-semibold">{displayName}</p>
        )}
      </div>

      {post.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Link className="rounded-md border border-border bg-muted px-3 py-1 text-sm transition hover:border-primary hover:text-primary" href={`/tags/${tag.slug}`} key={tag.id}>
              #{tag.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-2 text-center text-sm">
        <Stat label="再生" value={post.viewCount} />
        <Stat label="いいね" value={post.likeCount} />
        <Stat label="コメント" value={post.commentCount} />
        <Stat label="保存" value={post.bookmarkCount} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LikeForm isLoggedIn={isLoggedIn} post={post} />
        <BookmarkForm isLoggedIn={isLoggedIn} post={post} />
      </div>

      <section className="rounded-md border border-border bg-background p-3">
        <h2 className="font-semibold">コメント</h2>
        {isLoggedIn ? (
          <form action={createComment} className="mt-3 grid gap-2">
            <input name="publicId" type="hidden" value={post.publicId} />
            <textarea
              className="min-h-20 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              maxLength={1000}
              name="body"
              placeholder="コメントを書く"
              required
            />
            <Button type="submit">
              <MessageCircle size={16} />
              コメントする
            </Button>
          </form>
        ) : (
          <Button asChild className="mt-3 w-full">
            <Link href="/login">ログインしてコメント</Link>
          </Button>
        )}

        <div className="mt-4 space-y-3">
          {post.comments.length > 0 ? (
            post.comments.map((comment) => {
              const commentUserName = comment.user.displayName ?? comment.user.name ?? comment.user.username ?? "Unknown";
              return (
                <article className="rounded-md border border-border bg-card p-3" key={comment.id}>
                  <p className="text-sm font-semibold">{commentUserName}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                </article>
              );
            })
          ) : (
            <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">まだコメントはありません。</p>
          )}
        </div>
      </section>
    </section>
  );
}

function LikeForm({ isLoggedIn, post }: { isLoggedIn: boolean; post: ShortPost }) {
  const [isPending, startTransition] = useTransition();

  if (!isLoggedIn) {
    return (
      <Button asChild className="w-full rounded-full">
        <Link href="/login">
          <Heart size={16} />
          いいね
        </Link>
      </Button>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          void toggleLike(formData);
        });
      }}
    >
      <input name="publicId" type="hidden" value={post.publicId} />
      <Button className={cn("w-full rounded-full", post.isLiked ? "bg-secondary text-secondary-foreground" : null)} disabled={isPending} type="submit">
        <Heart size={16} />
        {post.isLiked ? "いいね済み" : "いいね"}
      </Button>
    </form>
  );
}

function BookmarkForm({ isLoggedIn, post }: { isLoggedIn: boolean; post: ShortPost }) {
  if (!isLoggedIn) {
    return (
      <Button asChild className="w-full" variant="outline">
        <Link href="/login">
          <Bookmark size={16} />
          保存
        </Link>
      </Button>
    );
  }

  return (
    <form action={toggleBookmark}>
      <input name="publicId" type="hidden" value={post.publicId} />
      <Button className="w-full" type="submit" variant={post.isBookmarked ? "secondary" : "outline"}>
        <Bookmark size={16} />
        {post.isBookmarked ? "保存済み" : "保存"}
      </Button>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
