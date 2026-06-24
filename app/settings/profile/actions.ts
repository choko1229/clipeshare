"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { storeAvatarImage } from "@/lib/media/avatars";
import { isValidUsername, normalizeUsername } from "@/lib/users/username";

const profileSchema = z.object({
  username: z.string().trim().min(3).max(30),
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).optional(),
});

const linkSchema = z.object({
  type: z.string().trim().min(1).max(40),
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().url().max(500),
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

  const avatar = formData.get("avatar");
  const avatarUrl = avatar instanceof File && avatar.size > 0 ? await storeAvatarImage(avatar, user.id) : undefined;
  const links = parseLinks(formData);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        username,
        displayName: parsed.displayName,
        bio: parsed.bio ?? "",
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    });

    await tx.userLink.deleteMany({
      where: {
        userId: user.id,
      },
    });

    if (links.length > 0) {
      await tx.userLink.createMany({
        data: links.map((link, index) => ({
          userId: user.id,
          type: link.type,
          label: link.label || null,
          url: link.url,
          sortOrder: index,
        })),
      });
    }
  });

  revalidatePath("/");
  revalidatePath(`/users/${username}`);
  revalidatePath("/settings/profile");
  redirect(`/users/${username}`);
}

function parseLinks(formData: FormData) {
  const types = formData.getAll("linkType");
  const labels = formData.getAll("linkLabel");
  const urls = formData.getAll("linkUrl");
  const links = [];

  for (let index = 0; index < Math.min(types.length, urls.length, 5); index += 1) {
    const url = String(urls[index] ?? "").trim();
    if (!url) {
      continue;
    }

    const parsed = linkSchema.parse({
      type: String(types[index] ?? "website"),
      label: String(labels[index] ?? ""),
      url,
    });

    const protocol = new URL(parsed.url).protocol;
    if (protocol !== "http:" && protocol !== "https:") {
      throw new Error("SNSリンクは http または https のURLを入力してください。");
    }

    links.push(parsed);
  }

  return links;
}
