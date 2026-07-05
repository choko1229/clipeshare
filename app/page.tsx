import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { Grid2X2, List, Sparkles, TrendingUp, UserRound } from "lucide-react";
import type React from "react";
import { authOptions } from "@/auth";
import { InlinePostComposer } from "@/components/posts/inline-post-composer";
import { TimelineFeed } from "@/components/posts/timeline-feed";
import { Button } from "@/components/ui/button";
import { searchParamError } from "@/lib/actions/error-message";
import { prisma } from "@/lib/db/prisma";
import { getSortDescription, getTimelinePage, parseTimelineSort, timelinePageSize } from "@/lib/timeline/posts";
import { syncUserAccountLevel } from "@/lib/users/account-levels";

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

const viewModes = ["card", "tile"] as const;

type TimelineSort = (typeof sortTabs)[number]["key"];
type ViewMode = (typeof viewModes)[number];

type HomePageProps = {
  searchParams: Promise<{
    sort?: string;
    view?: string;
    error?: string;
  }>;
};

type TrendItem = {
  key: string;
  label: string;
  href: string;
  count: number;
};

function parseViewMode(value: string | undefined): ViewMode {
  return value === "tile" ? "tile" : "card";
}

function timelineHref(sort: TimelineSort, view: ViewMode) {
  const params = new URLSearchParams();
  if (sort !== "new") {
    params.set("sort", sort);
  }
  if (view !== "card") {
    params.set("view", view);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

async function getGameSuggestions() {
  return prisma.game.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    take: 80,
  });
}

async function getCurrentUserProfile(userId: string | undefined) {
  if (!userId) {
    return null;
  }

  await syncUserAccountLevel(userId);

  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      accountLevel: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  });
}

async function getTrends() {
  const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentPosts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
      publishedAt: {
        gte: start,
      },
    },
    include: {
      game: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 500,
  });

  const games = new Map<string, TrendItem>();
  const tags = new Map<string, TrendItem>();

  for (const post of recentPosts) {
    const game = games.get(post.game.slug);
    games.set(post.game.slug, {
      key: post.game.slug,
      label: post.game.name,
      href: `/games/${post.game.slug}`,
      count: (game?.count ?? 0) + 1,
    });

    for (const postTag of post.tags) {
      const tag = tags.get(postTag.tag.slug);
      tags.set(postTag.tag.slug, {
        key: postTag.tag.slug,
        label: `#${postTag.tag.name}`,
        href: `/search?q=tag:${encodeURIComponent(postTag.tag.name)}`,
        count: (tag?.count ?? 0) + 1,
      });
    }
  }

  const sortTrend = (items: TrendItem[]) => items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 5);

  return {
    games: sortTrend(Array.from(games.values())),
    tags: sortTrend(Array.from(tags.values())),
  };
}

async function getRecommendedUsers(currentUserId: string | undefined) {
  return prisma.user.findMany({
    where: {
      isBanned: false,
      ...(currentUserId ? { id: { not: currentUserId } } : {}),
      posts: {
        some: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isNsfw: false,
        },
      },
    },
    include: {
      accountLevel: true,
      posts: {
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isNsfw: false,
        },
        select: {
          publishedAt: true,
        },
        orderBy: {
          publishedAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          posts: true,
          followers: true,
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { createdAt: "desc" }],
    take: 5,
  });
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [{ sort: sortParam, view: viewParam, error }, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  const activeSort = parseTimelineSort(sortParam);
  const activeView = parseViewMode(viewParam);
  const userId = session?.user?.id;
  const [timelinePage, gameSuggestions, currentUser, trends, recommendedUsers] = await Promise.all([
    getTimelinePage(activeSort, 0, timelinePageSize),
    getGameSuggestions(),
    getCurrentUserProfile(userId),
    getTrends(),
    getRecommendedUsers(userId),
  ]);
  const activeSortLabel = sortTabs.find((tab) => tab.key === activeSort)?.label ?? "新着";

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <InlinePostComposer
            gameSuggestions={gameSuggestions}
            isLoggedIn={Boolean(session?.user)}
            userImage={currentUser?.avatarUrl || currentUser?.image || session?.user?.image}
            userName={currentUser?.displayName || currentUser?.name || session?.user?.name}
          />
          <ActionError message={searchParamError(error)} />

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">タイムライン</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeSortLabel}: {getSortDescription(activeSort)}
                </p>
              </div>
              <div className="flex rounded-md border border-border bg-card p-1">
                <Button asChild className="size-9 px-0" variant={activeView === "card" ? "default" : "ghost"}>
                  <Link href={timelineHref(activeSort, "card")} title="カード表示">
                    <List size={17} />
                  </Link>
                </Button>
                <Button asChild className="size-9 px-0" variant={activeView === "tile" ? "default" : "ghost"}>
                  <Link href={timelineHref(activeSort, "tile")} title="タイル表示">
                    <Grid2X2 size={17} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {sortTabs.map((tab) => (
                <Link
                  className={[
                    "h-10 shrink-0 rounded-md border px-4 py-2 text-sm font-medium transition",
                    activeSort === tab.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  href={timelineHref(tab.key, activeView)}
                  key={tab.key}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <TimelineFeed
              initialHasMore={timelinePage.hasMore}
              initialNextOffset={timelinePage.nextOffset}
              initialPosts={timelinePage.posts}
              key={`${activeSort}:${activeView}`}
              sort={activeSort}
              view={activeView}
            />
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
          <ProfilePanel user={currentUser} />
          <TrendPanel title="トレンドゲーム" icon={<TrendingUp size={18} />} items={trends.games} emptyText="直近3日のゲーム投稿はまだありません。" />
          <TrendPanel title="トレンドタグ" icon={<HashIcon />} items={trends.tags} emptyText="直近3日のタグ投稿はまだありません。" />
          <RecommendedUsers users={recommendedUsers} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}

function ProfilePanel({
  user,
}: {
  user: Awaited<ReturnType<typeof getCurrentUserProfile>>;
}) {
  if (!user) {
    return (
      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="h-20 bg-gradient-to-r from-primary/30 via-secondary to-muted" />
        <div className="p-4">
          <h2 className="text-base font-bold">プロフィール</h2>
          <p className="mt-2 text-sm text-muted-foreground">ログインすると自分の投稿状況とアカウントレベルを確認できます。</p>
          <Button asChild className="mt-4 w-full">
            <Link href="/login">ログイン</Link>
          </Button>
        </div>
      </section>
    );
  }

  const displayName = user.displayName || user.name || user.username || "ユーザー";
  const profileHref = user.username ? `/users/${user.username}` : "/settings/profile";
  const levelColor = user.accountLevel?.levelColor ?? "#8b949e";

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="h-20" style={{ background: `linear-gradient(135deg, ${levelColor}66, rgba(255,255,255,0.04))` }} />
      <div className="p-4">
        <div className="-mt-10 flex items-end gap-3">
          <div className="relative size-16 overflow-hidden rounded-full border-4 border-card bg-muted">
            {user.avatarUrl || user.image ? (
              <Image alt="" className="object-cover" fill sizes="64px" src={user.avatarUrl || user.image || ""} />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <UserRound size={28} />
              </div>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <Link className="block truncate font-bold hover:text-primary" href={profileHref}>
              {displayName}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username}` : "プロフィール未設定"}</p>
          </div>
        </div>
        <div
          className="mt-4 rounded-md border px-3 py-2 text-sm font-bold"
          style={{
            borderColor: `${levelColor}88`,
            backgroundColor: `${levelColor}16`,
            color: levelColor,
          }}
        >
          {user.accountLevel?.name ?? "Account"}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="投稿" value={user._count.posts} />
          <Stat label="フォロー" value={user._count.following} />
          <Stat label="フォロワー" value={user._count.followers} />
        </div>
      </div>
    </section>
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

function TrendPanel({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: TrendItem[]; emptyText: string }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        {icon}
        {title}
      </h2>
      {items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-muted"
              href={item.href}
              key={item.key}
            >
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{item.count}件</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

function RecommendedUsers({
  users,
}: {
  users: Awaited<ReturnType<typeof getRecommendedUsers>>;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Sparkles size={18} />
        おすすめユーザー
      </h2>
      {users.length > 0 ? (
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const displayName = user.displayName || user.name || user.username || "ユーザー";
            const profileHref = user.username ? `/users/${user.username}` : "#";
            return (
              <Link className="flex items-center gap-3 rounded-md p-2 transition hover:bg-muted" href={profileHref} key={user.id}>
                <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted">
                  {user.avatarUrl || user.image ? (
                    <Image alt="" className="object-cover" fill sizes="40px" src={user.avatarUrl || user.image || ""} />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user._count.posts}投稿 / {user._count.followers}フォロワー
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">おすすめできる公開ユーザーはまだありません。</p>
      )}
    </section>
  );
}

function HashIcon() {
  return <span className="text-base font-bold leading-none">#</span>;
}
