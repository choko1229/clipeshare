import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const timelineSortKeys = ["new", "popular", "views", "likes", "comments", "week", "month"] as const;
export const timelinePageSize = 30;

export type TimelineSort = (typeof timelineSortKeys)[number];

export type TimelinePost = {
  id: string;
  publicId: string;
  title: string;
  type: "CLIP" | "SCREENSHOT";
  thumbnailUrl: string;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  isNsfw: boolean;
  mediaCount: number;
  game: {
    name: string;
    slug: string;
  };
};

export function parseTimelineSort(value: string | undefined): TimelineSort {
  return timelineSortKeys.some((key) => key === value) ? (value as TimelineSort) : "new";
}

export function getSortStartDate(sort: TimelineSort) {
  const now = new Date();

  if (sort === "week") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (sort === "month") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return null;
}

export function getTimelineOrderBy(sort: TimelineSort): Prisma.PostOrderByWithRelationInput[] {
  if (sort === "popular" || sort === "week" || sort === "month") {
    return [
      { likeCount: "desc" },
      { commentCount: "desc" },
      { bookmarkCount: "desc" },
      { viewCount: "desc" },
      { publishedAt: "desc" },
      { id: "desc" },
    ];
  }

  if (sort === "views") {
    return [{ viewCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
  }

  if (sort === "likes") {
    return [{ likeCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
  }

  if (sort === "comments") {
    return [{ commentCount: "desc" }, { publishedAt: "desc" }, { id: "desc" }];
  }

  return [{ publishedAt: "desc" }, { id: "desc" }];
}

export function getSortDescription(sort: TimelineSort) {
  switch (sort) {
    case "popular":
      return "いいね、コメント、ブックマーク、再生数を組み合わせて並べています。";
    case "views":
      return "再生数・表示数が多い投稿から表示しています。";
    case "likes":
      return "いいね数が多い投稿から表示しています。";
    case "comments":
      return "コメント数が多い投稿から表示しています。";
    case "week":
      return "直近7日間の投稿を人気順で表示しています。";
    case "month":
      return "直近30日間の投稿を人気順で表示しています。";
    case "new":
    default:
      return "公開されたばかりの投稿から表示しています。";
  }
}

export async function getTimelinePosts(sort: TimelineSort, offset = 0, limit = timelinePageSize) {
  const startDate = getSortStartDate(sort);
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
      ...(startDate
        ? {
            publishedAt: {
              gte: startDate,
            },
          }
        : {}),
    },
    include: {
      game: {
        select: {
          name: true,
          slug: true,
        },
      },
      _count: {
        select: {
          mediaItems: true,
        },
      },
    },
    orderBy: getTimelineOrderBy(sort),
    skip: offset,
    take: limit,
  });

  return posts.map<TimelinePost>((post) => ({
    id: post.id,
    publicId: post.publicId,
    title: post.title,
    type: post.type,
    thumbnailUrl: post.thumbnailUrl,
    likeCount: Number(post.likeCount),
    commentCount: Number(post.commentCount),
    bookmarkCount: Number(post.bookmarkCount),
    isNsfw: post.isNsfw,
    mediaCount: post._count.mediaItems || 1,
    game: post.game,
  }));
}

export async function getTimelinePage(sort: TimelineSort, offset = 0, limit = timelinePageSize) {
  const posts = await getTimelinePosts(sort, offset, limit + 1);

  return {
    posts: posts.slice(0, limit),
    hasMore: posts.length > limit,
    nextOffset: offset + Math.min(posts.length, limit),
  };
}
