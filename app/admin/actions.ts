"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireModerator } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { prisma } from "@/lib/db/prisma";
import { fetchIgdbGameMetadata } from "@/lib/games/igdb";
import { slugify } from "@/lib/posts/slug";

const idSchema = z.string().min(1);
const reportStatusSchema = z.enum(["OPEN", "REVIEWING", "ACTION_TAKEN", "REJECTED", "CLOSED"]);
const reportActionSchema = z.enum(["HIDE_POST", "DELETE_COMMENT", "BAN_TARGET_USER"]);
const moderationRuleTypeSchema = z.enum(["ng_word", "blocked_url", "blocked_pattern"]);
const moderationRuleActionSchema = z.enum(["block", "report"]);
const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .or(z.literal(""))
  .transform((value) => value || null);

function parseCsv(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  );
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("外部IDは正の整数で入力してください。");
  }

  return parsed;
}

function parseOptionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("発売日は YYYY-MM-DD 形式で入力してください。");
  }

  return parsed;
}

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

export async function takeReportAction(formData: FormData) {
  const action = reportActionSchema.parse(formData.get("action"));
  const admin = action === "BAN_TARGET_USER" ? await requireAdmin() : await requireModerator();
  const reportId = idSchema.parse(formData.get("reportId"));
  const reason = z.string().trim().min(1).max(1000).parse(formData.get("reason"));

  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw new Error("通報が見つかりません。");
  }

  if (action === "HIDE_POST") {
    if (report.targetType !== "POST") {
      throw new Error("投稿通報だけ非公開化できます。");
    }

    const beforePost = await prisma.post.findUnique({
      where: { id: report.targetId },
    });

    if (!beforePost) {
      throw new Error("対象投稿が見つかりません。");
    }

    const afterPost = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: beforePost.id },
        data: { status: "HIDDEN" },
      });
      await tx.report.update({
        where: { id: report.id },
        data: {
          status: "ACTION_TAKEN",
          handledByAdminId: admin.id,
          handledAt: new Date(),
        },
      });
      return updatedPost;
    });

    await writeAuditLog({
      adminId: admin.id,
      action: "report.action.hide_post",
      targetType: "report",
      targetId: report.id,
      beforeData: { report, post: beforePost },
      afterData: { post: afterPost, reportStatus: "ACTION_TAKEN" },
      reason,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/posts");
    revalidatePath("/admin/reports");
    revalidatePath(`/c/${beforePost.publicId}`);
    return;
  }

  if (action === "DELETE_COMMENT") {
    if (report.targetType !== "COMMENT") {
      throw new Error("コメント通報だけ削除できます。");
    }

    const beforeComment = await prisma.comment.findUnique({
      where: { id: report.targetId },
      include: {
        post: true,
      },
    });

    if (!beforeComment) {
      throw new Error("対象コメントが見つかりません。");
    }

    const afterComment = await prisma.$transaction(async (tx) => {
      const updatedComment =
        beforeComment.status === "DELETED"
          ? beforeComment
          : await tx.comment.update({
              where: { id: beforeComment.id },
              data: {
                status: "DELETED",
                deletedByAdminId: admin.id,
              },
            });

      if (beforeComment.status !== "DELETED") {
        await tx.post.update({
          where: { id: beforeComment.postId },
          data: {
            commentCount: {
              decrement: 1,
            },
          },
        });
      }

      await tx.report.update({
        where: { id: report.id },
        data: {
          status: "ACTION_TAKEN",
          handledByAdminId: admin.id,
          handledAt: new Date(),
        },
      });

      return updatedComment;
    });

    await writeAuditLog({
      adminId: admin.id,
      action: "report.action.delete_comment",
      targetType: "report",
      targetId: report.id,
      beforeData: { report, comment: beforeComment },
      afterData: { comment: afterComment, reportStatus: "ACTION_TAKEN" },
      reason,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/comments");
    revalidatePath("/admin/reports");
    revalidatePath(`/c/${beforeComment.post.publicId}`);
    return;
  }

  let targetUserId: string | null = null;

  if (report.targetType === "USER") {
    targetUserId = report.targetId;
  }

  if (report.targetType === "POST") {
    const post = await prisma.post.findUnique({
      where: { id: report.targetId },
      select: { userId: true },
    });
    targetUserId = post?.userId ?? null;
  }

  if (report.targetType === "COMMENT") {
    const comment = await prisma.comment.findUnique({
      where: { id: report.targetId },
      select: { userId: true },
    });
    targetUserId = comment?.userId ?? null;
  }

  if (!targetUserId) {
    throw new Error("BAN対象ユーザーが見つかりません。");
  }

  const beforeUser = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!beforeUser) {
    throw new Error("BAN対象ユーザーが見つかりません。");
  }

  const afterUser = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: beforeUser.id },
      data: {
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
      },
    });
    await tx.report.update({
      where: { id: report.id },
      data: {
        status: "ACTION_TAKEN",
        handledByAdminId: admin.id,
        handledAt: new Date(),
      },
    });
    return updatedUser;
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "report.action.ban_target_user",
    targetType: "report",
    targetId: report.id,
    beforeData: { report, user: beforeUser },
    afterData: { user: afterUser, reportStatus: "ACTION_TAKEN" },
    reason,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/users");
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

  revalidatePath("/");
  revalidatePath("/admin");
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

export async function updateGameMetadata(formData: FormData) {
  const admin = await requireModerator();
  const gameId = idSchema.parse(formData.get("gameId"));
  const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
  const summary = z.string().trim().max(5000).optional().parse(formData.get("summary") || undefined) ?? null;
  const coverUrl = optionalUrlSchema.parse(formData.get("coverUrl") ?? "");
  const heroUrl = optionalUrlSchema.parse(formData.get("heroUrl") ?? "");
  const officialUrl = optionalUrlSchema.parse(formData.get("officialUrl") ?? "");
  const rawgSlug = z.string().trim().max(120).optional().parse(formData.get("rawgSlug") || undefined) ?? null;
  const igdbId = parseOptionalInt(formData.get("igdbId"));
  const steamAppId = parseOptionalInt(formData.get("steamAppId"));
  const releaseDate = parseOptionalDate(formData.get("releaseDate"));
  const genres = parseCsv(formData.get("genres"));
  const platforms = parseCsv(formData.get("platforms"));
  const isActive = formData.get("isActive") === "on";

  const before = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!before) {
    throw new Error("ゲームが見つかりません。");
  }

  const after = await prisma.game.update({
    where: { id: gameId },
    data: {
      name,
      summary,
      coverUrl,
      heroUrl,
      officialUrl,
      rawgSlug,
      igdbId,
      steamAppId,
      releaseDate,
      genres,
      platforms,
      isActive,
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "game.update_metadata",
    targetType: "game",
    targetId: gameId,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/games");
  revalidatePath(`/games/${after.slug}`);
}

export async function syncGameFromIgdb(formData: FormData) {
  const admin = await requireModerator();
  const gameId = idSchema.parse(formData.get("gameId"));

  const before = await prisma.game.findUnique({
    where: { id: gameId },
  });

  if (!before) {
    throw new Error("ゲームが見つかりません。");
  }

  const metadata = await fetchIgdbGameMetadata({
    igdbId: before.igdbId,
    name: before.name,
  });

  const after = await prisma.game.update({
    where: { id: gameId },
    data: {
      name: metadata.name,
      summary: metadata.summary,
      coverUrl: metadata.coverUrl,
      heroUrl: metadata.heroUrl,
      officialUrl: metadata.officialUrl,
      igdbId: metadata.igdbId,
      genres: metadata.genres,
      platforms: metadata.platforms,
      releaseDate: metadata.releaseDate,
      lastSyncedAt: new Date(),
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "game.sync_igdb",
    targetType: "game",
    targetId: gameId,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/games");
  revalidatePath(`/games/${after.slug}`);
}

export async function mergeGame(formData: FormData) {
  const admin = await requireModerator();
  const sourceGameId = idSchema.parse(formData.get("sourceGameId"));
  const targetGameId = idSchema.parse(formData.get("targetGameId"));

  if (sourceGameId === targetGameId) {
    throw new Error("同じゲームには統合できません。");
  }

  const [source, target] = await Promise.all([
    prisma.game.findUnique({
      where: { id: sourceGameId },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    }),
    prisma.game.findUnique({
      where: { id: targetGameId },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    }),
  ]);

  if (!source || !target) {
    throw new Error("統合するゲームが見つかりません。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.updateMany({
      where: {
        gameId: source.id,
      },
      data: {
        gameId: target.id,
      },
    });

    await tx.game.update({
      where: {
        id: source.id,
      },
      data: {
        isActive: false,
      },
    });
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "game.merge",
    targetType: "game",
    targetId: source.id,
    beforeData: source,
    afterData: {
      sourceGameId: source.id,
      sourceName: source.name,
      targetGameId: target.id,
      targetName: target.name,
      movedPostCount: source._count.posts,
    },
  });

  revalidatePath("/admin/games");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath(`/games/${source.slug}`);
  revalidatePath(`/games/${target.slug}`);
}

export async function updateTag(formData: FormData) {
  const admin = await requireModerator();
  const tagId = idSchema.parse(formData.get("tagId"));
  const name = z.string().trim().min(1).max(80).parse(formData.get("name"));
  const isActive = formData.get("isActive") === "on";
  const slug = slugify(name);

  if (!slug) {
    throw new Error("タグ名が不正です。");
  }

  const before = await prisma.tag.findUnique({
    where: { id: tagId },
  });

  if (!before) {
    throw new Error("タグが見つかりません。");
  }

  const existing = await prisma.tag.findUnique({
    where: { slug },
  });

  if (existing && existing.id !== tagId) {
    throw new Error("同じスラッグのタグが既にあります。統合を使ってください。");
  }

  const after = await prisma.tag.update({
    where: { id: tagId },
    data: {
      name,
      slug,
      isActive,
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "tag.update",
    targetType: "tag",
    targetId: tagId,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/tags");
  revalidatePath("/");
  revalidatePath("/search");
}

export async function mergeTag(formData: FormData) {
  const admin = await requireModerator();
  const sourceTagId = idSchema.parse(formData.get("sourceTagId"));
  const targetTagId = idSchema.parse(formData.get("targetTagId"));

  if (sourceTagId === targetTagId) {
    throw new Error("同じタグには統合できません。");
  }

  const [source, target] = await Promise.all([
    prisma.tag.findUnique({
      where: { id: sourceTagId },
      include: {
        posts: true,
      },
    }),
    prisma.tag.findUnique({
      where: { id: targetTagId },
      include: {
        posts: true,
      },
    }),
  ]);

  if (!source || !target) {
    throw new Error("統合するタグが見つかりません。");
  }

  const targetPostIds = new Set(target.posts.map((postTag) => postTag.postId));

  await prisma.$transaction(async (tx) => {
    for (const postTag of source.posts) {
      if (targetPostIds.has(postTag.postId)) {
        await tx.postTag.delete({
          where: {
            postId_tagId: {
              postId: postTag.postId,
              tagId: source.id,
            },
          },
        });
        continue;
      }

      await tx.postTag.update({
        where: {
          postId_tagId: {
            postId: postTag.postId,
            tagId: source.id,
          },
        },
        data: {
          tagId: target.id,
        },
      });
    }

    await tx.tag.update({
      where: { id: source.id },
      data: {
        isActive: false,
      },
    });
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "tag.merge",
    targetType: "tag",
    targetId: source.id,
    beforeData: source,
    afterData: {
      sourceTagId: source.id,
      sourceName: source.name,
      targetTagId: target.id,
      targetName: target.name,
      movedPostCount: source.posts.length,
    },
  });

  revalidatePath("/admin/tags");
  revalidatePath("/");
  revalidatePath("/search");
}

export async function createModerationRule(formData: FormData) {
  const admin = await requireModerator();
  const type = moderationRuleTypeSchema.parse(formData.get("type"));
  const action = moderationRuleActionSchema.parse(formData.get("action"));
  const pattern = z.string().trim().min(1).max(191).parse(formData.get("pattern"));

  const created = await prisma.moderationRule.create({
    data: {
      type,
      action,
      pattern,
      isActive: true,
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "moderation_rule.create",
    targetType: "moderation_rule",
    targetId: created.id,
    afterData: created,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
}

export async function toggleModerationRule(formData: FormData) {
  const admin = await requireModerator();
  const ruleId = idSchema.parse(formData.get("ruleId"));
  const isActive = formData.get("isActive") === "true";

  const before = await prisma.moderationRule.findUnique({
    where: {
      id: ruleId,
    },
  });

  if (!before) {
    throw new Error("モデレーションルールが見つかりません。");
  }

  const after = await prisma.moderationRule.update({
    where: {
      id: ruleId,
    },
    data: {
      isActive,
    },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: isActive ? "moderation_rule.enable" : "moderation_rule.disable",
    targetType: "moderation_rule",
    targetId: ruleId,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
}
