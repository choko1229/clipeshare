"use server";

import { rm } from "node:fs/promises";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { authOptions } from "@/auth";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { prisma } from "@/lib/db/prisma";
import { storeQuickShareImage, storeQuickShareVideo } from "@/lib/media/quick-share";
import { mediaUrlToProcessedPath } from "@/lib/media/retention";
import { getClientIpHash } from "@/lib/quick-share/ip-hash";
import { assertQuickShareRateLimit } from "@/lib/quick-share/rate-limit";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { detectMediaKind } from "@/lib/uploads/file-kind";

function deleteCookieName(publicId: string) {
  return `qs_del_${publicId}`;
}

export async function createQuickShare(formData: FormData) {
  try {
    const redirectUrl = await createQuickShareInternal(formData);
    redirect(redirectUrl);
  } catch (error) {
    redirect(errorRedirectUrl("/qick", error));
  }
}

async function createQuickShareInternal(formData: FormData) {
  const file = formData.get("media");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("ファイルを選択してください。");
  }

  const kind = detectMediaKind(file);

  if (!kind) {
    throw new Error("対応している画像または動画ファイルを選択してください。");
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const ipHash = userId ? null : await getClientIpHash();

  await assertQuickShareRateLimit({ userId, ipHash });

  const settings = await getQuickShareSettings();
  const publicId = nanoid(10);
  const deleteToken = nanoid(24);

  const stored =
    kind === "SCREENSHOT"
      ? await storeQuickShareImage(file, publicId, { maxImageSizeBytes: settings.maxImageBytes })
      : await storeQuickShareVideo(file, publicId, { maxVideoSizeBytes: settings.maxVideoBytes });

  const expiresAt = new Date(Date.now() + settings.retentionHours * 60 * 60 * 1000);

  await prisma.quickShare.create({
    data: {
      publicId,
      deleteToken,
      kind: kind === "SCREENSHOT" ? "IMAGE" : "VIDEO",
      mediaUrl: stored.mediaUrl,
      mimeType: stored.mimeType,
      fileSizeBytes: BigInt(stored.size),
      width: stored.width,
      height: stored.height,
      userId,
      ipHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(deleteCookieName(publicId), deleteToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: settings.retentionHours * 60 * 60,
    path: `/q/${publicId}`,
  });

  return `/q/${publicId}`;
}

export async function deleteQuickShare(publicId: string, _formData: FormData) {
  const cookieStore = await cookies();
  const token = cookieStore.get(deleteCookieName(publicId))?.value;

  if (!token) {
    throw new Error("削除する権限がありません。");
  }

  const quickShare = await prisma.quickShare.findUnique({ where: { publicId } });

  if (quickShare && !quickShare.deletedAt && quickShare.deleteToken === token) {
    const filePath = mediaUrlToProcessedPath(quickShare.mediaUrl);

    if (filePath) {
      await rm(filePath, { force: true });
    }

    await prisma.quickShare.update({
      where: { publicId },
      data: { deletedAt: new Date() },
    });
  }

  cookieStore.delete(deleteCookieName(publicId));
  redirect("/qick");
}
