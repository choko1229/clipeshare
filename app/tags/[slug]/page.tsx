import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Gamepad2, Hash } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const POSTS_TAKE = 60;

type TagPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

function publicPostWhere(tagId: string) {
  return {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    isNsfw: false,
    tags: {
      some: {
        tagId,
      },
    },
  };
}

async function getTag(slug: string) {
  const tag = await prisma.tag.findUnique({
    where: {
      slug,
      isActive: true,
    },
  });

  if (!tag) {
    return null;
  }

  const [posts, postCount] = await Promise.all([
    prisma.post.findMany({
      where: publicPostWhere(tag.id),
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
      take: POSTS_TAKE,
    }),
    prisma.post.count({
      where: publicPostWhere(tag.id),
    }),
  ]);

  const gameCounts = new Map<string, { name: string; slug: string; count: number }>();
  for (const post of posts) {
    const current = gameCounts.get(post.game.slug);
    gameCounts.set(post.game.slug, {
      name: post.game.name,
      slug: post.game.slug,
      count: (current?.count ?? 0) + 1,
    });
  }

  return {
    ...tag,
    posts,
    postCount,
    topGames: Array.from(gameCounts.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8),
  };
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getTag(slug);

  if (!tag) {
    return {
      title: "タグが見つかりません",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `#${tag.name}の投稿`;
  const description = `#${tag.name}タグが付いたクリップ・スクリーンショットを新着順で表示します(${tag.postCount}件)。`;
  const pageUrl = absoluteUrl(`/tags/${tag.slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: pageUrl,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const tag = await getTag(slug);

  if (!tag) {
    notFound();
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="パンくずリスト" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/">
          Clipshare
        </Link>
        <ChevronRight className="shrink-0" size={14} />
        <span aria-current="page" className="truncate text-foreground">
          #{tag.name}
        </span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <Hash size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">#{tag.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tag.postCount}件の公開投稿</p>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {tag.posts.length > 0 ? (
            <div className="post-card-grid">
              {tag.posts.map((post, index) => (
                <PostCard
                  bookmarkCount={Number(post.bookmarkCount)}
                  commentCount={Number(post.commentCount)}
                  gameName={post.game.name}
                  gameSlug={post.game.slug}
                  isNsfw={post.isNsfw}
                  key={post.id}
                  likeCount={Number(post.likeCount)}
                  mediaCount={post._count.mediaItems || 1}
                  priority={index < 3}
                  publicId={post.publicId}
                  thumbnailUrl={post.thumbnailUrl}
                  title={post.title}
                  type={post.type}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              このタグの公開投稿はまだありません。
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-md border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Gamepad2 size={18} />
              このタグでよく使われるゲーム
            </h2>
            {tag.topGames.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tag.topGames.map((game) => (
                  <Link
                    className="rounded-md bg-muted px-3 py-1 text-sm hover:bg-primary hover:text-primary-foreground"
                    href={`/games/${game.slug}`}
                    key={game.slug}
                  >
                    {game.name} {game.count}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">まだデータがありません。</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
