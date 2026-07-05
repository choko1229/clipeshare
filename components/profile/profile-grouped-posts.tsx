"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PostTile } from "@/components/posts/post-tile";

export type ProfileGroupedPost = {
  gameName: string;
  gameSlug: string;
  id: string;
  isNsfw: boolean;
  mediaCount: number;
  publicId: string;
  thumbnailUrl: string;
  title: string;
  type: "CLIP" | "SCREENSHOT";
};

type ProfileGroupedPostsProps = {
  posts: ProfileGroupedPost[];
};

const initialVisibleCount = 8;
const visibleStep = 8;

export function ProfileGroupedPosts({ posts }: ProfileGroupedPostsProps) {
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const groupedPosts = useMemo(() => {
    const groups = new Map<string, { gameName: string; gameSlug: string; posts: ProfileGroupedPost[] }>();

    for (const post of posts) {
      const group = groups.get(post.gameSlug) ?? {
        gameName: post.gameName,
        gameSlug: post.gameSlug,
        posts: [],
      };
      group.posts.push(post);
      groups.set(post.gameSlug, group);
    }

    return Array.from(groups.values());
  }, [posts]);

  return (
    <div className="space-y-6">
      {groupedPosts.map((group) => {
        const visibleCount = visibleCounts[group.gameSlug] ?? initialVisibleCount;
        const visiblePosts = group.posts.slice(0, visibleCount);
        const hasMore = visibleCount < group.posts.length;

        return (
          <section className="rounded-md border border-border bg-card p-4" key={group.gameSlug}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Link className="text-lg font-bold hover:text-primary" href={`/games/${group.gameSlug}`}>
                  {group.gameName}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{group.posts.length}件</p>
              </div>
            </div>
            <div className="mt-4 grid justify-between gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,160px),1fr))]">
              {visiblePosts.map((post) => (
                <PostTile
                  gameName={post.gameName}
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
            {hasMore ? (
              <button
                className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition hover:border-primary/60 hover:bg-muted"
                onClick={() =>
                  setVisibleCounts((current) => ({
                    ...current,
                    [group.gameSlug]: visibleCount + visibleStep,
                  }))
                }
                type="button"
              >
                追加を見る
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
