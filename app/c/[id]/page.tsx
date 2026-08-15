import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Bookmark, ChevronRight, Eye, Flag, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { HlsPlayer } from "@/components/media/hls-player";
import { ImageCarousel } from "@/components/media/image-carousel";
import { NsfwGate } from "@/components/media/nsfw-gate";
import { DeletePostButton } from "@/components/posts/delete-post-button";
import { PostCard } from "@/components/posts/post-card";
import { JsonLd } from "@/components/seo/json-ld";
import { SharePanel } from "@/components/share/share-panel";
import { prisma } from "@/lib/db/prisma";
import { isAdultBirthDate } from "@/lib/users/age";
import {
  createComment,
  createCommentReport,
  createReport,
  deleteComment,
  deletePost,
  toggleBookmark,
  toggleLike,
  updateComment,
} from "@/app/c/[id]/actions";

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
      mediaItems: {
        orderBy: {
          sortOrder: "asc",
        },
      },
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

const EMBED_VIDEO_WIDTH = 1280;
const EMBED_VIDEO_HEIGHT = 720;

type VisiblePost = NonNullable<Awaited<ReturnType<typeof getVisiblePost>>>;

function buildPostJsonLd(post: VisiblePost, pageUrl: string, embedUrl: string): Record<string, unknown>[] {
  if (post.isNsfw || post.visibility !== "PUBLIC" || post.status !== "PUBLISHED") {
    return [];
  }

  const authorName = post.user.displayName ?? post.user.name ?? post.user.username ?? "Unknown";
  const author = post.user.username
    ? {
        "@type": "Person",
        name: authorName,
        url: absoluteUrl(`/users/${post.user.username}`),
      }
    : {
        "@type": "Person",
        name: authorName,
      };
  const uploadDate = (post.publishedAt ?? post.createdAt).toISOString();
  const thumbnailUrl = absoluteUrl(post.thumbnailUrl);

  const mainEntity: Record<string, unknown> =
    post.type === "CLIP" && post.mediaUrl
      ? {
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: post.title,
          description: post.description || post.title,
          thumbnailUrl: [thumbnailUrl],
          uploadDate,
          duration: post.durationSeconds ? `PT${post.durationSeconds}S` : undefined,
          contentUrl: absoluteUrl(post.mediaUrl),
          embedUrl,
          author,
          isFamilyFriendly: true,
          interactionStatistic: [
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/WatchAction",
              userInteractionCount: Number(post.viewCount),
            },
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/LikeAction",
              userInteractionCount: Number(post.likeCount),
            },
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/CommentAction",
              userInteractionCount: Number(post.commentCount),
            },
          ],
        }
      : {
          "@context": "https://schema.org",
          "@type": "ImageObject",
          name: post.title,
          description: post.description || post.title,
          contentUrl: absoluteUrl(post.mediaUrl ?? post.thumbnailUrl),
          thumbnailUrl,
          uploadDate,
          author,
          isFamilyFriendly: true,
        };

  const breadcrumb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Clipshare", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: post.game.name, item: absoluteUrl(`/games/${post.game.slug}`) },
      { "@type": "ListItem", position: 3, name: post.title, item: pageUrl },
    ],
  };

  return [mainEntity, breadcrumb];
}

async function getVisiblePost(publicId: string, viewerId?: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: {
        in: ["PUBLISHED", "PROCESSING", "PRIVATE", "FAILED"],
      },
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
      mediaItems: {
        orderBy: {
          sortOrder: "asc",
        },
      },
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

async function getNsfwAccess(isNsfw: boolean, viewerId?: string) {
  if (!isNsfw) {
    return "allowed" as const;
  }

  if (!viewerId) {
    return "login" as const;
  }

  const viewer = await prisma.user.findUnique({
    where: { id: viewerId },
    select: {
      ageVerifiedAt: true,
      birthDate: true,
    },
  });

  if (!viewer) {
    return "login" as const;
  }

  if (viewer.ageVerifiedAt || (viewer.birthDate && isAdultBirthDate(viewer.birthDate))) {
    return "allowed" as const;
  }

  if (viewer.birthDate && !isAdultBirthDate(viewer.birthDate)) {
    return "blocked" as const;
  }

  return "verify" as const;
}

const RELATED_POSTS_TAKE = 6;

async function getRelatedPosts(post: VisiblePost) {
  const [sameGame, byAuthor] = await Promise.all([
    prisma.post.findMany({
      where: {
        gameId: post.gameId,
        id: { not: post.id },
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
      },
      include: {
        game: true,
        _count: { select: { mediaItems: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: RELATED_POSTS_TAKE,
    }),
    prisma.post.findMany({
      where: {
        userId: post.userId,
        id: { not: post.id },
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isNsfw: false,
      },
      include: {
        game: true,
        _count: { select: { mediaItems: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: RELATED_POSTS_TAKE,
    }),
  ]);

  return { sameGame, byAuthor };
}

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await getPublicPost(id);
    if (!post) {
      return {
        title: "投稿が見つかりません",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const title = post.isNsfw ? "NSFWコンテンツ" : post.title;
    const description = post.isNsfw ? "この投稿はログイン後に表示できます。" : post.description.slice(0, 160);
    const image = absoluteUrl(post.isNsfw ? "/images/nsfw-placeholder.svg" : post.thumbnailUrl);
    const pageUrl = absoluteUrl(`/c/${post.publicId}`);
    const playerUrl = absoluteUrl(`/embed/c/${post.publicId}`);
    const canEmbedVideo = post.status === "PUBLISHED" && !post.isNsfw && post.type === "CLIP" && Boolean(post.shareVideoUrl);
    const shareVideoUrl = canEmbedVideo && post.shareVideoUrl ? absoluteUrl(post.shareVideoUrl) : undefined;

    const oembedUrl = absoluteUrl(`/api/oembed?url=${encodeURIComponent(pageUrl)}&format=json`);

    return {
      title,
      description,
      alternates: {
        canonical: pageUrl,
        types: {
          "application/json+oembed": oembedUrl,
        },
      },
      robots: post.isNsfw
        ? {
            index: false,
            follow: false,
          }
        : undefined,
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
                width: EMBED_VIDEO_WIDTH,
                height: EMBED_VIDEO_HEIGHT,
              },
            ]
          : undefined,
      },
      twitter: shareVideoUrl
        ? {
            card: "player",
            title,
            description,
            images: [image],
            players: [
              {
                playerUrl,
                streamUrl: shareVideoUrl,
                width: EMBED_VIDEO_WIDTH,
                height: EMBED_VIDEO_HEIGHT,
              },
            ],
          }
        : {
            card: "summary_large_image",
            title,
            description,
            images: [image],
          },
      other: shareVideoUrl
        ? {
            "twitter:player:stream:content_type": "video/mp4",
          }
        : undefined,
    };
  } catch {
    return {
      title: `Clip ${id}`,
      description: "Clipeshareの投稿詳細ページです。",
      robots: {
        index: false,
        follow: false,
      },
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
  const nsfwAccess = await getNsfwAccess(post.isNsfw, session?.user?.id);
  const customText = getCustomText(post.customFields);
  const shareUrl = absoluteUrl(`/c/${post.publicId}`);
  const embedUrl = absoluteUrl(`/embed/c/${post.publicId}`);
  const xShareVideoUrl =
    post.status === "PUBLISHED" && post.visibility === "PUBLIC" && !post.isNsfw && post.type === "CLIP" && post.shareVideoUrl
      ? absoluteUrl(post.shareVideoUrl)
      : undefined;
  const carouselImages =
    post.type === "SCREENSHOT"
      ? post.mediaItems.length > 0
        ? post.mediaItems.map((item, index) => ({
            id: item.id,
            mediaUrl: item.mediaUrl,
            thumbnailUrl: item.thumbnailUrl,
            title: `${post.title} ${index + 1}`,
          }))
        : post.mediaUrl
          ? [
              {
                id: post.id,
                mediaUrl: post.mediaUrl,
                thumbnailUrl: post.thumbnailUrl,
                title: post.title,
              },
            ]
          : []
      : [];
  const repliesByParent = new Map<string | null, typeof post.comments>();
  for (const comment of post.comments) {
    const parentId = comment.parentCommentId ?? null;
    const comments = repliesByParent.get(parentId) ?? [];
    comments.push(comment);
    repliesByParent.set(parentId, comments);
  }
  const rootComments = repliesByParent.get(null) ?? [];
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
  const relatedPosts = await getRelatedPosts(post);
  const authorName = post.user.displayName ?? post.user.name ?? post.user.username ?? "投稿者";

  const jsonLd = buildPostJsonLd(post, shareUrl, embedUrl);

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      {jsonLd.length > 0 ? <JsonLd data={jsonLd} /> : null}
      <nav aria-label="パンくずリスト" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/">
          Clipshare
        </Link>
        <ChevronRight className="shrink-0" size={14} />
        <Link className="hover:text-foreground" href={`/games/${post.game.slug}`}>
          {post.game.name}
        </Link>
        <ChevronRight className="shrink-0" size={14} />
        <span aria-current="page" className="truncate text-foreground">
          {post.title}
        </span>
      </nav>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(360px,4fr)]">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-card">
            <NsfwGate access={nsfwAccess} isNsfw={post.isNsfw}>
              {post.type === "CLIP" && post.mediaUrl ? (
                <HlsPlayer poster={post.thumbnailUrl} src={post.mediaUrl} title={post.title} />
              ) : carouselImages.length > 0 ? (
                <ImageCarousel images={carouselImages} />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <p className="text-lg font-semibold">
                      {post.status === "FAILED" ? "動画変換に失敗しました" : "動画を変換中です"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {post.status === "FAILED"
                        ? "時間を置いても変わらない場合は、再投稿してください。"
                        : "変換が完了すると、このページで再生できるようになります。"}
                    </p>
                  </div>
                </div>
              )}
            </NsfwGate>
          </div>

          <div className="mt-6">
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
                  <Link
                    className="rounded-md border border-border bg-muted px-3 py-1 text-sm transition hover:border-primary hover:text-primary"
                    href={`/tags/${tag.slug}`}
                    key={tag.id}
                  >
                    #{tag.name}
                  </Link>
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
              {rootComments.length > 0
                ? rootComments.map((comment) => {
                    const childComments = repliesByParent.get(comment.id) ?? [];
                    const commentUserName = comment.user.displayName ?? comment.user.name ?? comment.user.username ?? "Unknown";

                    return (
                      <article className="rounded-md border border-border bg-background p-4" id={`comment-${comment.id}`} key={comment.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {comment.user.username ? <Link href={`/users/${comment.user.username}`}>{commentUserName}</Link> : commentUserName}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                            {comment.updatedAt.getTime() !== comment.createdAt.getTime() ? (
                              <p className="mt-1 text-xs text-muted-foreground">編集済み</p>
                            ) : null}
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

                        {session?.user ? (
                          <div className="mt-3 flex flex-wrap gap-3 text-xs">
                            <details>
                              <summary className="cursor-pointer text-primary">返信</summary>
                              <form action={createComment} className="mt-3 grid gap-2">
                                <input name="publicId" type="hidden" value={post.publicId} />
                                <input name="parentCommentId" type="hidden" value={comment.id} />
                                <textarea
                                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                                  maxLength={1000}
                                  name="body"
                                  placeholder={`${commentUserName} さんへ返信`}
                                  required
                                />
                                <Button className="w-fit" type="submit" variant="outline">
                                  返信する
                                </Button>
                              </form>
                            </details>
                            {session.user.id === comment.userId ? (
                              <details>
                                <summary className="cursor-pointer text-primary">編集</summary>
                                <form action={updateComment} className="mt-3 grid gap-2">
                                  <input name="publicId" type="hidden" value={post.publicId} />
                                  <input name="commentId" type="hidden" value={comment.id} />
                                  <textarea
                                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                                    defaultValue={comment.body}
                                    maxLength={1000}
                                    name="body"
                                    required
                                  />
                                  <Button className="w-fit" type="submit" variant="outline">
                                    保存
                                  </Button>
                                </form>
                              </details>
                            ) : null}
                          </div>
                        ) : null}

                        {childComments.length > 0 ? (
                          <div className="mt-4 space-y-3 border-l border-border pl-4">
                            {childComments.map((reply) => {
                              const replyUserName = reply.user.displayName ?? reply.user.name ?? reply.user.username ?? "Unknown";

                              return (
                                <article className="rounded-md border border-border bg-card p-3" id={`comment-${reply.id}`} key={reply.id}>
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold">
                                        {reply.user.username ? <Link href={`/users/${reply.user.username}`}>{replyUserName}</Link> : replyUserName}
                                      </p>
                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{reply.body}</p>
                                      {reply.updatedAt.getTime() !== reply.createdAt.getTime() ? (
                                        <p className="mt-1 text-xs text-muted-foreground">編集済み</p>
                                      ) : null}
                                    </div>
                                    {session?.user?.id === reply.userId ? (
                                      <form action={deleteComment}>
                                        <input name="publicId" type="hidden" value={post.publicId} />
                                        <input name="commentId" type="hidden" value={reply.id} />
                                        <Button type="submit" variant="ghost">
                                          <Trash2 size={16} />
                                          削除
                                        </Button>
                                      </form>
                                    ) : null}
                                  </div>
                                  {session?.user ? (
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                                      <details>
                                        <summary className="cursor-pointer text-primary">返信</summary>
                                        <form action={createComment} className="mt-3 grid gap-2">
                                          <input name="publicId" type="hidden" value={post.publicId} />
                                          <input name="parentCommentId" type="hidden" value={comment.id} />
                                          <textarea
                                            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                                            maxLength={1000}
                                            name="body"
                                            placeholder={`${replyUserName} さんへ返信`}
                                            required
                                          />
                                          <Button className="w-fit" type="submit" variant="outline">
                                            返信する
                                          </Button>
                                        </form>
                                      </details>
                                      {session.user.id === reply.userId ? (
                                        <details>
                                          <summary className="cursor-pointer text-primary">編集</summary>
                                          <form action={updateComment} className="mt-3 grid gap-2">
                                            <input name="publicId" type="hidden" value={post.publicId} />
                                            <input name="commentId" type="hidden" value={reply.id} />
                                            <textarea
                                              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
                                              defaultValue={reply.body}
                                              maxLength={1000}
                                              name="body"
                                              required
                                            />
                                            <Button className="w-fit" type="submit" variant="outline">
                                              保存
                                            </Button>
                                          </form>
                                        </details>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                : null}
              {false && post!.comments.length > 0 ? (
                post!.comments.map((comment) => (
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
                          <input name="publicId" type="hidden" value={post!.publicId} />
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
                        <input name="publicId" type="hidden" value={post!.publicId} />
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
              ) : rootComments.length === 0 ? (
                <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
                  まだコメントはありません。
                </p>
              ) : null}
            </div>
          </section>

          {relatedPosts.sameGame.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">{post.game.name}の新着クリップ</h2>
              <div className="post-card-grid mt-4">
                {relatedPosts.sameGame.map((related) => (
                  <PostCard
                    bookmarkCount={Number(related.bookmarkCount)}
                    commentCount={Number(related.commentCount)}
                    gameName={related.game.name}
                    gameSlug={related.game.slug}
                    isNsfw={related.isNsfw}
                    key={related.id}
                    likeCount={Number(related.likeCount)}
                    mediaCount={related._count.mediaItems || 1}
                    publicId={related.publicId}
                    thumbnailUrl={related.thumbnailUrl}
                    title={related.title}
                    type={related.type}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {relatedPosts.byAuthor.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-xl font-semibold">{authorName}の他の投稿</h2>
              <div className="post-card-grid mt-4">
                {relatedPosts.byAuthor.map((related) => (
                  <PostCard
                    bookmarkCount={Number(related.bookmarkCount)}
                    commentCount={Number(related.commentCount)}
                    gameName={related.game.name}
                    gameSlug={related.game.slug}
                    isNsfw={related.isNsfw}
                    key={related.id}
                    likeCount={Number(related.likeCount)}
                    mediaCount={related._count.mediaItems || 1}
                    publicId={related.publicId}
                    thumbnailUrl={related.thumbnailUrl}
                    title={related.title}
                    type={related.type}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-6 lg:hidden">
            <SharePanel embedUrl={embedUrl} shareVideoUrl={xShareVideoUrl} title={post.title} url={shareUrl} />
          </div>
        </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="hidden lg:block">
            <SharePanel embedUrl={embedUrl} shareVideoUrl={xShareVideoUrl} title={post.title} url={shareUrl} />
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
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/c/${post.publicId}/edit`}>
                        <Pencil size={18} />
                        投稿を編集
                      </Link>
                    </Button>
                    <DeletePostButton action={deletePost} publicId={post.publicId} title={post.title} />
                  </>
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
