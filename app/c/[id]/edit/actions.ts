"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { assertNotBlockedByModerationRules, moderationReportDetail } from "@/lib/moderation/rules";
import { splitPostBody } from "@/lib/posts/post-body";
import { parseTags, slugify } from "@/lib/posts/slug";

const updatePostSchema = z.object({
  publicId: z.string().min(1).max(64),
  bodyText: z.string().min(1).max(4200),
  gameName: z.string().trim().min(1).max(120),
  tags: z.string().trim().max(300).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  isNsfw: z.boolean(),
  rankName: z.string().trim().max(80).optional(),
  discordServerName: z.string().trim().max(120).optional(),
  customText: z.string().trim().max(1000).optional(),
});

export async function updatePost(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = updatePostSchema.parse({
    publicId: formData.get("publicId"),
    bodyText: formData.get("bodyText"),
    gameName: formData.get("gameName"),
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    isNsfw: formData.get("isNsfw") === "on",
    rankName: formData.get("rankName") || undefined,
    discordServerName: formData.get("discordServerName") || undefined,
    customText: formData.get("customText") || undefined,
  });

  const post = await prisma.post.findFirst({
    where: {
      publicId: parsed.publicId,
      userId: session.user.id,
      status: {
        notIn: ["HIDDEN", "DELETED"],
      },
    },
    select: {
      id: true,
      publicId: true,
      status: true,
      publishedAt: true,
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
    },
  });

  if (!post) {
    throw new Error("編集できる投稿が見つかりません。");
  }

  const gameSlug = slugify(parsed.gameName) || nanoid(8);
  const { title, description } = splitPostBody(parsed.bodyText);
  const moderation = await assertNotBlockedByModerationRules(`${parsed.bodyText}\n${parsed.tags ?? ""}`);
  const tagNames = parseTags(parsed.tags ?? "");
  const nextStatus =
    parsed.visibility === "PRIVATE" ? "PRIVATE" : post.status === "PROCESSING" || post.status === "FAILED" ? post.status : "PUBLISHED";
  const nextPublishedAt =
    parsed.visibility === "PRIVATE" ? null : nextStatus === "PUBLISHED" && !post.publishedAt ? new Date() : post.publishedAt;

  await prisma.$transaction(async (tx) => {
    const game = await tx.game.upsert({
      where: {
        slug: gameSlug,
      },
      update: {
        name: parsed.gameName,
      },
      create: {
        name: parsed.gameName,
        slug: gameSlug,
      },
    });

    await tx.post.update({
      where: {
        id: post.id,
      },
      data: {
        title,
        description,
        gameId: game.id,
        visibility: parsed.visibility,
        status: nextStatus,
        publishedAt: nextPublishedAt,
        isNsfw: parsed.isNsfw,
        rankName: parsed.rankName || null,
        discordServerName: parsed.discordServerName || null,
        customFields: parsed.customText ? { note: parsed.customText } : Prisma.JsonNull,
      },
    });

    await tx.postTag.deleteMany({
      where: {
        postId: post.id,
      },
    });

    for (const tagName of tagNames) {
      const tagSlug = slugify(tagName);
      if (!tagSlug) {
        continue;
      }

      const tag = await tx.tag.upsert({
        where: {
          slug: tagSlug,
        },
        update: {
          name: tagName,
        },
        create: {
          name: tagName,
          slug: tagSlug,
        },
      });

      await tx.postTag.create({
        data: {
          postId: post.id,
          tagId: tag.id,
        },
      });
    }
  });

  if (moderation.reportable.length > 0) {
    await prisma.report.create({
      data: {
        reporterId: session.user.id,
        targetType: "POST",
        targetId: post.id,
        reason: "moderation_rule",
        detail: moderationReportDetail(moderation.reportable),
        status: "OPEN",
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/search");
  revalidatePath(`/c/${post.publicId}`);
  revalidatePath(`/c/${post.publicId}/edit`);
  revalidatePath(`/games/${post.game.slug}`);
  revalidatePath(`/games/${gameSlug}`);
  if (post.user.username) {
    revalidatePath(`/users/${post.user.username}`);
  }

  redirect(`/c/${post.publicId}`);
}
