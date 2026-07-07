"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "node:path";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { daysFromNow, getDeletedFileRetentionDays, mediaUrlToProcessedPath } from "@/lib/media/retention";
import { assertNotBlockedByModerationRules, moderationReportDetail } from "@/lib/moderation/rules";
import { sendWebPushToUser } from "@/lib/notifications/web-push";

const publicIdSchema = z.string().min(1).max(64);
const commentBodySchema = z.string().trim().min(1).max(1000);

async function getPostByPublicId(publicId: string) {
  const post = await prisma.post.findFirst({
    where: {
      publicId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    select: {
      id: true,
      publicId: true,
      title: true,
      userId: true,
    },
  });

  if (!post) {
    throw new Error("投稿が見つかりません。");
  }

  return post;
}

export async function toggleLike(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const post = await getPostByPublicId(publicId);
  let shouldSendLikePush = false;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: post.id,
        },
      },
    });

    if (existing) {
      await tx.like.delete({
        where: {
          userId_postId: {
            userId,
            postId: post.id,
          },
        },
      });
      await tx.post.update({
        where: { id: post.id },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });
      return;
    }

    await tx.like.create({
      data: {
        userId,
        postId: post.id,
      },
    });

    if (post.userId !== userId) {
      const existingNotification = await tx.notification.findFirst({
        where: {
          userId: post.userId,
          actorId: userId,
          type: "LIKE_ON_POST",
          targetType: "POST",
          targetId: post.id,
        },
        select: {
          id: true,
        },
      });

      if (!existingNotification) {
        await tx.notification.create({
          data: {
            userId: post.userId,
            actorId: userId,
            type: "LIKE_ON_POST",
            targetType: "POST",
            targetId: post.id,
          },
        });
        shouldSendLikePush = true;
      }
    }

    await tx.post.update({
      where: { id: post.id },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/v");
  revalidatePath("/notice");
  revalidatePath("/", "layout");
  revalidatePath(`/c/${publicId}`);

  if (shouldSendLikePush) {
    await sendWebPushToUser(post.userId, {
      body: `${user.username ?? "ユーザー"} さんが「${post.title}」にいいねしました`,
      title: "新しいいいね",
      url: `/c/${post.publicId}`,
    });
  }
}

export async function toggleBookmark(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const post = await getPostByPublicId(publicId);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.bookmark.findUnique({
      where: {
        userId_postId: {
          userId,
          postId: post.id,
        },
      },
    });

    if (existing) {
      await tx.bookmark.delete({
        where: {
          userId_postId: {
            userId,
            postId: post.id,
          },
        },
      });
      await tx.post.update({
        where: { id: post.id },
        data: {
          bookmarkCount: {
            decrement: 1,
          },
        },
      });
      return;
    }

    await tx.bookmark.create({
      data: {
        userId,
        postId: post.id,
      },
    });
    await tx.post.update({
      where: { id: post.id },
      data: {
        bookmarkCount: {
          increment: 1,
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/v");
  revalidatePath("/bookmarks");
  revalidatePath(`/c/${publicId}`);
}

export async function createComment(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const body = commentBodySchema.parse(formData.get("body"));
  const parentCommentId = z.string().trim().min(1).optional().parse(formData.get("parentCommentId") || undefined);
  const moderation = await assertNotBlockedByModerationRules(body);
  const post = await getPostByPublicId(publicId);
  let createdCommentId: string | null = null;
  let replyRecipientId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const parentComment = parentCommentId
      ? await tx.comment.findFirst({
          where: {
            id: parentCommentId,
            postId: post.id,
            status: "PUBLISHED",
          },
          select: {
            id: true,
            userId: true,
          },
        })
      : null;

    if (parentCommentId && !parentComment) {
      throw new Error("返信先のコメントが見つかりません。");
    }

    const comment = await tx.comment.create({
      data: {
        postId: post.id,
        userId,
        parentCommentId: parentComment?.id ?? null,
        body,
        status: "PUBLISHED",
      },
    });
    createdCommentId = comment.id;
    await tx.post.update({
      where: { id: post.id },
      data: {
        commentCount: {
          increment: 1,
        },
      },
    });

    if (moderation.reportable.length > 0) {
      await tx.report.create({
        data: {
          reporterId: userId,
          targetType: "COMMENT",
          targetId: comment.id,
          reason: "moderation_rule",
          detail: moderationReportDetail(moderation.reportable),
          status: "OPEN",
        },
      });
    }

    if (post.userId !== userId) {
      await tx.notification.create({
        data: {
          userId: post.userId,
          actorId: userId,
          type: "COMMENT_ON_POST",
          targetType: "COMMENT",
          targetId: comment.id,
        },
      });
    }

    if (parentComment && parentComment.userId !== userId && parentComment.userId !== post.userId) {
      replyRecipientId = parentComment.userId;
      await tx.notification.create({
        data: {
          userId: parentComment.userId,
          actorId: userId,
          type: "COMMENT_REPLY",
          targetType: "COMMENT",
          targetId: comment.id,
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/v");
  revalidatePath("/notice");
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/reports");
  revalidatePath(`/c/${publicId}`);

  if (post.userId !== userId && createdCommentId) {
    await sendWebPushToUser(post.userId, {
      body: `${user.username ?? "ユーザー"} さんが「${post.title}」にコメントしました`,
      title: "新しいコメント",
      url: `/c/${post.publicId}#comment-${createdCommentId}`,
    });
  }

  if (replyRecipientId && createdCommentId) {
    await sendWebPushToUser(replyRecipientId, {
      body: `${user.username ?? "ユーザー"} さんがあなたのコメントに返信しました`,
      title: "新しい返信",
      url: `/c/${post.publicId}#comment-${createdCommentId}`,
    });
  }
}

export async function updateComment(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const commentId = z.string().min(1).parse(formData.get("commentId"));
  const body = commentBodySchema.parse(formData.get("body"));
  const moderation = await assertNotBlockedByModerationRules(body);

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      userId,
      status: "PUBLISHED",
      post: {
        publicId,
      },
    },
    select: {
      id: true,
      postId: true,
    },
  });

  if (!comment) {
    throw new Error("編集できるコメントが見つかりません。");
  }

  await prisma.comment.update({
    where: {
      id: comment.id,
    },
    data: {
      body,
    },
  });

  if (moderation.reportable.length > 0) {
    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: "COMMENT",
        targetId: comment.id,
        reason: "moderation_rule",
        detail: moderationReportDetail(moderation.reportable),
        status: "OPEN",
      },
    });
  }

  revalidatePath("/v");
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/reports");
  revalidatePath(`/c/${publicId}`);
}

export async function deleteComment(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const commentId = z.string().min(1).parse(formData.get("commentId"));

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      userId,
      status: "PUBLISHED",
      post: {
        publicId,
      },
    },
    select: {
      id: true,
      postId: true,
    },
  });

  if (!comment) {
    throw new Error("コメントが見つかりません。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: comment.id },
      data: {
        status: "DELETED",
      },
    });
    await tx.post.update({
      where: { id: comment.postId },
      data: {
        commentCount: {
          decrement: 1,
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath(`/c/${publicId}`);
}

export async function deletePost(formData: FormData) {
  const user = await requireActiveUser();
  const publicId = publicIdSchema.parse(formData.get("publicId"));

  const post = await prisma.post.findFirst({
    where: {
      publicId,
      userId: user.id,
      status: {
        not: "DELETED",
      },
    },
    include: {
      game: {
        select: {
          slug: true,
        },
      },
      user: {
        select: {
          username: true,
        },
      },
      mediaItems: {
        select: {
          mediaUrl: true,
          thumbnailUrl: true,
          originalPath: true,
          processedPath: true,
        },
      },
    },
  });

  if (!post) {
    throw new Error("削除できる投稿が見つかりません。");
  }

  const retentionDays = await getDeletedFileRetentionDays();
  const deleteAfter = daysFromNow(retentionDays);
  const retentionPaths = new Set<string>();

  function addPath(filePath?: string | null) {
    if (filePath) {
      retentionPaths.add(filePath);
    }
  }

  function addMediaUrl(url?: string | null) {
    addPath(mediaUrlToProcessedPath(url));
  }

  addPath(post.originalFilePath);
  addPath(post.hlsPath ? path.dirname(post.hlsPath) : null);
  addMediaUrl(post.mediaUrl);
  addMediaUrl(post.thumbnailUrl);
  addMediaUrl(post.shareVideoUrl);

  for (const item of post.mediaItems) {
    addPath(item.originalPath);
    addPath(item.processedPath);
    addMediaUrl(item.mediaUrl);
    addMediaUrl(item.thumbnailUrl);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: {
        id: post.id,
      },
      data: {
        status: "DELETED",
        publishedAt: null,
      },
    });

    if (retentionPaths.size > 0) {
      await tx.mediaRetentionFile.createMany({
        data: Array.from(retentionPaths).map((filePath) => ({
          postId: post.id,
          path: filePath,
          reason: "DELETED_FILE",
          deleteAfter,
        })),
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/v");
  revalidatePath("/search");
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath(`/c/${post.publicId}`);
  revalidatePath(`/games/${post.game.slug}`);
  if (post.user.username) {
    revalidatePath(`/users/${post.user.username}`);
  }

  redirect(post.user.username ? `/users/${post.user.username}` : "/");
}

export async function createReport(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const reason = z.enum(["spam", "harassment", "nsfw_missing", "illegal", "other"]).parse(formData.get("reason"));
  const detail = z.string().trim().max(1000).optional().parse(formData.get("detail") || undefined);
  const post = await getPostByPublicId(publicId);

  await prisma.report.create({
    data: {
      reporterId: userId,
      targetType: "POST",
      targetId: post.id,
      reason,
      detail,
      status: "OPEN",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath(`/c/${publicId}`);
}

export async function createCommentReport(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const commentId = z.string().min(1).parse(formData.get("commentId"));
  const reason = z.enum(["spam", "harassment", "nsfw_missing", "illegal", "other"]).parse(formData.get("reason"));
  const detail = z.string().trim().max(1000).optional().parse(formData.get("detail") || undefined);

  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      status: "PUBLISHED",
      post: {
        publicId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
    },
    select: {
      id: true,
    },
  });

  if (!comment) {
    throw new Error("コメントが見つかりません。");
  }

  await prisma.report.create({
    data: {
      reporterId: userId,
      targetType: "COMMENT",
      targetId: comment.id,
      reason,
      detail,
      status: "OPEN",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath(`/c/${publicId}`);
}
