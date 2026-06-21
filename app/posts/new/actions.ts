"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { storeScreenshotImage } from "@/lib/media/images";
import { parseTags, slugify } from "@/lib/posts/slug";

const createScreenshotSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  gameName: z.string().trim().min(1).max(120),
  tags: z.string().trim().max(300).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  isNsfw: z.boolean().default(false),
});

export async function createScreenshotPost(formData: FormData) {
  const session = await getServerSession(authOptions);

  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    throw new Error("画像ファイルを選択してください。");
  }

  const parsed = createScreenshotSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    gameName: formData.get("gameName"),
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    isNsfw: formData.get("isNsfw") === "on",
  });

  const publicId = nanoid(12);
  const storedImage = await storeScreenshotImage(image, publicId);
  const gameSlug = slugify(parsed.gameName) || nanoid(8);
  const tagNames = parseTags(parsed.tags ?? "");

  const post = await prisma.$transaction(async (tx) => {
    const game = await tx.game.upsert({
      where: { slug: gameSlug },
      update: { name: parsed.gameName },
      create: {
        name: parsed.gameName,
        slug: gameSlug,
      },
    });

    const createdPost = await tx.post.create({
      data: {
        publicId,
        userId,
        gameId: game.id,
        type: "SCREENSHOT",
        title: parsed.title,
        description: parsed.description,
        status: parsed.visibility === "PUBLIC" ? "PUBLISHED" : "PRIVATE",
        visibility: parsed.visibility,
        thumbnailUrl: storedImage.thumbnailUrl,
        mediaUrl: storedImage.mediaUrl,
        originalFilePath: storedImage.originalPath,
        fileSizeBytes: BigInt(storedImage.size),
        width: storedImage.width,
        height: storedImage.height,
        isNsfw: parsed.isNsfw,
        publishedAt: parsed.visibility === "PUBLIC" ? new Date() : null,
      },
    });

    for (const tagName of tagNames) {
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

  redirect(`/c/${post.publicId}`);
}
