"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { inferGameName } from "@/lib/games/infer-game";
import { storeScreenshotImage } from "@/lib/media/images";
import { storeOriginalVideo } from "@/lib/media/videos";
import { splitPostBody } from "@/lib/posts/post-body";
import { parseTags, slugify } from "@/lib/posts/slug";

const createPostSchema = z.object({
  bodyText: z.string().min(1).max(4200),
  gameName: z.string().trim().max(120).optional(),
  tags: z.string().trim().max(300).optional(),
  postType: z.enum(["SCREENSHOT", "CLIP"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  isNsfw: z.boolean().default(false),
});

export async function createPost(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const parsed = createPostSchema.parse({
    bodyText: formData.get("bodyText"),
    gameName: formData.get("gameName"),
    tags: formData.get("tags") ?? "",
    postType: formData.get("postType") === "CLIP" ? "CLIP" : "SCREENSHOT",
    visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    isNsfw: formData.get("isNsfw") === "on",
  });

  const media = formData.get("media");
  if (!(media instanceof File) || media.size === 0) {
    throw new Error("メディアファイルを選択してください。");
  }

  const { title, description } = splitPostBody(parsed.bodyText);
  const gameName = await resolveGameName({
    inputGameName: parsed.gameName,
    bodyText: parsed.bodyText,
    tags: parsed.tags ?? "",
    fileName: media.name,
  });
  const publicId = nanoid(12);
  const gameSlug = slugify(gameName) || nanoid(8);
  const tagNames = parseTags(parsed.tags ?? "");

  if (parsed.postType === "SCREENSHOT") {
    const storedImage = await storeScreenshotImage(media, publicId);
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
      thumbnailUrl: storedImage.thumbnailUrl,
      mediaUrl: storedImage.mediaUrl,
      originalFilePath: storedImage.originalPath,
      fileSizeBytes: BigInt(storedImage.size),
      width: storedImage.width,
      height: storedImage.height,
    });
    redirect(`/c/${post.publicId}`);
  }

  const storedVideo = await storeOriginalVideo(media, publicId);
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
      status: "QUEUED",
    },
  });

  redirect(`/c/${post.publicId}`);
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
    throw new Error("ゲーム名を入力してください。既存ゲーム名が本文、タグ、ファイル名から推定できませんでした。");
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
