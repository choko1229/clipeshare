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
