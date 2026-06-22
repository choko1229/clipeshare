import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

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
            ) : null}
          </div>

          {user.bio ? <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{user.bio}</p> : null}

          <div className="mt-5 grid max-w-xl grid-cols-3 gap-3 text-center text-sm">
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
