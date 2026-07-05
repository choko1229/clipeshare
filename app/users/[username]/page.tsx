import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
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
};

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
        take: 24,
      },
      links: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });
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

export default async function UserProfilePage({ params }: UserPageProps) {
  const { username } = await params;
  const session = await getServerSession(authOptions);
  const user = await getProfile(username);

  if (!user) {
    notFound();
  }

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
  const totalLikes = user.posts.reduce((sum, post) => sum + Number(post.likeCount), 0);
  const topGames = Array.from(new Set(user.posts.map((post) => post.game.name))).slice(0, 5);
  const isAdultVerified = Boolean(user.ageVerifiedAt) || Boolean(user.birthDate && isAdultBirthDate(user.birthDate));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="grid gap-6 border-b border-border pb-8 md:grid-cols-[160px_1fr]">
        <div className="relative size-32 overflow-hidden rounded-md border border-border bg-card">
          {user.avatarUrl || user.image ? (
            <Image alt="" className="object-cover" fill src={user.avatarUrl ?? user.image ?? ""} />
          ) : (
            <div className="grid h-full place-items-center text-4xl font-black text-primary">
              {(user.displayName ?? user.username ?? "U").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold">{user.displayName ?? user.name ?? user.username}</h1>
                {visibleLevel ? <LevelBadge color={visibleLevel.levelColor} name={visibleLevel.name} /> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
              {isAdultVerified ? (
                <div className="mt-2">
                  <VerifiedAdultBadge />
                </div>
              ) : null}
            </div>
            {isOwner ? (
              <Button asChild variant="outline">
                <Link href="/settings/profile">プロフィール編集</Link>
              </Button>
            ) : session?.user ? (
              <form action={toggleFollow}>
                <input name="username" type="hidden" value={user.username ?? ""} />
                <Button type="submit" variant={isFollowing ? "secondary" : "default"}>
                  {isFollowing ? "フォロー中" : "フォロー"}
                </Button>
              </form>
            ) : (
              <Button asChild>
                <Link href="/login">ログインしてフォロー</Link>
              </Button>
            )}
          </div>

          {user.bio ? <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{user.bio}</p> : null}

          {user.links.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.links.map((link) => (
                <SocialLinkBadge key={link.id} label={link.label} type={link.type} url={link.url} />
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid max-w-3xl grid-cols-2 gap-3 text-center text-sm sm:grid-cols-5">
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xl font-bold">{user.posts.length}</p>
              <p className="text-muted-foreground">投稿</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xl font-bold">{totalLikes}</p>
              <p className="text-muted-foreground">総いいね</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xl font-bold">{topGames.length}</p>
              <p className="text-muted-foreground">ゲーム</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xl font-bold">{user._count.followers}</p>
              <p className="text-muted-foreground">フォロワー</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xl font-bold">{user._count.following}</p>
              <p className="text-muted-foreground">フォロー中</p>
            </div>
          </div>

          {levelProgress ? (
            <details className="mt-5 max-w-3xl rounded-md border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold">アカウントレベル詳細</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <p className="rounded-md bg-muted p-3">今日の投稿: {levelProgress.dailyUploadCount}件</p>
                <p className="rounded-md bg-muted p-3">
                  今日の残り: {levelProgress.dailyUploadRemaining === null ? "無制限" : `${levelProgress.dailyUploadRemaining}件`}
                </p>
                <p className="rounded-md bg-muted p-3">動画: {levelProgress.limits.maxVideoSeconds}秒 / {formatBytes(levelProgress.limits.maxVideoSizeBytes)}</p>
                <p className="rounded-md bg-muted p-3">画像: {formatBytes(levelProgress.limits.maxImageSizeBytes)} / {levelProgress.limits.maxImagesPerPost}枚</p>
              </div>
              <p className="mt-3 text-muted-foreground">{nextRequirementText(levelProgress)}</p>
            </details>
          ) : null}

          {topGames.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {topGames.map((game) => (
                <span className="rounded-md border border-border bg-muted px-3 py-1 text-sm" key={game}>
                  {game}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">投稿一覧</h2>
        {user.posts.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : (
          <div className="mt-4 rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            まだ公開投稿はありません。
          </div>
        )}
      </section>
    </main>
  );
}
