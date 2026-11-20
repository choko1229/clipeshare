import { rm } from "node:fs/promises";
import type { QuickShare } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { mediaUrlToProcessedPath } from "@/lib/media/retention";

/** ファイルを消して論理削除する(Web の削除操作と API で共通。処理内容は従来の /qick と同じ) */
export async function deleteQuickShareRecord(quickShare: Pick<QuickShare, "publicId" | "mediaUrl" | "thumbnailUrl" | "originalPath">) {
  const filePaths = [
    mediaUrlToProcessedPath(quickShare.mediaUrl),
    mediaUrlToProcessedPath(quickShare.thumbnailUrl),
    quickShare.originalPath,
  ].filter((value): value is string => Boolean(value));

  await Promise.all(filePaths.map((filePath) => rm(filePath, { force: true })));

  await prisma.quickShare.update({
    where: { publicId: quickShare.publicId },
    data: { deletedAt: new Date() },
  });
}
