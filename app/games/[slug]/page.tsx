import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink, Gamepad2, Layers } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type GamePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

async function getGame(slug: string) {
  return prisma.game.findUnique({
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
      posts: {
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isNsfw: false,
        },
        include: {
          game: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 24,
      },
    },
  });
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getGame(slug);

  if (!game) {
    return {
      title: "ゲームが見つかりません",
    };
  }

  const description = game.summary?.slice(0, 160) ?? `${game.name}のクリップとスクリーンショット一覧です。`;
  const image = game.heroUrl ?? game.coverUrl ?? "/images/og-default.svg";

  return {
    title: `${game.name}の投稿`,
    description,
    openGraph: {
      title: `${game.name}の投稿`,
      description,
      type: "website",
      url: `/games/${game.slug}`,
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
  const heroImage = game.heroUrl ?? game.coverUrl;

  return (
    <main>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[220px_1fr]">
          <div
            className="aspect-[3/4] rounded-md border border-border bg-muted bg-cover bg-center"
            style={heroImage ? { backgroundImage: `url("${heroImage}")` } : undefined}
          >
            {!heroImage ? (
              <div className="grid h-full place-items-center text-muted-foreground">
                <Gamepad2 size={44} />
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col justify-end">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-background px-2 py-1">投稿 {game._count.posts}</span>
              {releaseDate ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
                  <Calendar size={14} />
                  {releaseDate}
                </span>
              ) : null}
              {game.igdbId ? <span className="rounded-md border border-border bg-background px-2 py-1">IGDB #{game.igdbId}</span> : null}
              {game.steamAppId ? (
                <span className="rounded-md border border-border bg-background px-2 py-1">Steam {game.steamAppId}</span>
              ) : null}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-normal sm:text-5xl">{game.name}</h1>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
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

            {game.officialUrl ? (
              <Link
                className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
                href={game.officialUrl}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} />
                公式・外部ページ
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">最新投稿</h2>
            <p className="mt-1 text-sm text-muted-foreground">このゲームに紐づく公開投稿を新着順で表示します。</p>
          </div>
          <Link className="text-sm font-medium text-primary hover:text-primary/80" href={`/search?q=game:${encodeURIComponent(game.name)}`}>
            検索で見る
          </Link>
        </div>

        {game.posts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {game.posts.map((post) => (
              <PostCard
                bookmarkCount={Number(post.bookmarkCount)}
                commentCount={Number(post.commentCount)}
                gameName={post.game.name}
                gameSlug={post.game.slug}
                isNsfw={post.isNsfw}
                key={post.id}
                likeCount={Number(post.likeCount)}
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
    </main>
  );
}
