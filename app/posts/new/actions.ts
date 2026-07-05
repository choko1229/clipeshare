"use server";

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { z } from "zod";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { inferGameName } from "@/lib/games/infer-game";
import { storeScreenshotImage } from "@/lib/media/images";
import { storeOriginalVideo } from "@/lib/media/videos";
import { assertNotBlockedByModerationRules, moderationReportDetail } from "@/lib/moderation/rules";
import { splitPostBody } from "@/lib/posts/post-body";
import { extractHashTags, slugify } from "@/lib/posts/slug";
import { assertDailyUploadLimit, getUploadLimitsForUser } from "@/lib/uploads/account-limits";
import { detectMediaKind } from "@/lib/uploads/file-kind";
import { syncUserAccountLevel } from "@/lib/users/account-levels";

const createPostSchema = z.object({
  bodyText: z.string().min(1).max(4200),
  clipEndSeconds: z.coerce.number().finite().min(0).optional(),
  clipStartSeconds: z.coerce.number().finite().min(0).optional(),
  gameName: z.string().trim().max(120).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  isNsfw: z.boolean().default(false),
}).refine((value) => value.clipEndSeconds === undefined || value.clipStartSeconds === undefined || value.clipEndSeconds > value.clipStartSeconds, {
  message: "動画の終了秒は開始秒より後にしてください。",
});

export async function createPost(formData: FormData) {
  const returnTo = safeReturnTo(formData.get("returnTo"), "/posts/new");

  try {
    const redirectUrl = await createPostInternal(formData);
    redirect(redirectUrl);
  } catch (error) {
    redirect(errorRedirectUrl(returnTo, error));
  }
}

async function createPostInternal(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;

  const parsed = createPostSchema.parse({
    bodyText: formData.get("bodyText"),
    clipEndSeconds: optionalNumberFormValue(formData.get("clipEndSeconds")),
    clipStartSeconds: optionalNumberFormValue(formData.get("clipStartSeconds")),
    gameName: formData.get("gameName"),
    visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    isNsfw: formData.get("isNsfw") === "on",
  });

  const mediaFiles = formData.getAll("media").filter((item): item is File => item instanceof File && item.size > 0);
  if (mediaFiles.length === 0) {
    throw new Error("メディアファイルを選択してください。");
  }

  const mediaKinds = mediaFiles.map((file) => detectMediaKind(file));
  if (mediaKinds.some((kind) => !kind)) {
    throw new Error("対応している画像または動画ファイルを選択してください。");
  }

  const hasVideo = mediaKinds.includes("CLIP");
  const hasImage = mediaKinds.includes("SCREENSHOT");
  if (hasVideo && mediaFiles.length > 1) {
    throw new Error("動画投稿で選択できる動画は1本のみです。");
  }

  if (hasVideo && hasImage) {
    throw new Error("動画と画像を同時に投稿することはできません。");
  }

  const media = mediaFiles[0];
  const postType = detectMediaKind(media);
  if (!postType) {
    throw new Error("対応している画像または動画ファイルを選択してください。");
  }

  await syncUserAccountLevel(userId);
  const uploadLimits = await getUploadLimitsForUser(userId);
  await assertDailyUploadLimit(userId, uploadLimits);

  const { title, description } = splitPostBody(parsed.bodyText);
  const moderation = await assertNotBlockedByModerationRules(parsed.bodyText);
  const gameName = await resolveGameName({
    inputGameName: parsed.gameName,
    bodyText: parsed.bodyText,
    tags: "",
    fileName: media.name,
  });
  const publicId = nanoid(12);
  const gameSlug = slugify(gameName) || nanoid(8);
  const tagNames = extractHashTags(parsed.bodyText);

  if (postType === "SCREENSHOT") {
    if (mediaFiles.length > uploadLimits.maxImagesPerPost) {
      throw new Error(`画像は現在のアカウントレベルでは最大${uploadLimits.maxImagesPerPost}枚まで投稿できます。`);
    }

    const storedImages = await Promise.all(
      mediaFiles.map((imageFile, index) =>
        storeScreenshotImage(imageFile, `${publicId}-${index + 1}`, {
          maxImageSizeBytes: uploadLimits.maxImageSizeBytes,
        }),
      ),
    );
    const firstImage = storedImages[0];
    const post = await createBasePost({
      publicId,
      userId,
      gameName,
      gameSlug,
      tagNames,
      type: "SCREENSHOT",
      title,
      description,
      visibility: parsed.visibility,
      isNsfw: parsed.isNsfw,
      thumbnailUrl: firstImage.thumbnailUrl,
      mediaUrl: firstImage.mediaUrl,
      originalFilePath: firstImage.originalPath,
      fileSizeBytes: BigInt(storedImages.reduce((sum, image) => sum + image.size, 0)),
      width: firstImage.width,
      height: firstImage.height,
      mediaItems: storedImages.map((image, index) => ({
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
    await createAutoReportForPost(userId, post.id, moderation.reportable);
    await syncUserAccountLevel(userId);
    return `/c/${post.publicId}`;
  }

  const storedVideo = await storeOriginalVideo(media, publicId, {
    maxVideoSizeBytes: uploadLimits.maxVideoSizeBytes,
  });
  const post = await createBasePost({
    publicId,
    userId,
    gameName,
    gameSlug,
    tagNames,
    type: "CLIP",
    title,
    description,
    visibility: parsed.visibility,
    isNsfw: parsed.isNsfw,
    thumbnailUrl: "/images/processing-placeholder.svg",
    mediaUrl: null,
    originalFilePath: storedVideo.originalPath,
    fileSizeBytes: BigInt(storedVideo.size),
    width: null,
    height: null,
  });

  await prisma.uploadJob.create({
    data: {
      postId: post.id,
      inputPath: storedVideo.originalPath,
      clipStartSeconds: parsed.clipStartSeconds,
      clipEndSeconds: parsed.clipEndSeconds,
      status: "QUEUED",
    },
  });

  await createAutoReportForPost(userId, post.id, moderation.reportable);
  await syncUserAccountLevel(userId);

  return `/c/${post.publicId}`;
}

function safeReturnTo(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function optionalNumberFormValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  return value;
}

async function createAutoReportForPost(userId: string, postId: string, matches: { type: string; pattern: string }[]) {
  if (matches.length === 0) {
    return;
  }

  await prisma.report.create({
    data: {
      reporterId: userId,
      targetType: "POST",
      targetId: postId,
      reason: "moderation_rule",
      detail: moderationReportDetail(matches.map((match) => ({ ...match, ruleId: "", action: "report" }))),
      status: "OPEN",
    },
  });
}

type ResolveGameNameInput = {
  inputGameName?: string;
  bodyText: string;
  tags: string;
  fileName: string;
};

async function resolveGameName(input: ResolveGameNameInput) {
  if (input.inputGameName?.trim()) {
    return input.inputGameName.trim();
  }

  const games = await prisma.game.findMany({
    where: {
      isActive: true,
    },
    select: {
      name: true,
      slug: true,
      aliases: true,
    },
    take: 200,
  });
  const inferred = inferGameName(`${input.bodyText}\n${input.tags}\n${input.fileName}`, games);

  if (!inferred) {
    throw new Error("ゲーム名を入力してください。既存ゲーム名を本文、タグ、ファイル名から推定できませんでした。");
  }

  return inferred;
}

type CreateBasePostInput = {
  publicId: string;
  userId: string;
  gameName: string;
  gameSlug: string;
  tagNames: string[];
  type: "CLIP" | "SCREENSHOT";
  title: string;
  description: string;
  visibility: "PUBLIC" | "PRIVATE";
  isNsfw: boolean;
  thumbnailUrl: string;
  mediaUrl: string | null;
  originalFilePath: string;
  fileSizeBytes: bigint;
  width: number | null;
  height: number | null;
  mediaItems?: {
    type: "CLIP" | "SCREENSHOT";
    sortOrder: number;
    mediaUrl: string;
    thumbnailUrl: string | null;
    originalPath: string | null;
    processedPath: string | null;
    fileSizeBytes: bigint;
    width: number | null;
    height: number | null;
  }[];
};

async function createBasePost(input: CreateBasePostInput) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.upsert({
      where: { slug: input.gameSlug },
      update: { name: input.gameName },
      create: {
        name: input.gameName,
        slug: input.gameSlug,
      },
    });

    const isProcessingClip = input.type === "CLIP";
    const createdPost = await tx.post.create({
      data: {
        publicId: input.publicId,
        userId: input.userId,
        gameId: game.id,
        type: input.type,
        title: input.title,
        description: input.description,
        status: isProcessingClip ? "PROCESSING" : input.visibility === "PUBLIC" ? "PUBLISHED" : "PRIVATE",
        visibility: input.visibility,
        thumbnailUrl: input.thumbnailUrl,
        mediaUrl: input.mediaUrl,
        originalFilePath: input.originalFilePath,
        fileSizeBytes: input.fileSizeBytes,
        width: input.width,
        height: input.height,
        isNsfw: input.isNsfw,
        publishedAt: isProcessingClip || input.visibility !== "PUBLIC" ? null : new Date(),
        mediaItems: input.mediaItems?.length
          ? {
              create: input.mediaItems,
            }
          : undefined,
      },
    });

    for (const tagName of input.tagNames) {
      const tagSlug = slugify(tagName);
      if (!tagSlug) {
        continue;
      }

      const tag = await tx.tag.upsert({
        where: { slug: tagSlug },
        update: { name: tagName },
        create: {
          name: tagName,
          slug: tagSlug,
        },
      });

      await tx.postTag.create({
        data: {
          postId: createdPost.id,
          tagId: tag.id,
        },
      });
    }

    return createdPost;
  });
}
