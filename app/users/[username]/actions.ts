"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";

const usernameSchema = z.string().min(1).max(64);

export async function toggleFollow(formData: FormData) {
  const user = await requireActiveUser();
  const userId = user.id;
  const username = usernameSchema.parse(formData.get("username"));
  const target = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
    },
  });

  if (!target) {
    throw new Error("ユーザーが見つかりません。");
  }

  if (target.id === user.id) {
    throw new Error("自分自身はフォローできません。");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: target.id,
        },
      },
    });

    if (existing) {
      await tx.follow.delete({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: target.id,
          },
        },
      });
      return;
    }

    await tx.follow.create({
      data: {
        followerId: userId,
        followingId: target.id,
      },
    });
  });

  revalidatePath(`/users/${target.username}`);
  revalidatePath("/following");
}
