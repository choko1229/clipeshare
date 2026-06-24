import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bookmark, Eye, Flag, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { HlsPlayer } from "@/components/media/hls-player";
import { NsfwGate } from "@/components/media/nsfw-gate";
import { SharePanel } from "@/components/share/share-panel";
import { prisma } from "@/lib/db/prisma";
import { createComment, createCommentReport, createReport, deleteComment, toggleBookmark, toggleLike } from "@/app/c/[id]/actions";

export const dynamic = "force-dynamic";

type ClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getCustomText(value: unknown) {
  if (typeof value === "object" && value !== null && "note" in value && typeof (value as { note: unknown }).note === "string") {
    return (value as { note: string }).note;
  }

  return "";
}

async function getPublicPost(publicId: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: {
        in: ["PUBLISHED", "PROCESSING", "FAILED"],
      },
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

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

async function getVisiblePost(publicId: string, viewerId?: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: {
        in: ["PUBLISHED", "PROCESSING", "PRIVATE", "FAILED"],
      },
      ...(viewerId ? {} : { isNsfw: false }),
      OR: [
        {
          visibility: "PUBLIC",
        },
        ...(viewerId
          ? [
              {
                userId: viewerId,
                visibility: "PRIVATE" as const,
              },
            ]
          : []),
      ],
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

    const title = post.isNsfw ? "NSFWコンテンツ" : post.title;
    const description = post.isNsfw ? "この投稿はログイン後に表示できます。" : post.description.slice(0, 160);
    const image = absoluteUrl(post.isNsfw ? "/images/nsfw-placeholder.svg" : post.thumbnailUrl);
    const pageUrl = absoluteUrl(`/c/${post.publicId}`);
    const playerUrl = absoluteUrl(`/embed/c/${post.publicId}`);
    const shareVideoUrl = !post.isNsfw && post.type === "CLIP" && post.shareVideoUrl ? absoluteUrl(post.shareVideoUrl) : null;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        url: pageUrl,
        images: [
          {
            url: image,
            width: 1280,
            height: 720,
            alt: title,
          },
        ],
        videos: shareVideoUrl
          ? [
              {
                url: shareVideoUrl,
                secureUrl: shareVideoUrl,
                type: "video/mp4",
                width: post.width ?? 1280,
                height: post.height ?? 720,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
      other:
        !post.isNsfw && post.type === "CLIP"
          ? {
              "twitter:card": "player",
              "twitter:player": playerUrl,
              "twitter:player:width": "1280",
              "twitter:player:height": "720",
              ...(shareVideoUrl
                ? {
                    "twitter:player:stream": shareVideoUrl,
                    "twitter:player:stream:content_type": "video/mp4",
                  }
                : {}),
            }
          : undefined,
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
  const post = await getVisiblePost(id, session?.user?.id);

  if (!post) {
    notFound();
  }

  await prisma.post.update({
    where: {
      id: post.id,
    },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  });

  const displayViewCount = Number(post.viewCount) + 1;
  const isOwner = session?.user?.id === post.userId;
  const customText = getCustomText(post.customFields);
  const shareUrl = absoluteUrl(`/c/${post.publicId}`);
  const embedUrl = absoluteUrl(`/embed/c/${post.publicId}`);
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
  const isBookmarked = session?.user?.id
    ? Boolean(
        await prisma.bookmark.findUnique({
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
        <NsfwGate isNsfw={post.isNsfw}>
          {post.type === "CLIP" && post.mediaUrl ? (
            <HlsPlayer poster={post.thumbnailUrl} src={post.mediaUrl} title={post.title} />
          ) : post.mediaUrl ? (
            <Image alt={post.title} className="object-contain" fill priority src={post.mediaUrl} />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <p className="text-lg font-semibold">
                  {post.status === "FAILED" ? "動画変換に失敗しました" : "動画を変換中です"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {post.status === "FAILED"
                    ? "時間を置いても直らない場合は再投稿してください。"
                    : "変換が完了すると、このページで再生できるようになります。"}
                </p>
              </div>
            </div>
          )}
        </NsfwGate>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <Link className="text-sm font-medium text-primary hover:text-primary/80" href={`/games/${post.game.slug}`}>
            {post.game.name}
          </Link>
          {post.visibility === "PRIVATE" ? (
            <span className="ml-2 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">非公開</span>
          ) : null}
          {post.isNsfw ? <span className="ml-2 rounded-md bg-destructive px-2 py-1 text-xs">NSFW</span> : null}
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

          {post.rankName || post.discordServerName || customText ? (
            <div className="mt-5 grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-2">
              {post.rankName ? (
                <div>
                  <p className="text-xs text-muted-foreground">ランク帯</p>
                  <p className="mt-1 font-medium">{post.rankName}</p>
                </div>
              ) : null}
              {post.discordServerName ? (
                <div>
                  <p className="text-xs text-muted-foreground">Discordサーバー</p>
                  <p className="mt-1 font-medium">{post.discordServerName}</p>
                </div>
              ) : null}
              {customText ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">カスタム項目</p>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{customText}</p>
                </div>
              ) : null}
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
                  <article className="rounded-md border border-border bg-background p-4" id={`comment-${comment.id}`} key={comment.id}>
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
                    {session?.user && session.user.id !== comment.userId ? (
                      <form action={createCommentReport} className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-[160px_1fr_auto]">
                        <input name="publicId" type="hidden" value={post.publicId} />
                        <input name="commentId" type="hidden" value={comment.id} />
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-xs outline-none ring-ring transition focus:ring-2"
                          name="reason"
                          required
                        >
                          <option value="spam">スパム</option>
                          <option value="harassment">嫌がらせ</option>
                          <option value="nsfw_missing">NSFW未設定</option>
                          <option value="illegal">犯罪系コンテンツ</option>
                          <option value="other">その他</option>
                        </select>
                        <input
                          className="h-9 rounded-md border border-input bg-background px-3 text-xs outline-none ring-ring transition focus:ring-2"
                          maxLength={1000}
                          name="detail"
                          placeholder="通報メモ 任意"
                        />
                        <Button className="h-9 px-3 text-xs" type="submit" variant="outline">
                          <Flag size={14} />
                          通報
                        </Button>
                      </form>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  まだコメントはありません。
                </p>
              )}
            </div>
          </section>

          <div className="mt-6 lg:hidden">
            <SharePanel embedUrl={embedUrl} title={post.title} url={shareUrl} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="hidden lg:block">
            <SharePanel embedUrl={embedUrl} title={post.title} url={shareUrl} />
          </div>

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
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-md bg-background p-3">
                <Eye className="mx-auto mb-1" size={18} />
                {displayViewCount}
              </div>
              <div className="rounded-md bg-background p-3">
                <Heart className="mx-auto mb-1" size={18} />
                {Number(post.likeCount)}
              </div>
              <div className="rounded-md bg-background p-3">
                <MessageCircle className="mx-auto mb-1" size={18} />
                {Number(post.commentCount)}
              </div>
              <div className="rounded-md bg-background p-3">
                <Bookmark className="mx-auto mb-1" size={18} />
                {Number(post.bookmarkCount)}
              </div>
            </div>
            {session?.user ? (
              <div className="grid gap-2">
                {isOwner ? (
                  <Button asChild variant="outline">
                    <Link href={`/c/${post.publicId}/edit`}>
                      <Pencil size={18} />
                      投稿を編集
                    </Link>
                  </Button>
                ) : null}
                <form action={toggleLike}>
                  <input name="publicId" type="hidden" value={post.publicId} />
                  <Button className="w-full" type="submit" variant={isLiked ? "secondary" : "default"}>
                    <Heart size={18} />
                    {isLiked ? "いいね済み" : "いいね"}
                  </Button>
                </form>
                <form action={toggleBookmark}>
                  <input name="publicId" type="hidden" value={post.publicId} />
                  <Button className="w-full" type="submit" variant={isBookmarked ? "secondary" : "outline"}>
                    <Bookmark size={18} />
                    {isBookmarked ? "保存済み" : "ブックマーク"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="grid gap-2">
                <Button asChild className="w-full">
                  <Link href="/login">ログインしていいね</Link>
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link href="/login">ログインして保存</Link>
                </Button>
              </div>
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
