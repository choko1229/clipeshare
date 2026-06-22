"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";

const usernameSchema = z.string().min(1).max(64);

export async function toggleFollow(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
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

  if (target.id === session.user.id) {
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
