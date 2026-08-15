import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink, Gamepad2, Layers, Star, Tags, TrendingUp, UsersRound } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type GamePost = Awaited<ReturnType<typeof getGame>> extends infer T
  ? T extends { recentPosts: Array<infer P> }
    ? P
    : never
  : never;

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

function formatReleaseDate(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function publicPostWhere(gameId: string) {
  return {
    gameId,
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    isNsfw: false,
  };
}

async function getGame(slug: string) {
  const game = await prisma.game.findUnique({
    where: {
      slug,
      isActive: true,
    },
    include: {
      _count: {
        select: {
          posts: {
            where: {
              status: "PUBLISHED",
              visibility: "PUBLIC",
              isNsfw: false,
            },
          },
        },
      },
    },
  });

  if (!game) {
    return null;
  }

  const [recentPosts, popularPosts, tagRows, contributors] = await Promise.all([
    prisma.post.findMany({
      where: publicPostWhere(game.id),
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
      take: 12,
    }),
    prisma.post.findMany({
      where: publicPostWhere(game.id),
      include: {
        game: true,
        _count: {
          select: {
            mediaItems: true,
          },
        },
      },
      orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }, { viewCount: "desc" }, { publishedAt: "desc" }],
      take: 6,
    }),
    prisma.postTag.findMany({
      where: {
        post: publicPostWhere(game.id),
      },
      include: {
        tag: true,
      },
      take: 500,
    }),
    prisma.user.findMany({
      where: {
        isBanned: false,
        posts: {
          some: publicPostWhere(game.id),
        },
      },
      include: {
        _count: {
          select: {
            posts: {
              where: publicPostWhere(game.id),
            },
          },
        },
      },
      orderBy: [{ posts: { _count: "desc" } }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);

  const tagCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const row of tagRows) {
    const current = tagCounts.get(row.tag.slug);
    tagCounts.set(row.tag.slug, {
      name: row.tag.name,
      slug: row.tag.slug,
      count: (current?.count ?? 0) + 1,
    });
  }

  return {
    ...game,
    recentPosts,
    popularPosts,
    topTags: Array.from(tagCounts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 12),
    contributors,
  };
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGame(slug);

  if (!game) {
    return {
      title: "ゲームが見つかりません",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = game.summary?.slice(0, 160) ?? `${game.name}のクリップとスクリーンショット一覧です。`;
  const image = absoluteUrl(
    game.heroUrl ?? game.steamHeaderUrl ?? game.rawgBackgroundUrl ?? game.coverUrl ?? game.steamCapsuleUrl ?? "/images/og-default.svg",
  );
  const pageUrl = absoluteUrl(`/games/${game.slug}`);

  return {
    title: `${game.name}の投稿`,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${game.name}の投稿`,
      description,
      type: "website",
      url: pageUrl,
      images: [
        {
          url: image,
          width: 1280,
          height: 720,
          alt: game.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${game.name}の投稿`,
      description,
      images: [image],
    },
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const game = await getGame(slug);

  if (!game) {
    notFound();
  }

  const genres = jsonStringArray(game.genres);
  const platforms = jsonStringArray(game.platforms);
  const releaseDate = formatReleaseDate(game.releaseDate);
  const heroImage = game.heroUrl ?? game.steamHeaderUrl ?? game.rawgBackgroundUrl ?? game.coverUrl ?? game.steamCapsuleUrl;
  const coverImage = game.coverUrl ?? game.steamCapsuleUrl ?? game.heroUrl ?? game.steamHeaderUrl ?? game.rawgBackgroundUrl;
  const steamUrl = game.steamAppId ? `https://store.steampowered.com/app/${game.steamAppId}` : null;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-border bg-card">
        {heroImage ? (
          <div className="absolute inset-0 opacity-35">
            <Image alt="" className="object-cover" fill priority sizes="100vw" src={heroImage} />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/65 to-background" />
          </div>
        ) : null}

        <div className="relative px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted">
              {coverImage ? (
                <Image alt="" className="object-cover" fill priority sizes="240px" src={coverImage} />
              ) : (
                <div className="grid h-full place-items-center text-muted-foreground">
                  <Gamepad2 size={44} />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-end">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge>投稿 {game._count.posts}</Badge>
                {releaseDate ? (
                  <Badge>
                    <Calendar size={14} />
                    {releaseDate}
                  </Badge>
                ) : null}
                {game.metacriticScore ? (
                  <Badge>
                    <Star size={14} />
                    Metacritic {game.metacriticScore}
                  </Badge>
                ) : null}
                {game.igdbId ? <Badge>IGDB #{game.igdbId}</Badge> : null}
                {game.steamAppId ? <Badge>Steam {game.steamAppId}</Badge> : null}
                {game.rawgId ? <Badge>RAWG {game.rawgId}</Badge> : null}
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-normal sm:text-5xl">{game.name}</h1>
              <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {game.summary ?? "このゲームの概要はまだ登録されていません。"}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1 text-sm" key={genre}>
                    <Layers size={14} />
                    {genre}
                  </span>
                ))}
                {platforms.map((platform) => (
                  <span className="rounded-md bg-muted px-3 py-1 text-sm" key={platform}>
                    {platform}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {game.officialUrl ? <ExternalButton href={game.officialUrl} label="公式・外部ページ" /> : null}
                {steamUrl ? <ExternalButton href={steamUrl} label="Steamストア" /> : null}
                <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted" href={`/search?q=game:${encodeURIComponent(game.name)}`}>
                  投稿を検索
                </Link>
              </div>
            </div>

            <aside className="grid gap-3 self-end rounded-md border border-border bg-card/85 p-4 backdrop-blur">
              <Metric label="公開投稿" value={game._count.posts} />
              <Metric label="人気タグ" value={game.topTags.length} />
              <Metric label="投稿者" value={game.contributors.length} />
            </aside>
          </div>
        </div>
      </section>

      <div className="grid gap-8 px-4 py-8 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <PostSection
            description="いいね、コメント、再生数をもとに、このゲームで反応が多い投稿を表示します。"
            posts={game.popularPosts}
            prioritizeFirst
            title="人気投稿"
          />
          <PostSection description="このゲームに紐づく公開投稿を新着順で表示します。" posts={game.recentPosts} title="最近の投稿" />
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Tags size={18} />
              よく使われるタグ
            </h2>
            {game.topTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {game.topTags.map((tag) => (
                  <Link className="rounded-md bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground" href={`/search?q=tag:${encodeURIComponent(tag.name)} game:${encodeURIComponent(game.name)}`} key={tag.slug}>
                    #{tag.name} {tag.count}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">タグ付き投稿はまだありません。</p>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <UsersRound size={18} />
              投稿しているユーザー
            </h2>
            {game.contributors.length > 0 ? (
              <div className="mt-4 space-y-3">
                {game.contributors.map((user) => {
                  const name = user.displayName || user.name || user.username || "ユーザー";
                  return (
                    <Link className="flex items-center gap-3 rounded-md p-2 hover:bg-muted" href={user.username ? `/users/${user.username}` : "#"} key={user.id}>
                      <div className="relative size-10 overflow-hidden rounded-full bg-muted">
                        {user.avatarUrl || user.image ? <Image alt="" className="object-cover" fill sizes="40px" src={user.avatarUrl || user.image || ""} /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{name}</p>
                        <p className="text-xs text-muted-foreground">{user._count.posts}投稿</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">投稿者はまだいません。</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/85 px-2 py-1">{children}</span>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={href} rel="noreferrer" target="_blank">
      <ExternalLink size={16} />
      {label}
    </Link>
  );
}

function PostSection({
  description,
  posts,
  title,
  prioritizeFirst = false,
}: {
  description: string;
  posts: GamePost[];
  title: string;
  prioritizeFirst?: boolean;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            {title === "人気投稿" ? <TrendingUp size={24} /> : null}
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="post-card-grid">
          {posts.map((post, index) => (
            <PostCard
              bookmarkCount={Number(post.bookmarkCount)}
              commentCount={Number(post.commentCount)}
              gameName={post.game.name}
              gameSlug={post.game.slug}
              isNsfw={post.isNsfw}
              key={post.id}
              likeCount={Number(post.likeCount)}
              mediaCount={post._count.mediaItems || 1}
              priority={prioritizeFirst && index < 3}
              publicId={post.publicId}
              thumbnailUrl={post.thumbnailUrl}
              title={post.title}
              type={post.type}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          まだ公開投稿はありません。
        </div>
      )}
    </section>
  );
}
