"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { assertNotBlockedByModerationRules, moderationReportDetail } from "@/lib/moderation/rules";

const publicIdSchema = z.string().min(1).max(64);

async function requireUserId() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session.user.id;
}

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
    },
  });

  if (!post) {
    throw new Error("投稿が見つかりません。");
  }

  return post;
}

export async function toggleLike(formData: FormData) {
  const userId = await requireUserId();
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const post = await getPostByPublicId(publicId);

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
  revalidatePath(`/c/${publicId}`);
}

export async function toggleBookmark(formData: FormData) {
  const userId = await requireUserId();
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
  revalidatePath("/bookmarks");
  revalidatePath(`/c/${publicId}`);
}

export async function createComment(formData: FormData) {
  const userId = await requireUserId();
  const publicId = publicIdSchema.parse(formData.get("publicId"));
  const body = z.string().trim().min(1).max(1000).parse(formData.get("body"));
  const moderation = await assertNotBlockedByModerationRules(body);
  const post = await getPostByPublicId(publicId);

  await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        postId: post.id,
        userId,
        body,
        status: "PUBLISHED",
      },
    });
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
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/comments");
  revalidatePath("/admin/reports");
  revalidatePath(`/c/${publicId}`);
}

export async function deleteComment(formData: FormData) {
  const userId = await requireUserId();
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

export async function createReport(formData: FormData) {
  const userId = await requireUserId();
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
  const userId = await requireUserId();
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
