import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";
import { parseSearchQuery } from "@/lib/search/parse-query";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 検索結果はクエリの組み合わせで無限に生成される薄いコンテンツになるため、
// インデックス対象から外す(Googleの内部検索結果ページに関するガイドライン準拠)。
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const parsed = parseSearchQuery(q);
  const [posts, topGames] = await Promise.all([q.trim() ? searchPosts(parsed) : Promise.resolve([]), getTopGames()]);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">検索</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          キーワードと検索演算子で投稿を探せます。結果は新着順で表示します。
        </p>
      </div>

      <form action="/search" className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          className="h-12 w-full rounded-md border border-input bg-background pl-11 pr-4 text-sm outline-none ring-ring transition focus:ring-2"
          defaultValue={q}
          name="q"
          placeholder="キーワード game:Valorant tag:ace from:username type:clip rank:Diamond server:サーバー名 nsfw:all"
          type="search"
        />
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">種別</span>
        <FilterChip active={!parsed.type} href={typeFilterHref(q, null)} label="すべて" />
        <FilterChip active={parsed.type === "CLIP"} href={typeFilterHref(q, "CLIP")} label="クリップ" />
        <FilterChip active={parsed.type === "SCREENSHOT"} href={typeFilterHref(q, "SCREENSHOT")} label="スクリーンショット" />
      </div>

      {topGames.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">ゲーム</span>
          {topGames.map((game) => (
            <FilterChip
              active={parsed.game?.toLowerCase() === game.name.toLowerCase()}
              href={gameFilterHref(q, parsed.game?.toLowerCase() === game.name.toLowerCase() ? null : game.name)}
              key={game.slug}
              label={game.name}
            />
          ))}
        </div>
      ) : null}

      <details className="mt-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">その他の検索演算子(タグ・投稿者・ランクなど)</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-md border border-border bg-card px-2 py-1">tag:ace</span>
          <span className="rounded-md border border-border bg-card px-2 py-1">from:username</span>
          <span className="rounded-md border border-border bg-card px-2 py-1">rank:Diamond</span>
          <span className="rounded-md border border-border bg-card px-2 py-1">server:サーバー名</span>
          <span className="rounded-md border border-border bg-card px-2 py-1">nsfw:all</span>
        </div>
      </details>

      <section className="mt-8">
        {q.trim() ? (
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">{posts.length}件の投稿</p>
            <p className="text-sm text-muted-foreground">新着順</p>
          </div>
        ) : null}

        {!q.trim() ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            検索キーワードを入力してください。
          </div>
        ) : posts.length > 0 ? (
          <div className="post-card-grid">
            {posts.map((post) => (
              <PostCard
                bookmarkCount={Number(post.bookmarkCount)}
                commentCount={Number(post.commentCount)}
                gameName={post.game.name}
                gameSlug={post.game.slug}
                isNsfw={post.isNsfw}
                key={post.id}
                likeCount={Number(post.likeCount)}
                mediaCount={post._count.mediaItems || 1}
                publicId={post.publicId}
                thumbnailUrl={post.thumbnailUrl}
                title={post.title}
                type={post.type}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            条件に一致する投稿はありません。
          </div>
        )}
      </section>
    </main>
  );
}

async function searchPosts(parsed: ReturnType<typeof parseSearchQuery>) {
  return prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      ...(parsed.nsfw === "only" ? { isNsfw: true } : parsed.nsfw === "include" ? {} : { isNsfw: false }),
      ...(parsed.type ? { type: parsed.type } : {}),
      ...(parsed.keyword
        ? {
            OR: [
              { title: { contains: parsed.keyword } },
              { description: { contains: parsed.keyword } },
              { game: { name: { contains: parsed.keyword } } },
              { user: { username: { contains: parsed.keyword } } },
              { tags: { some: { tag: { name: { contains: parsed.keyword } } } } },
            ],
          }
        : {}),
      ...(parsed.game
        ? {
            game: {
              OR: [{ name: { contains: parsed.game } }, { slug: { contains: parsed.game.toLowerCase() } }],
            },
          }
        : {}),
      ...(parsed.tag
        ? {
            tags: {
              some: {
                tag: {
                  OR: [{ name: { contains: parsed.tag } }, { slug: { contains: parsed.tag.toLowerCase() } }],
                },
              },
            },
          }
        : {}),
      ...(parsed.from
        ? {
            user: {
              username: {
                contains: parsed.from.toLowerCase(),
              },
            },
          }
        : {}),
      ...(parsed.rank
        ? {
            rankName: {
              contains: parsed.rank,
            },
          }
        : {}),
      ...(parsed.server
        ? {
            discordServerName: {
              contains: parsed.server,
            },
          }
        : {}),
    },
    include: {
      game: true,
      _count: {
        select: {
          mediaItems: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 60,
  });
}

async function getTopGames() {
  const games = await prisma.game.findMany({
    where: {
      isActive: true,
    },
    select: {
      name: true,
      slug: true,
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    take: 8,
  });

  return games;
}

function withOperator(input: string, key: string, value: string | null) {
  const pattern = new RegExp(`(?:^|\\s)${key}:(?:"[^"]*"|\\S+)`, "gi");
  const stripped = input.replace(pattern, " ").replace(/\s+/g, " ").trim();

  if (!value) {
    return stripped;
  }

  const token = /\s/.test(value) ? `${key}:"${value}"` : `${key}:${value}`;
  return stripped ? `${stripped} ${token}` : token;
}

function queryHref(nextQuery: string) {
  const params = new URLSearchParams();
  if (nextQuery) {
    params.set("q", nextQuery);
  }
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

function typeFilterHref(currentQuery: string, type: "CLIP" | "SCREENSHOT" | null) {
  const value = type === "CLIP" ? "clip" : type === "SCREENSHOT" ? "screenshot" : null;
  return queryHref(withOperator(currentQuery, "type", value));
}

function gameFilterHref(currentQuery: string, gameName: string | null) {
  return queryHref(withOperator(currentQuery, "game", gameName));
}

function FilterChip({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
      href={href}
    >
      {label}
    </Link>
  );
}
