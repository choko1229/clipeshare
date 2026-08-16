"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { storeScreenshotImage, storeThumbnailImage } from "@/lib/media/images";
import { storeOriginalVideo } from "@/lib/media/videos";
import { daysFromNow, getReplacedFileRetentionDays, mediaUrlToProcessedPath, scheduleMediaRetention } from "@/lib/media/retention";
import { assertNotBlockedByModerationRules, moderationReportDetail } from "@/lib/moderation/rules";
import { splitPostBody } from "@/lib/posts/post-body";
import { extractHashTags, slugify } from "@/lib/posts/slug";
import { detectMediaKind } from "@/lib/uploads/file-kind";
import { getUploadLimitsForUser } from "@/lib/uploads/account-limits";

const updatePostSchema = z.object({
  publicId: z.string().min(1).max(64),
  bodyText: z.string().min(1).max(4200),
  gameName: z.string().trim().min(1).max(120),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  isNsfw: z.boolean(),
  rankName: z.string().trim().max(80).optional(),
  discordServerName: z.string().trim().max(120).optional(),
  customText: z.string().trim().max(1000).optional(),
});

export async function updatePost(formData: FormData) {
  const publicId = typeof formData.get("publicId") === "string" ? String(formData.get("publicId")) : "";
  const fallback = publicId ? `/c/${publicId}/edit` : "/";

  try {
    const redirectUrl = await updatePostInternal(formData);
    redirect(redirectUrl);
  } catch (error) {
    redirect(errorRedirectUrl(fallback, error));
  }
}

async function updatePostInternal(formData: FormData) {
  const user = await requireActiveUser();

  const parsed = updatePostSchema.parse({
    publicId: formData.get("publicId"),
    bodyText: formData.get("bodyText"),
    gameName: formData.get("gameName"),
    visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    isNsfw: formData.get("isNsfw") === "on",
    rankName: formData.get("rankName") || undefined,
    discordServerName: formData.get("discordServerName") || undefined,
    customText: formData.get("customText") || undefined,
  });

  const post = await prisma.post.findFirst({
    where: {
      publicId: parsed.publicId,
      userId: user.id,
      status: {
        notIn: ["HIDDEN", "DELETED"],
      },
    },
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      publishedAt: true,
      thumbnailUrl: true,
      shareVideoUrl: true,
      originalFilePath: true,
      hlsPath: true,
      gameId: true,
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
      uploadJobs: {
        where: {
          status: {
            in: ["QUEUED", "PROCESSING"],
          },
        },
        select: {
          id: true,
        },
      },
      mediaItems: {
        select: {
          originalPath: true,
          processedPath: true,
          thumbnailUrl: true,
        },
      },
    },
  });

  if (!post) {
    throw new Error("編集できる投稿が見つかりません。");
  }

  const mediaFiles = formData.getAll("media").filter((item): item is File => item instanceof File && item.size > 0);

  let videoReplacement: { originalPath: string; size: number; clipStartSeconds?: number; clipEndSeconds?: number } | null = null;
  let imageReplacement: Awaited<ReturnType<typeof storeScreenshotImage>>[] | null = null;

  if (mediaFiles.length > 0) {
    if (post.type === "CLIP") {
      if (post.uploadJobs.length > 0) {
        throw new Error("処理中の動画があるため、完了してから差し替えてください。");
      }
      if (mediaFiles.length > 1) {
        throw new Error("動画は1本のみ差し替えできます。");
      }
      const videoFile = mediaFiles[0];
      if (detectMediaKind(videoFile) !== "CLIP") {
        throw new Error("動画ファイルを選択してください。");
      }

      const videoUploadLimits = await getUploadLimitsForUser(user.id);
      const stored = await storeOriginalVideo(videoFile, post.publicId, {
        maxVideoSizeBytes: videoUploadLimits.maxVideoSizeBytes,
      });
      videoReplacement = {
        originalPath: stored.originalPath,
        size: stored.size,
        clipStartSeconds: optionalNumberFormValue(formData.get("clipStartSeconds")),
        clipEndSeconds: optionalNumberFormValue(formData.get("clipEndSeconds")),
      };
    } else {
      if (mediaFiles.some((file) => detectMediaKind(file) !== "SCREENSHOT")) {
        throw new Error("画像ファイルを選択してください。");
      }

      const imageUploadLimits = await getUploadLimitsForUser(user.id);
      if (mediaFiles.length > imageUploadLimits.maxImagesPerPost) {
        throw new Error(`画像は現在のアカウントレベルでは最大${imageUploadLimits.maxImagesPerPost}枚まで投稿できます。`);
      }

      imageReplacement = await Promise.all(
        mediaFiles.map((file, index) =>
          storeScreenshotImage(file, `${post.publicId}-edit-${Date.now()}-${index + 1}`, {
            maxImageSizeBytes: imageUploadLimits.maxImageSizeBytes,
          }),
        ),
      );
    }
  }

  const gameSlug = slugify(parsed.gameName) || nanoid(8);
  const { title, description } = splitPostBody(parsed.bodyText);
  const moderation = await assertNotBlockedByModerationRules(parsed.bodyText);
  const tagNames = extractHashTags(parsed.bodyText);
  const gameFields = await prisma.gameField.findMany({
    where: {
      gameId: post.gameId,
      isActive: true,
    },
  });
  const customFieldValues: Record<string, string | number> = {};
  for (const field of gameFields) {
    const raw = formData.get(`customField:${field.key}`);
    if (typeof raw !== "string" || !raw.trim()) {
      continue;
    }

    if (field.inputType === "NUMBER") {
      const numberValue = Number(raw);
      if (Number.isFinite(numberValue)) {
        customFieldValues[field.key] = numberValue;
      }
      continue;
    }

    customFieldValues[field.key] = raw.trim();
  }
  const customFields = {
    ...customFieldValues,
    ...(parsed.customText ? { note: parsed.customText } : {}),
  };
  const thumbnailFile = formData.get("thumbnail");
  const thumbnailUploadLimits =
    thumbnailFile instanceof File && thumbnailFile.size > 0 && post.type === "CLIP" ? await getUploadLimitsForUser(user.id) : null;
  const storedThumbnail =
    thumbnailFile instanceof File && thumbnailFile.size > 0 && post.type === "CLIP"
      ? await storeThumbnailImage(thumbnailFile, post.publicId, {
          maxImageSizeBytes: thumbnailUploadLimits?.maxImageSizeBytes ?? 0,
        })
      : null;
  const nextStatus = videoReplacement
    ? "PROCESSING"
    : parsed.visibility === "PRIVATE"
      ? "PRIVATE"
      : post.status === "PROCESSING" || post.status === "FAILED"
        ? post.status
        : "PUBLISHED";
  const nextPublishedAt = videoReplacement
    ? null
    : parsed.visibility === "PRIVATE"
      ? null
      : nextStatus === "PUBLISHED" && !post.publishedAt
        ? new Date()
        : post.publishedAt;

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
        customFields: Object.keys(customFields).length > 0 ? customFields : Prisma.JsonNull,
        ...(videoReplacement
          ? {
              mediaUrl: null,
              shareVideoUrl: null,
              hlsPath: null,
              durationSeconds: null,
              width: null,
              height: null,
              originalFilePath: videoReplacement.originalPath,
              fileSizeBytes: BigInt(videoReplacement.size),
              thumbnailUrl: "/images/processing-placeholder.svg",
            }
          : {}),
        ...(imageReplacement
          ? {
              thumbnailUrl: imageReplacement[0].thumbnailUrl,
              mediaUrl: imageReplacement[0].mediaUrl,
              originalFilePath: imageReplacement[0].originalPath,
              fileSizeBytes: BigInt(imageReplacement.reduce((sum, image) => sum + image.size, 0)),
              width: imageReplacement[0].width,
              height: imageReplacement[0].height,
            }
          : {}),
        ...(storedThumbnail ? { thumbnailUrl: storedThumbnail.thumbnailUrl } : {}),
      },
    });

    if (videoReplacement) {
      await tx.uploadJob.create({
        data: {
          postId: post.id,
          inputPath: videoReplacement.originalPath,
          clipStartSeconds: videoReplacement.clipStartSeconds,
          clipEndSeconds: videoReplacement.clipEndSeconds,
          status: "QUEUED",
        },
      });
    }

    if (imageReplacement) {
      await tx.postMedia.deleteMany({
        where: {
          postId: post.id,
        },
      });
      await tx.postMedia.createMany({
        data: imageReplacement.map((image, index) => ({
          postId: post.id,
          type: "SCREENSHOT" as const,
          sortOrder: index,
          mediaUrl: image.mediaUrl,
          thumbnailUrl: image.thumbnailUrl,
          originalPath: image.originalPath,
          processedPath: image.processedPath,
          fileSizeBytes: BigInt(image.size),
          width: image.width,
          height: image.height,
        })),
      });
    }

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

  const retentionDays = await getReplacedFileRetentionDays();
  const deleteAfter = daysFromNow(retentionDays);
  const retentionPaths = new Set<string>();

  function addRetentionPath(filePath?: string | null) {
    if (filePath) {
      retentionPaths.add(filePath);
    }
  }

  if (storedThumbnail) {
    addRetentionPath(mediaUrlToProcessedPath(post.thumbnailUrl));
  }

  if (videoReplacement) {
    addRetentionPath(post.originalFilePath);
    addRetentionPath(post.hlsPath ? path.dirname(post.hlsPath) : null);
    addRetentionPath(mediaUrlToProcessedPath(post.shareVideoUrl));
    if (!storedThumbnail) {
      addRetentionPath(mediaUrlToProcessedPath(post.thumbnailUrl));
    }
  }

  if (imageReplacement) {
    addRetentionPath(post.originalFilePath);
    for (const item of post.mediaItems) {
      addRetentionPath(item.originalPath);
      addRetentionPath(item.processedPath);
      addRetentionPath(mediaUrlToProcessedPath(item.thumbnailUrl));
    }
  }

  for (const filePath of retentionPaths) {
    await scheduleMediaRetention({
      postId: post.id,
      path: filePath,
      reason: "REPLACED_FILE",
      deleteAfter,
    });
  }

  if (moderation.reportable.length > 0) {
    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: "POST",
        targetId: post.id,
        reason: "moderation_rule",
        detail: moderationReportDetail(moderation.reportable),
        status: "OPEN",
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/v");
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

  return `/c/${post.publicId}`;
}

function optionalNumberFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
