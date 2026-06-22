"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { parseTags, slugify } from "@/lib/posts/slug";

const updatePostSchema = z.object({
  publicId: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(4000),
  gameName: z.string().trim().min(1).max(120),
  tags: z.string().trim().max(300).optional(),
});

export async function updatePost(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const parsed = updatePostSchema.parse({
    publicId: formData.get("publicId"),
    title: formData.get("title"),
    description: formData.get("description"),
    gameName: formData.get("gameName"),
    tags: formData.get("tags") ?? "",
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
  const tagNames = parseTags(parsed.tags ?? "");

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
        title: parsed.title,
        description: parsed.description,
        gameId: game.id,
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

  revalidatePath("/");
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
