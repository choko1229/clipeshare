"use server";

import { rm } from "node:fs/promises";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { authOptions } from "@/auth";
import { errorRedirectUrl } from "@/lib/actions/error-message";
import { prisma } from "@/lib/db/prisma";
import { storeQuickShareImage, storeQuickShareVideoOriginal } from "@/lib/media/quick-share";
import { mediaUrlToProcessedPath } from "@/lib/media/retention";
import { getClientIpHash } from "@/lib/quick-share/ip-hash";
import { assertQuickShareRateLimit } from "@/lib/quick-share/rate-limit";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { addStoredUpload, getStoredUploads, removeStoredUpload } from "@/lib/quick-share/upload-cookie";
import { detectMediaKind } from "@/lib/uploads/file-kind";

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
  const expiresAt = new Date(Date.now() + settings.retentionHours * 60 * 60 * 1000);

  if (kind === "SCREENSHOT") {
    const stored = await storeQuickShareImage(file, publicId, { maxImageSizeBytes: settings.maxImageBytes });

    await prisma.quickShare.create({
      data: {
        publicId,
        deleteToken,
        kind: "IMAGE",
        status: "READY",
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
  } else {
    const stored = await storeQuickShareVideoOriginal(file, publicId, { maxVideoSizeBytes: settings.maxVideoBytes });

    const quickShare = await prisma.quickShare.create({
      data: {
        publicId,
        deleteToken,
        kind: "VIDEO",
        status: "PROCESSING",
        originalPath: stored.originalPath,
        mimeType: stored.mimeType,
        fileSizeBytes: BigInt(stored.size),
        userId,
        ipHash,
        expiresAt,
      },
    });

    await prisma.uploadJob.create({
      data: {
        quickShareId: quickShare.id,
        inputPath: stored.originalPath,
        status: "QUEUED",
      },
    });
  }

  const cookieStore = await cookies();
  addStoredUpload(cookieStore, { id: publicId, token: deleteToken });

  return `/qick?created=${publicId}`;
}

export async function deleteQuickShare(publicId: string, _formData: FormData) {
  const [cookieStore, session] = await Promise.all([cookies(), getServerSession(authOptions)]);
  const quickShare = await prisma.quickShare.findUnique({ where: { publicId } });

  if (quickShare && !quickShare.deletedAt) {
    const isOwnerBySession = Boolean(session?.user?.id) && quickShare.userId === session?.user?.id;
    const isOwnerByCookie = getStoredUploads(cookieStore).some(
      (item) => item.id === publicId && item.token === quickShare.deleteToken,
    );

    if (isOwnerBySession || isOwnerByCookie) {
      const filePaths = [
        mediaUrlToProcessedPath(quickShare.mediaUrl),
        mediaUrlToProcessedPath(quickShare.thumbnailUrl),
        quickShare.originalPath,
      ].filter((value): value is string => Boolean(value));

      await Promise.all(filePaths.map((filePath) => rm(filePath, { force: true })));

      await prisma.quickShare.update({
        where: { publicId },
        data: { deletedAt: new Date() },
      });
    }
  }

  removeStoredUpload(cookieStore, publicId);
  redirect("/qick");
}
