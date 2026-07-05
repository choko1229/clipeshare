"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { storeAvatarImage, storeProfileBackgroundImage, storeProfileHeaderImage } from "@/lib/media/avatars";
import { inferSocialLinkType, socialUsernameUrl } from "@/lib/users/social-links";
import { isValidUsername, normalizeUsername } from "@/lib/users/username";

const profileSchema = z.object({
  username: z.string().trim().min(3).max(30),
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(500).optional(),
  profileAccentColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  profileBackgroundBlur: z.coerce.number().int().min(0).max(128),
  profileButtonColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  profileDefaultView: z.enum(["CARD", "TILE", "GROUPED_BY_GAME"]),
  profileGroupGames: z.boolean(),
  profileThemePreference: z.enum(["SYSTEM", "DARK", "LIGHT"]),
  showAgeVerified: z.boolean(),
  showBirthDate: z.boolean(),
  showFollowersCount: z.boolean(),
  showFollowingCount: z.boolean(),
  showProfileGames: z.boolean(),
});

const linkSchema = z.object({
  type: z.string().trim().min(1).max(40),
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().url().max(500),
});

export async function updateProfile(formData: FormData) {
  try {
    const redirectUrl = await updateProfileInternal(formData);
    redirect(redirectUrl);
  } catch (error) {
    redirect(errorRedirectUrl("/settings/profile", error));
  }
}

async function updateProfileInternal(formData: FormData) {
  const user = await requireActiveUser();

  const parsed = profileSchema.parse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    profileAccentColor: formData.get("profileAccentColor") ?? "",
    profileBackgroundBlur: formData.get("profileBackgroundBlur") ?? 0,
    profileButtonColor: formData.get("profileButtonColor") ?? "",
    profileDefaultView: formData.get("profileDefaultView") ?? "CARD",
    profileGroupGames: formData.get("profileGroupGames") === "on",
    profileThemePreference: formData.get("profileThemePreference") ?? "SYSTEM",
    showAgeVerified: formData.get("showAgeVerified") === "on",
    showBirthDate: formData.get("showBirthDate") === "on",
    showFollowersCount: formData.get("showFollowersCount") === "on",
    showFollowingCount: formData.get("showFollowingCount") === "on",
    showProfileGames: formData.get("showProfileGames") === "on",
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
  const profileHeader = formData.get("profileHeader");
  const profileBackground = formData.get("profileBackground");
  const avatarUrl = avatar instanceof File && avatar.size > 0 ? await storeAvatarImage(avatar, user.id) : undefined;
  const profileHeaderUrl =
    profileHeader instanceof File && profileHeader.size > 0 ? await storeProfileHeaderImage(profileHeader, user.id) : undefined;
  const profileBackgroundUrl =
    profileBackground instanceof File && profileBackground.size > 0 ? await storeProfileBackgroundImage(profileBackground, user.id) : undefined;
  const links = parseLinks(formData);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        username,
        displayName: parsed.displayName,
        bio: parsed.bio ?? "",
        profileAccentColor: parsed.profileAccentColor || null,
        profileBackgroundBlur: parsed.profileBackgroundBlur,
        profileButtonColor: parsed.profileButtonColor || null,
        profileDefaultView: parsed.profileDefaultView,
        profileGroupGames: parsed.profileGroupGames,
        profileThemePreference: parsed.profileThemePreference,
        showAgeVerified: parsed.showAgeVerified,
        showBirthDate: parsed.showBirthDate,
        showFollowersCount: parsed.showFollowersCount,
        showFollowingCount: parsed.showFollowingCount,
        showProfileGames: parsed.showProfileGames,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(profileHeaderUrl ? { profileHeaderUrl } : {}),
        ...(profileBackgroundUrl ? { profileBackgroundUrl } : {}),
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
  return `/users/${username}`;
}

function parseLinks(formData: FormData) {
  const labels = formData.getAll("linkLabel");
  const urls = formData.getAll("linkUrl");
  const links = [];
  const usernameLinks = [
    { label: "YouTube", type: "youtube" as const, value: String(formData.get("youtubeUsername") ?? "") },
    { label: "X", type: "x" as const, value: String(formData.get("xUsername") ?? "") },
    { label: "Twitch", type: "twitch" as const, value: String(formData.get("twitchUsername") ?? "") },
    { label: "Instagram", type: "instagram" as const, value: String(formData.get("instagramUsername") ?? "") },
  ];

  for (const usernameLink of usernameLinks) {
    const url = socialUsernameUrl(usernameLink.type, usernameLink.value);
    if (!url) {
      continue;
    }

    links.push(
      linkSchema.parse({
        type: usernameLink.type,
        label: usernameLink.label,
        url,
      }),
    );
  }

  for (let index = 0; index < urls.length; index += 1) {
    const url = String(urls[index] ?? "").trim();
    if (!url) {
      continue;
    }

    const parsed = linkSchema.parse({
      type: inferSocialLinkType(url),
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
