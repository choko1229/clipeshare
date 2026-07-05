import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { ShortsFeed } from "@/components/shorts/shorts-feed";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "動画",
  description: "Clipshareの動画を縦スクロールで見るページ",
};

export default async function VerticalVideoPage() {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id;
  const posts = await prisma.post.findMany({
    where: {
      isNsfw: false,
      mediaUrl: {
        not: null,
      },
      status: "PUBLISHED",
      type: "CLIP",
      visibility: "PUBLIC",
    },
    include: {
      bookmarks: viewerId
        ? {
            where: {
              userId: viewerId,
            },
            select: {
              postId: true,
            },
          }
        : false,
      comments: {
        where: {
          status: "PUBLISHED",
        },
        include: {
          user: {
            select: {
              displayName: true,
              image: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
      game: {
        select: {
          name: true,
          slug: true,
        },
      },
      likes: viewerId
        ? {
            where: {
              userId: viewerId,
            },
            select: {
              postId: true,
            },
          }
        : false,
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      user: {
        select: {
          avatarUrl: true,
          displayName: true,
          image: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 30,
  });

  const shorts = posts.map((post) => ({
    bookmarkCount: Number(post.bookmarkCount),
    commentCount: Number(post.commentCount),
    comments: post.comments.reverse().map((comment) => ({
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      id: comment.id,
      user: {
        avatarUrl: comment.user.avatarUrl,
        displayName: comment.user.displayName,
        image: comment.user.image,
        name: comment.user.name,
        username: comment.user.username,
      },
    })),
    description: post.description,
    durationSeconds: post.durationSeconds,
    game: post.game,
    isBookmarked: Boolean("bookmarks" in post && post.bookmarks.length > 0),
    isLiked: Boolean("likes" in post && post.likes.length > 0),
    likeCount: Number(post.likeCount),
    mediaUrl: post.mediaUrl ?? "",
    publicId: post.publicId,
    tags: post.tags.map(({ tag }) => tag),
    thumbnailUrl: post.thumbnailUrl,
    title: post.title,
    user: post.user,
    viewCount: Number(post.viewCount),
  }));

  return <ShortsFeed isLoggedIn={Boolean(session?.user)} posts={shorts} />;
}
