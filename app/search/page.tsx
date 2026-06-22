import { Search } from "lucide-react";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";
import { parseSearchQuery } from "@/lib/search/parse-query";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const parsed = parseSearchQuery(q);
  const posts = q.trim() ? await searchPosts(parsed) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
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
          placeholder="キーワード game:Valorant tag:ace from:username type:clip"
          type="search"
        />
      </form>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border border-border bg-card px-2 py-1">game:Valorant</span>
        <span className="rounded-md border border-border bg-card px-2 py-1">tag:ace</span>
        <span className="rounded-md border border-border bg-card px-2 py-1">from:username</span>
        <span className="rounded-md border border-border bg-card px-2 py-1">type:clip</span>
        <span className="rounded-md border border-border bg-card px-2 py-1">type:screenshot</span>
      </div>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
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
      isNsfw: false,
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
    },
    include: {
      game: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 60,
  });
}
