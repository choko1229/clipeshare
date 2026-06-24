import Link from "next/link";
import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const sortTabs = [
  { key: "new", label: "新着" },
  { key: "popular", label: "人気" },
  { key: "views", label: "再生数" },
  { key: "likes", label: "いいね" },
  { key: "comments", label: "コメント" },
  { key: "week", label: "週間" },
  { key: "month", label: "月間" },
] as const;

type TimelineSort = (typeof sortTabs)[number]["key"];

type HomePageProps = {
  searchParams: Promise<{
    sort?: string;
  }>;
};

function parseTimelineSort(value: string | undefined): TimelineSort {
  return sortTabs.some((tab) => tab.key === value) ? (value as TimelineSort) : "new";
}

function getSortStartDate(sort: TimelineSort) {
  const now = new Date();

  if (sort === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (sort === "month") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return null;
}

function getOrderBy(sort: TimelineSort): Prisma.PostOrderByWithRelationInput[] {
  if (sort === "popular" || sort === "week" || sort === "month") {
    return [
      { likeCount: "desc" },
      { commentCount: "desc" },
      { bookmarkCount: "desc" },
      { viewCount: "desc" },
      { publishedAt: "desc" },
    ];
  }

  if (sort === "views") {
    return [{ viewCount: "desc" }, { publishedAt: "desc" }];
  }

  if (sort === "likes") {
    return [{ likeCount: "desc" }, { publishedAt: "desc" }];
  }

  if (sort === "comments") {
    return [{ commentCount: "desc" }, { publishedAt: "desc" }];
  }

  return [{ publishedAt: "desc" }];
}

function getSortDescription(sort: TimelineSort) {
  switch (sort) {
    case "popular":
      return "いいね、コメント、ブックマーク、再生数を組み合わせて並べています。";
    case "views":
      return "再生数・表示数が多い投稿から表示しています。";
    case "likes":
      return "いいね数が多い投稿から表示しています。";
    case "comments":
      return "コメント数が多い投稿から表示しています。";
    case "week":
      return "直近7日間の投稿を人気順で表示しています。";
    case "month":
      return "直近30日間の投稿を人気順で表示しています。";
    case "new":
    default:
      return "公開されたばかりの投稿から表示しています。";
  }
}

async function getTimelinePosts(sort: TimelineSort) {
  const startDate = getSortStartDate(sort);

  try {
    return await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
        ...(startDate
          ? {
              publishedAt: {
                gte: startDate,
              },
            }
          : {}),
      },
      include: {
        game: true,
      },
      orderBy: getOrderBy(sort),
      take: 24,
    });
  } catch {
    return [];
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { sort: sortParam } = await searchParams;
  const activeSort = parseTimelineSort(sortParam);
  const posts = await getTimelinePosts(activeSort);
  const activeSortLabel = sortTabs.find((tab) => tab.key === activeSort)?.label ?? "新着";

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

          <div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sortTabs.map((tab) => (
                <Link
                  className={[
                    "h-10 shrink-0 rounded-md border px-4 text-sm font-medium transition",
                    activeSort === tab.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  href={tab.key === "new" ? "/" : `/?sort=${tab.key}`}
                  key={tab.key}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeSortLabel}: {getSortDescription(activeSort)}
            </p>
          </div>

          {posts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
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
            <div className="rounded-md border border-border bg-card p-8 text-center">
              <h2 className="text-lg font-semibold">まだ公開投稿はありません</h2>
              <p className="mt-2 text-sm text-muted-foreground">最初のクリップやスクリーンショットを投稿できます。</p>
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
            <h2 className="text-sm font-semibold">共有対応</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              投稿ページはDiscordやXで共有したときに、タイトル、説明、サムネイル、動画カードを表示できるように調整しています。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
