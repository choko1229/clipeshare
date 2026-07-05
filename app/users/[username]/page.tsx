import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarDays, Grid2X2, List } from "lucide-react";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { PostTile } from "@/components/posts/post-tile";
import { MarkdownBio } from "@/components/profile/markdown-bio";
import { ProfileGroupedPosts } from "@/components/profile/profile-grouped-posts";
import { ProfileInfoModals } from "@/components/profile/profile-info-modals";
import { SocialLinkBadge, VerifiedAdultBadge } from "@/components/profile/social-link-badge";
import { toggleFollow } from "@/app/users/[username]/actions";
import { prisma } from "@/lib/db/prisma";
import { formatBytes } from "@/lib/uploads/account-limits";
import { getAccountLevelProgress } from "@/lib/users/account-levels";
import { isAdultBirthDate } from "@/lib/users/age";

export const dynamic = "force-dynamic";

type UserPageProps = {
  params: Promise<{
    username: string;
  }>;
  searchParams: Promise<{
    view?: string;
  }>;
};

type ViewMode = "card" | "groupedByGame" | "tile";

async function getProfile(username: string) {
  return prisma.user.findUnique({
    where: { username },
    include: {
      accountLevel: true,
      _count: {
        select: {
          followers: true,
          following: true,
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
      },
      links: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      followers: {
        include: {
          follower: {
            select: {
              avatarUrl: true,
              displayName: true,
              id: true,
              image: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      },
      following: {
        include: {
          following: {
            select: {
              avatarUrl: true,
              displayName: true,
              id: true,
              image: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      },
    },
  });
}

function parseViewMode(value: string | undefined): ViewMode {
  if (value === "groupedByGame") {
    return "groupedByGame";
  }

  return value === "tile" ? "tile" : "card";
}

function profileViewHref(username: string, view: ViewMode) {
  if (view === "groupedByGame") {
    return `/users/${username}?view=groupedByGame`;
  }

  return view === "tile" ? `/users/${username}?view=tile` : `/users/${username}`;
}

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getProfile(username);

  if (!user) {
    return {
      title: "ユーザーが見つかりません",
    };
  }

  const title = `${user.displayName ?? user.name ?? user.username} (@${user.username})`;
  const description = user.bio || "Clipeshareのユーザープロフィール";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: user.profileHeaderUrl || user.avatarUrl || user.image ? [user.profileHeaderUrl ?? user.avatarUrl ?? user.image ?? ""] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

function LevelBadge({ color, name }: { color: string; name: string }) {
  return (
    <span
      className="inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold"
      style={{
        backgroundColor: `${color}22`,
        borderColor: color,
        color,
      }}
    >
      {name}
    </span>
  );
}

function nextRequirementText(progress: NonNullable<Awaited<ReturnType<typeof getAccountLevelProgress>>>) {
  if (!progress.nextLevel) {
    return "次の自動昇格レベルはありません。";
  }

  const missingPosts = Math.max(0, progress.nextLevel.minPostCount - progress.metrics.postCount);
  const missingDays = Math.max(0, progress.nextLevel.minAccountAgeDays - progress.metrics.accountAgeDays);
  const missingFollowers = Math.max(0, progress.nextLevel.minFollowerCount - progress.metrics.followerCount);

  const requirements = [
    missingPosts > 0 ? `投稿あと${missingPosts}件` : null,
    missingDays > 0 ? `登録日数あと${missingDays}日` : null,
    missingFollowers > 0 ? `フォロワーあと${missingFollowers}人` : null,
  ].filter(Boolean);

  if (requirements.length === 0) {
    return `${progress.nextLevel.name}への条件を満たしています。次回投稿時に反映されます。`;
  }

  return `${progress.nextLevel.name}まで: ${requirements.join(" / ")}`;
}

export default async function UserProfilePage({ params, searchParams }: UserPageProps) {
  const [{ username }, { view: viewParam }] = await Promise.all([params, searchParams]);
  const session = await getServerSession(authOptions);
  const user = await getProfile(username);

  if (!user) {
    notFound();
  }

  const defaultView =
    user.profileGroupGames || user.profileDefaultView === "GROUPED_BY_GAME"
      ? "groupedByGame"
      : user.profileDefaultView === "TILE"
        ? "tile"
        : "card";
  const view = viewParam ? parseViewMode(viewParam) : defaultView;
  const isOwner = session?.user?.id === user.id;
  const levelProgress = isOwner ? await getAccountLevelProgress(user.id) : null;
  const visibleLevel = levelProgress?.currentLevel ?? user.accountLevel;
  const isFollowing =
    session?.user?.id && !isOwner
      ? Boolean(
          await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: user.id,
              },
            },
            select: {
              followingId: true,
            },
          }),
        )
      : false;
  const displayName = user.displayName ?? user.name ?? user.username ?? "ユーザー";
  const totalLikes = user.posts.reduce((sum, post) => sum + Number(post.likeCount), 0);
  const profileGames = Array.from(
    user.posts.reduce((gameMap, post) => {
      const current = gameMap.get(post.game.slug);
      const publishedAt = post.publishedAt?.getTime() ?? post.createdAt.getTime();

      if (current) {
        current.count += 1;
        current.latest = Math.max(current.latest, publishedAt);
        return gameMap;
      }

      gameMap.set(post.game.slug, {
        count: 1,
        latest: publishedAt,
        name: post.game.name,
        slug: post.game.slug,
      });
      return gameMap;
    }, new Map<string, { count: number; latest: number; name: string; slug: string }>()),
  )
    .map(([, game]) => game)
    .sort((a, b) => b.latest - a.latest);
  const topGames = profileGames.slice(0, 5);
  const followers = user.followers.map((follow) => follow.follower).filter((profileUser) => Boolean(profileUser.username));
  const following = user.following.map((follow) => follow.following).filter((profileUser) => Boolean(profileUser.username));
  const isAdultVerified = Boolean(user.ageVerifiedAt) || Boolean(user.birthDate && isAdultBirthDate(user.birthDate));
  const birthDateText = user.birthDate ? user.birthDate.toLocaleDateString("ja-JP") : null;
  const accentColor = user.profileAccentColor ?? visibleLevel?.levelColor ?? "#7c5cff";
  const buttonColor = user.profileButtonColor ?? accentColor;
  const groupedPostItems = user.posts.map((post) => ({
    gameName: post.game.name,
    gameSlug: post.game.slug,
    id: post.id,
    isNsfw: post.isNsfw,
    mediaCount: post._count.mediaItems || 1,
    publicId: post.publicId,
    thumbnailUrl: post.thumbnailUrl,
    title: post.title,
    type: post.type,
  }));
  const profileThemeStyle = profileThemeVariables(user.profileThemePreference, accentColor);
  const mainBackgroundStyle: CSSProperties = user.profileBackgroundUrl
    ? {
        background: `linear-gradient(135deg, ${accentColor}10, transparent 42%)`,
      }
    : {
        background: `linear-gradient(135deg, ${accentColor}10, transparent 42%)`,
      };

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8"
      style={
        {
          ...mainBackgroundStyle,
          ...profileThemeStyle,
        } as CSSProperties
      }
    >
      {user.profileBackgroundUrl ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,.52), rgba(0,0,0,.72)), url("${user.profileBackgroundUrl}")`,
            filter: `blur(${user.profileBackgroundBlur}px)`,
            transform: user.profileBackgroundBlur > 0 ? "scale(1.08)" : undefined,
          }}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{displayName} の投稿</h1>
              <p className="mt-1 text-sm text-muted-foreground">公開中のクリップとスクリーンショットを表示しています。</p>
            </div>
            <div className="flex rounded-md border border-border bg-card p-1">
              <Button asChild className="size-9 px-0" variant={view === "card" ? "default" : "ghost"}>
                <Link href={profileViewHref(user.username ?? username, "card")} title="カード表示">
                  <List size={17} />
                </Link>
              </Button>
              <Button asChild className="size-9 px-0" variant={view === "tile" ? "default" : "ghost"}>
                <Link href={profileViewHref(user.username ?? username, "tile")} title="タイル表示">
                  <Grid2X2 size={17} />
                </Link>
              </Button>
              <Button asChild className="h-9 px-3 text-xs" variant={view === "groupedByGame" ? "default" : "ghost"}>
                <Link href={profileViewHref(user.username ?? username, "groupedByGame")} title="ゲームごと">
                  Game
                </Link>
              </Button>
            </div>
          </div>

          {user.posts.length > 0 ? (
            view === "groupedByGame" ? (
              <ProfileGroupedPosts posts={groupedPostItems} />
            ) : view === "tile" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {user.posts.map((post) => (
                  <PostTile
                    gameName={post.game.name}
                    isNsfw={post.isNsfw}
                    key={post.id}
                    mediaCount={post._count.mediaItems || 1}
                    publicId={post.publicId}
                    thumbnailUrl={post.thumbnailUrl}
                    title={post.title}
                    type={post.type}
                  />
                ))}
              </div>
            ) : (
              <div className="grid justify-between gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),360px))]">
                {user.posts.map((post) => (
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
            )
          ) : (
            <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              まだ公開投稿はありません。
            </div>
          )}
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-md border border-border bg-card">
            <div className="relative aspect-[3/1] bg-muted" style={!user.profileHeaderUrl ? { backgroundColor: `${accentColor}44` } : undefined}>
              {user.profileHeaderUrl ? <Image alt="" className="object-cover" fill priority sizes="360px" src={user.profileHeaderUrl} /> : null}
            </div>
            <div className="p-4">
              <div className="-mt-12 flex items-end gap-3">
                <div className="relative size-20 overflow-hidden rounded-md border-4 border-card bg-muted">
                  {user.avatarUrl || user.image ? (
                    <Image alt="" className="object-cover" fill sizes="80px" src={user.avatarUrl ?? user.image ?? ""} />
                  ) : (
                    <div className="grid h-full place-items-center text-2xl font-black" style={{ color: accentColor }}>
                      {(displayName ?? "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold">{displayName}</h2>
                    {visibleLevel ? <LevelBadge color={visibleLevel.levelColor} name={visibleLevel.name} /> : null}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
                </div>
              </div>

              {user.showAgeVerified && isAdultVerified ? (
                <div className="mt-3">
                  <VerifiedAdultBadge />
                </div>
              ) : null}

              {user.showBirthDate && birthDateText ? (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  <CalendarDays size={16} />
                  生年月日: {birthDateText}
                </div>
              ) : null}

              {user.bio ? <MarkdownBio text={user.bio} /> : null}

              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-3">
                <ProfileStat label="投稿" value={user.posts.length} />
                <ProfileStat label="いいね" value={totalLikes} />
                {user.showProfileGames ? <ProfileStat label="ゲーム" value={profileGames.length} /> : null}
                {user.showFollowersCount ? <ProfileStat label="フォロワー" value={user._count.followers} /> : null}
                {user.showFollowingCount ? <ProfileStat label="フォロー" value={user._count.following} /> : null}
              </div>

              <ProfileInfoModals
                followers={followers}
                following={following}
                games={profileGames}
                showFollowersCount={user.showFollowersCount}
                showFollowingCount={user.showFollowingCount}
                showProfileGames={user.showProfileGames}
              />

              {user.links.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {user.links.map((link) => (
                    <SocialLinkBadge key={link.id} label={link.label} type={link.type} url={link.url} />
                  ))}
                </div>
              ) : null}

              {user.showProfileGames && topGames.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {topGames.map((game) => (
                    <Link className="rounded-md border border-border bg-muted px-3 py-1 text-sm transition hover:border-primary/60" href={`/games/${game.slug}`} key={game.slug}>
                      {game.name}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 grid gap-2">
                {isOwner ? (
                  <Button asChild style={{ backgroundColor: buttonColor, color: "#fff" }}>
                    <Link href="/settings/profile">プロフィール編集</Link>
                  </Button>
                ) : session?.user ? (
                  <form action={toggleFollow}>
                    <input name="username" type="hidden" value={user.username ?? ""} />
                    <Button className="w-full" style={{ backgroundColor: buttonColor, color: "#fff" }} type="submit" variant={isFollowing ? "secondary" : "default"}>
                      {isFollowing ? "フォロー中" : "フォロー"}
                    </Button>
                  </form>
                ) : (
                  <Button asChild style={{ backgroundColor: buttonColor, color: "#fff" }}>
                    <Link href="/login">ログインしてフォロー</Link>
                  </Button>
                )}
              </div>

              {levelProgress ? (
                <details className="mt-5 rounded-md border border-border bg-background p-4 text-sm">
                  <summary className="cursor-pointer font-semibold">アカウントレベル詳細</summary>
                  <div className="mt-4 grid gap-3">
                    <p className="rounded-md bg-muted p-3">今日の投稿: {levelProgress.dailyUploadCount}件</p>
                    <p className="rounded-md bg-muted p-3">
                      今日の残り: {levelProgress.dailyUploadRemaining === null ? "無制限" : `${levelProgress.dailyUploadRemaining}件`}
                    </p>
                    <p className="rounded-md bg-muted p-3">
                      動画: {levelProgress.limits.maxVideoSeconds}秒 / {formatBytes(levelProgress.limits.maxVideoSizeBytes)}
                    </p>
                    <p className="rounded-md bg-muted p-3">
                      画像: {formatBytes(levelProgress.limits.maxImageSizeBytes)} / {levelProgress.limits.maxImagesPerPost}枚
                    </p>
                  </div>
                  <p className="mt-3 text-muted-foreground">{nextRequirementText(levelProgress)}</p>
                </details>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function profileThemeVariables(theme: "DARK" | "LIGHT" | "SYSTEM", accentColor: string): CSSProperties {
  if (theme === "SYSTEM") {
    return {
      "--primary": accentColor,
      "--ring": accentColor,
    } as CSSProperties;
  }

  if (theme === "LIGHT") {
    return {
      "--background": "#f7f8fb",
      "--foreground": "#12141c",
      "--muted": "#e8ebf2",
      "--muted-foreground": "#626a7b",
      "--card": "#ffffff",
      "--card-foreground": "#12141c",
      "--border": "#d9deea",
      "--input": "#cfd6e4",
      "--primary": accentColor,
      "--primary-foreground": "#f7fffc",
      "--secondary": "#e2e7f0",
      "--secondary-foreground": "#12141c",
      "--ring": accentColor,
    } as CSSProperties;
  }

  return {
    "--background": "#07080d",
    "--foreground": "#f7f7fb",
    "--muted": "#151821",
    "--muted-foreground": "#a3a8b8",
    "--card": "#10131b",
    "--card-foreground": "#f7f7fb",
    "--border": "#252a38",
    "--input": "#252a38",
    "--primary": accentColor,
    "--primary-foreground": "#06110d",
    "--secondary": "#283144",
    "--secondary-foreground": "#f7f7fb",
    "--ring": accentColor,
  } as CSSProperties;
}
