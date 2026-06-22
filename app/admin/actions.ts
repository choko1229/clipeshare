"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireModerator } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { prisma } from "@/lib/db/prisma";

const idSchema = z.string().min(1);
const reportStatusSchema = z.enum(["OPEN", "REVIEWING", "ACTION_TAKEN", "REJECTED", "CLOSED"]);

export async function updateReportStatus(formData: FormData) {
  const admin = await requireModerator();
  const reportId = idSchema.parse(formData.get("reportId"));
  const status = reportStatusSchema.parse(formData.get("status"));
  const reason = z.string().trim().max(1000).optional().parse(formData.get("reason") || undefined);

  const before = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!before) {
    throw new Error("通報が見つかりません。");
  }

  const after = await prisma.report.update({
    where: { id: reportId },
    data: {
      status,
      handledByAdminId: admin.id,
      handledAt: new Date(),
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "report.update_status",
    targetType: "report",
    targetId: reportId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
}

export async function hidePost(formData: FormData) {
  const admin = await requireModerator();
  const postId = idSchema.parse(formData.get("postId"));
  const reason = z.string().trim().max(1000).optional().parse(formData.get("reason") || undefined);

  const before = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!before) {
    throw new Error("投稿が見つかりません。");
  }

  const after = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "HIDDEN",
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "post.hide",
    targetType: "post",
    targetId: postId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath(`/c/${before.publicId}`);
}

export async function restorePost(formData: FormData) {
  const admin = await requireModerator();
  const postId = idSchema.parse(formData.get("postId"));
  const reason = z.string().trim().max(1000).optional().parse(formData.get("reason") || undefined);

  const before = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!before) {
    throw new Error("投稿が見つかりません。");
  }

  const after = await prisma.post.update({
    where: { id: postId },
    data: {
      status: before.visibility === "PUBLIC" ? "PUBLISHED" : "PRIVATE",
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "post.restore",
    targetType: "post",
    targetId: postId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/");
  revalidatePath("/admin/posts");
  revalidatePath(`/c/${before.publicId}`);
}

export async function togglePostNsfw(formData: FormData) {
  const admin = await requireModerator();
  const postId = idSchema.parse(formData.get("postId"));
  const isNsfw = formData.get("isNsfw") === "true";
  const reason = z.string().trim().max(1000).optional().parse(formData.get("reason") || undefined);

  const before = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!before) {
    throw new Error("投稿が見つかりません。");
  }

  const after = await prisma.post.update({
    where: { id: postId },
    data: {
      isNsfw,
      nsfwSetByAdminId: admin.id,
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: isNsfw ? "post.mark_nsfw" : "post.unmark_nsfw",
    targetType: "post",
    targetId: postId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/");
  revalidatePath("/admin/posts");
  revalidatePath(`/c/${before.publicId}`);
}

export async function deleteCommentByAdmin(formData: FormData) {
  const admin = await requireModerator();
  const commentId = idSchema.parse(formData.get("commentId"));
  const reason = z.string().trim().max(1000).optional().parse(formData.get("reason") || undefined);

  const before = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      post: true,
    },
  });

  if (!before || before.status === "DELETED") {
    throw new Error("コメントが見つかりません。");
  }

  const after = await prisma.$transaction(async (tx) => {
    const updatedComment = await tx.comment.update({
      where: { id: commentId },
      data: {
        status: "DELETED",
        deletedByAdminId: admin.id,
      },
    });
    await tx.post.update({
      where: { id: before.postId },
      data: {
        commentCount: {
          decrement: 1,
        },
      },
    });
    return updatedComment;
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "comment.delete",
    targetType: "comment",
    targetId: commentId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/admin/comments");
  revalidatePath(`/c/${before.post.publicId}`);
}

export async function banUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = idSchema.parse(formData.get("userId"));
  const reason = z.string().trim().min(1).max(1000).parse(formData.get("reason"));

  const before = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!before) {
    throw new Error("ユーザーが見つかりません。");
  }

  const after = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      banReason: reason,
      bannedAt: new Date(),
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "user.ban",
    targetType: "user",
    targetId: userId,
    beforeData: before,
    afterData: after,
    reason,
  });

  revalidatePath("/admin/users");
}
