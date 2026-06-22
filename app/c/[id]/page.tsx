import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Eye, Flag, Heart, MessageCircle, Trash2 } from "lucide-react";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { createComment, createReport, deleteComment, toggleLike } from "@/app/c/[id]/actions";

export const dynamic = "force-dynamic";

type ClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getPublicPost(publicId: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    include: {
      game: true,
      tags: {
        include: {
          tag: true,
        },
      },
      user: true,
      comments: {
        where: {
          status: "PUBLISHED",
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await getPublicPost(id);
    if (!post) {
      return {
        title: "投稿が見つかりません",
      };
    }

    const title = post.title;
    const description = post.description.slice(0, 160);
    const image = post.isNsfw ? "/images/nsfw-placeholder.svg" : post.thumbnailUrl;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        url: `/c/${post.publicId}`,
        images: [
          {
            url: image,
            width: 1280,
            height: 720,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: `Clip ${id}`,
      description: "Clipeshareの投稿詳細ページです。",
    };
  }
}

export default async function ClipDetailPage({ params }: ClipPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const post = await getPublicPost(id);

  if (!post) {
    notFound();
  }

  const isLiked = session?.user?.id
    ? Boolean(
        await prisma.like.findUnique({
          where: {
            userId_postId: {
              userId: session.user.id,
              postId: post.id,
            },
          },
          select: {
            postId: true,
          },
        }),
      )
    : false;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-card">
        {post.mediaUrl ? (
          <Image
            alt={post.title}
            className={post.isNsfw ? "object-contain blur-xl" : "object-contain"}
            fill
            priority
            src={post.mediaUrl}
          />
        ) : null}
        {post.isNsfw ? (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <span className="rounded-md bg-card px-4 py-2 text-sm font-semibold">NSFW</span>
          </div>
        ) : null}
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="text-sm font-medium text-primary">{post.game.name}</p>
          <h1 className="mt-2 text-3xl font-bold">{post.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{post.description}</p>

          {post.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {post.tags.map(({ tag }) => (
                <span className="rounded-md border border-border bg-muted px-3 py-1 text-sm" key={tag.id}>
                  #{tag.name}
                </span>
              ))}
            </div>
          ) : null}

          <section className="mt-8 rounded-md border border-border bg-card p-4">
            <h2 className="text-xl font-semibold">コメント</h2>
            {session?.user ? (
              <form action={createComment} className="mt-4 space-y-3">
                <input name="publicId" type="hidden" value={post.publicId} />
                <textarea
                  className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                  maxLength={1000}
                  name="body"
                  placeholder="コメントを書く"
                  required
                />
                <Button type="submit">コメントする</Button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                コメントするには<Link className="text-primary" href="/login">ログイン</Link>してください。
              </p>
            )}

            <div className="mt-6 space-y-4">
              {post.comments.length > 0 ? (
                post.comments.map((comment) => (
                  <article className="rounded-md border border-border bg-background p-4" key={comment.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">
                          {comment.user.username ? (
                            <Link href={`/users/${comment.user.username}`}>
                              {comment.user.displayName ?? comment.user.name ?? comment.user.username}
                            </Link>
                          ) : (
                            comment.user.displayName ?? comment.user.name ?? "Unknown"
                          )}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                      </div>
                      {session?.user?.id === comment.userId ? (
                        <form action={deleteComment}>
                          <input name="publicId" type="hidden" value={post.publicId} />
                          <input name="commentId" type="hidden" value={comment.id} />
                          <Button type="submit" variant="ghost">
                            <Trash2 size={16} />
                            削除
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  まだコメントはありません。
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-4 rounded-md border border-border bg-card p-4">
            <div>
              <p className="text-xs text-muted-foreground">投稿者</p>
              <p className="mt-1 font-semibold">
                {post.user.username ? (
                  <Link href={`/users/${post.user.username}`}>
                    {post.user.displayName ?? post.user.name ?? post.user.username}
                  </Link>
                ) : (
                  post.user.displayName ?? post.user.name ?? post.user.email ?? "Unknown"
                )}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-background p-3">
                <Eye className="mx-auto mb-1" size={18} />
                {Number(post.viewCount)}
              </div>
              <div className="rounded-md bg-background p-3">
                <Heart className="mx-auto mb-1" size={18} />
                {Number(post.likeCount)}
              </div>
              <div className="rounded-md bg-background p-3">
                <MessageCircle className="mx-auto mb-1" size={18} />
                {Number(post.commentCount)}
              </div>
            </div>
            {session?.user ? (
              <form action={toggleLike}>
                <input name="publicId" type="hidden" value={post.publicId} />
                <Button className="w-full" type="submit" variant={isLiked ? "secondary" : "default"}>
                  <Heart size={18} />
                  {isLiked ? "いいね済み" : "いいね"}
                </Button>
              </form>
            ) : (
              <Button asChild className="w-full">
                <Link href="/login">ログインしていいね</Link>
              </Button>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Flag size={18} />
              通報
            </div>
            {session?.user ? (
              <form action={createReport} className="mt-4 space-y-3">
                <input name="publicId" type="hidden" value={post.publicId} />
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                  name="reason"
                  required
                >
                  <option value="spam">スパム</option>
                  <option value="harassment">嫌がらせ</option>
                  <option value="nsfw_missing">NSFW未設定</option>
                  <option value="illegal">犯罪系コンテンツ</option>
                  <option value="other">その他</option>
                </select>
                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                  maxLength={1000}
                  name="detail"
                  placeholder="補足があれば入力"
                />
                <Button className="w-full" type="submit" variant="outline">
                  通報する
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                通報するには<Link className="text-primary" href="/login">ログイン</Link>してください。
              </p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
