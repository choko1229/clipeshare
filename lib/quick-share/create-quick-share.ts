import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { nanoid } from "nanoid";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { storeQuickShareImage, storeQuickShareVideoOriginal } from "@/lib/media/quick-share";
import { getClientIpHash } from "@/lib/quick-share/ip-hash";
import { assertQuickShareRateLimit } from "@/lib/quick-share/rate-limit";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { addStoredUpload } from "@/lib/quick-share/upload-cookie";
import { detectMediaKind } from "@/lib/uploads/file-kind";

export async function createQuickShareFromFormData(formData: FormData) {
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
