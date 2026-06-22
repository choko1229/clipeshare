import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { PostCard } from "@/components/posts/post-card";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: {
      userId: session.user.id,
      post: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
      },
    },
    include: {
      post: {
        include: {
          game: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 60,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">ブックマーク</h1>
        <p className="mt-2 text-sm text-muted-foreground">保存した公開投稿を新しい順に表示します。</p>
      </div>

      {bookmarks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map(({ post }) => (
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
          まだ保存した投稿はありません。
        </div>
      )}
    </main>
  );
}
