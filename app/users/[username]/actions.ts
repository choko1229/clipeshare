"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { sendWebPushToUser } from "@/lib/notifications/web-push";

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

  let shouldSendFollowPush = false;

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

    const existingNotification = await tx.notification.findFirst({
      where: {
        userId: target.id,
        actorId: userId,
        type: "FOLLOW",
        targetType: "USER",
        targetId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingNotification) {
      await tx.notification.create({
        data: {
          userId: target.id,
          actorId: userId,
          type: "FOLLOW",
          targetType: "USER",
          targetId: userId,
        },
      });
      shouldSendFollowPush = true;
    }
  });

  revalidatePath(`/users/${target.username}`);
  revalidatePath("/following");
  revalidatePath("/notice");
  revalidatePath("/", "layout");

  if (shouldSendFollowPush) {
    await sendWebPushToUser(target.id, {
      body: `${user.username ?? "ユーザー"} さんがあなたをフォローしました`,
      title: "新しいフォロワー",
      url: user.username ? `/users/${user.username}` : "/notice",
    });
  }
}
