"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/posts/post-card";
import { PostTile } from "@/components/posts/post-tile";
import type { TimelinePost, TimelineSort } from "@/lib/timeline/posts";

type TimelineFeedProps = {
  initialPosts: TimelinePost[];
  initialHasMore: boolean;
  initialNextOffset: number;
  sort: TimelineSort;
  view: "card" | "tile";
};

type TimelineResponse = {
  posts: TimelinePost[];
  hasMore: boolean;
  nextOffset: number;
};

export function TimelineFeed({ initialPosts, initialHasMore, initialNextOffset, sort, view }: TimelineFeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sort,
        offset: String(nextOffset),
      });
      const response = await fetch(`/api/timeline?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      const data = (await response.json()) as TimelineResponse;
      setPosts((current) => [...current, ...data.posts]);
      setHasMore(data.hasMore);
      setNextOffset(data.nextOffset);
    } catch {
      setError("追加読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, nextOffset, sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (posts.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">まだ公開投稿はありません</h2>
        <p className="mt-2 text-sm text-muted-foreground">最初のクリップやスクリーンショットを投稿できます。</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {view === "tile" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {posts.map((post) => (
            <PostTile
              gameName={post.game.name}
              isNsfw={post.isNsfw}
              key={post.id}
              mediaCount={post.mediaCount}
              publicId={post.publicId}
              thumbnailUrl={post.thumbnailUrl}
              title={post.title}
              type={post.type}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {posts.map((post) => (
            <PostCard
              bookmarkCount={post.bookmarkCount}
              commentCount={post.commentCount}
              gameName={post.game.name}
              gameSlug={post.game.slug}
              isNsfw={post.isNsfw}
              key={post.id}
              likeCount={post.likeCount}
              mediaCount={post.mediaCount}
              publicId={post.publicId}
              thumbnailUrl={post.thumbnailUrl}
              title={post.title}
              type={post.type}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={18} />
          読み込み中
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center justify-center gap-3 rounded-md border border-destructive/50 bg-card p-4 text-sm">
          <span className="text-destructive">{error}</span>
          <button className="font-bold text-primary hover:text-primary/80" onClick={() => void loadMore()} type="button">
            再試行
          </button>
        </div>
      ) : null}

      {!hasMore && !isLoading ? (
        <div className="rounded-md border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          すべての投稿を表示しました。
        </div>
      ) : null}
    </div>
  );
}
