"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { isValidUsername, normalizeUsername } from "@/lib/users/username";

const profileSchema = z.object({
  username: z.string().trim().min(3).max(30),
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).optional(),
});

export async function updateProfile(formData: FormData) {
  const user = await requireActiveUser();

  const parsed = profileSchema.parse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
  });

  const username = normalizeUsername(parsed.username);
  if (!isValidUsername(username)) {
    throw new Error("ユーザーIDは半角英数字とアンダースコアで3から30文字にしてください。");
  }

  const existing = await prisma.user.findFirst({
    where: {
      username,
      NOT: {
        id: user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new Error("このユーザーIDは既に使われています。");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      username,
      displayName: parsed.displayName,
      bio: parsed.bio ?? "",
    },
  });

  revalidatePath("/");
  revalidatePath(`/users/${username}`);
  revalidatePath("/settings/profile");
  redirect(`/users/${username}`);
}
