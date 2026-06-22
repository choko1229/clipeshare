import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const sortTabs = ["新着", "人気", "再生数", "いいね", "コメント", "週間", "月間"];

async function getTimelinePosts() {
  try {
    return await prisma.post.findMany({
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
    });
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const posts = await getTimelinePosts();

  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">ゲームクリップのタイムライン</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                クリップ動画とスクリーンショットを投稿、検索、共有できるメディア中心のフィードです。
              </p>
            </div>
            <Button asChild>
              <Link href="/posts/new">投稿する</Link>
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortTabs.map((tab, index) => (
              <button
                className={[
                  "h-10 shrink-0 rounded-md border px-4 text-sm font-medium transition",
                  index === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
                key={tab}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          {posts.length > 0 ? (
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
            <div className="rounded-md border border-border bg-card p-8 text-center">
              <h2 className="text-lg font-semibold">まだ公開投稿はありません</h2>
              <p className="mt-2 text-sm text-muted-foreground">最初のスクリーンショットを投稿できます。</p>
              <Button asChild className="mt-5">
                <Link href="/posts/new">投稿する</Link>
              </Button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search size={18} />
              検索演算子
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p><code>game:Valorant</code></p>
              <p><code>tag:ace</code></p>
              <p><code>from:username</code></p>
              <p><code>type:clip</code></p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">MVP進行中</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              現在は画像投稿MVPです。次に動画アップロードとHLS変換を追加します。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
