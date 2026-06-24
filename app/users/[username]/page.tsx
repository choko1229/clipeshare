import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { ExternalLink } from "lucide-react";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";
import { toggleFollow } from "@/app/users/[username]/actions";

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

export default async function UserProfilePage({ params }: UserPageProps) {
  const { username } = await params;
  const session = await getServerSession(authOptions);
  const user = await getProfile(username);

  if (!user) {
    notFound();
  }

  const isOwner = session?.user?.id === user.id;
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
              <h1 className="text-3xl font-bold">{user.displayName ?? user.name ?? user.username}</h1>
              <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
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
                <a
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  href={link.url}
                  key={link.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  {link.label || linkTypeLabel(link.type)}
                  <ExternalLink size={14} />
                </a>
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

function linkTypeLabel(type: string) {
  switch (type) {
    case "x":
      return "X";
    case "discord":
      return "Discord";
    case "youtube":
      return "YouTube";
    case "twitch":
      return "Twitch";
    default:
      return "Website";
  }
}
