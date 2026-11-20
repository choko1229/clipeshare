import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { ApiError } from "@/lib/api/errors";
import { describeError, logApi } from "@/lib/api/log";
import type { ApiAuthContext } from "@/lib/api-auth/authenticate";
import { prisma } from "@/lib/db/prisma";
import { mediaPaths } from "@/lib/media/paths";
import { QuickShareImagePixelLimitError, renderQuickShareApiImage } from "@/lib/media/quick-share";
import { dailyOwnerOf, type ApiLimitsSubject } from "@/lib/quick-share/api-limits";
import { discardTempUpload, receiveQuickShareUpload } from "@/lib/quick-share/api-multipart";
import { getQuickShareSizeLimits } from "@/lib/quick-share/limits";
import { getQuickShareDailyUsage } from "@/lib/quick-share/rate-limit";
import { getQuickShareSettings } from "@/lib/quick-share/settings";

export type ApiQuickShareCreated = {
  id: string;
  url: string;
  kind: "IMAGE" | "VIDEO";
  status: "READY" | "PROCESSING";
  expiresAt: string;
  deleteToken?: string;
};

export const apiUploadTempDir = path.join(mediaPaths.quickShareOriginalRoot, "incoming");

function subjectOf(auth: ApiAuthContext): ApiLimitsSubject {
  return auth.kind === "token" ? { kind: "token", userId: auth.user.id } : { kind: "anonymous", ipHash: auth.ipHash };
}

export function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * `POST /api/v1/quick` の本体。
 * 1日上限 → 受信(ストリーム・上限強制・マジックバイト) → 画像処理 or 動画の非同期処理登録 → DB 登録。
 * バナーは API 経由のみ分岐(トークンあり=なし、匿名=あり)。Web 経由(/api/qick/upload)は別経路で従来どおり。
 */
export async function createQuickShareFromApi(request: Request, auth: ApiAuthContext, requestId: string): Promise<ApiQuickShareCreated> {
  const subject = subjectOf(auth);
  const userId = auth.kind === "token" ? auth.user.id : null;

  const daily = await getQuickShareDailyUsage(dailyOwnerOf(subject));

  if (daily.limit !== null && daily.used >= daily.limit) {
    throw new ApiError("DAILY_LIMIT_EXCEEDED", {
      message: `本日のアップロード上限 ${daily.limit} 件に達しています。`,
      details: { resetsAt: daily.resetsAt.toISOString(), dailyLimit: daily.limit },
      reason: "daily_limit",
    });
  }

  const [settings, sizeLimits] = await Promise.all([getQuickShareSettings(), getQuickShareSizeLimits(userId)]);
  const upload = await receiveQuickShareUpload(request, { limits: sizeLimits, tempDir: apiUploadTempDir });

  const publicId = nanoid(10);
  const deleteToken = nanoid(24);
  const expiresAt = new Date(Date.now() + settings.retentionHours * 60 * 60 * 1000);
  const ownership = {
    userId,
    ipHash: userId ? null : auth.ipHash,
    apiTokenId: auth.kind === "token" ? auth.tokenId : null,
  };

  try {
    if (upload.media.kind === "IMAGE") {
      let stored: Awaited<ReturnType<typeof renderQuickShareApiImage>>;

      try {
        stored = await renderQuickShareApiImage(upload.tempPath, publicId, {
          quality: upload.quality,
          banner: auth.kind === "anonymous",
        });
      } catch (error) {
        if (error instanceof QuickShareImagePixelLimitError) {
          throw new ApiError("SIZE_LIMIT_EXCEEDED", {
            message: "画像の解像度が大きすぎます。",
            details: { limitBytes: sizeLimits.imageMaxBytes, kind: "IMAGE", limitPixels: 100_000_000 },
            reason: "pixel_limit",
          });
        }

        throw new ApiError("UNSUPPORTED_MEDIA", { message: "画像を読み取れませんでした。", reason: `image_decode_failed: ${describeError(error)}` });
      }

      try {
        await prisma.quickShare.create({
          data: {
            publicId,
            deleteToken,
            kind: "IMAGE",
            status: "READY",
            mediaUrl: stored.mediaUrl,
            mimeType: stored.mimeType,
            fileSizeBytes: BigInt(upload.sizeBytes),
            width: stored.width,
            height: stored.height,
            expiresAt,
            ...ownership,
          },
        });
      } catch (error) {
        await rm(stored.filePath, { force: true }).catch(() => undefined);
        throw error;
      }
    } else {
      // 動画は現行と同じ: 原本を保存して PROCESSING、変換はワーカー(scripts/video-worker.mjs)が行う
      const videoDir = path.join(mediaPaths.quickShareOriginalRoot, "videos");
      await mkdir(videoDir, { recursive: true });
      const originalPath = path.join(videoDir, `${publicId}.${upload.media.extension}`);
      await rename(upload.tempPath, originalPath);

      try {
        await prisma.$transaction(async (tx) => {
          const quickShare = await tx.quickShare.create({
            data: {
              publicId,
              deleteToken,
              kind: "VIDEO",
              status: "PROCESSING",
              originalPath,
              mimeType: upload.media.mimeType,
              fileSizeBytes: BigInt(upload.sizeBytes),
              expiresAt,
              ...ownership,
            },
          });

          await tx.uploadJob.create({
            data: {
              quickShareId: quickShare.id,
              inputPath: originalPath,
              status: "QUEUED",
            },
          });
        });
      } catch (error) {
        await rm(originalPath, { force: true }).catch(() => undefined);
        throw error;
      }
    }
  } finally {
    await discardTempUpload(upload.tempPath).catch(() => undefined);
  }

  logApi("info", {
    event: "quick_share.created",
    requestId,
    userId,
    tokenId: ownership.apiTokenId,
    ipHash: ownership.ipHash,
    kind: upload.media.kind,
    format: upload.media.format,
    quality: upload.quality,
    sizeBytes: upload.sizeBytes,
  });

  return {
    id: publicId,
    url: `${appBaseUrl()}/q/${publicId}`,
    kind: upload.media.kind,
    status: upload.media.kind === "IMAGE" ? "READY" : "PROCESSING",
    expiresAt: expiresAt.toISOString(),
    ...(auth.kind === "anonymous" ? { deleteToken } : {}),
  };
}
