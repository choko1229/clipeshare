import { prisma } from "@/lib/db/prisma";
import { mediaPaths } from "@/lib/media/paths";
import path from "node:path";

export const ORIGINAL_VIDEO_RETENTION_DAYS = 30;
export const DEFAULT_DELETED_FILE_RETENTION_DAYS = 45;
export const DEFAULT_REPLACED_FILE_RETENTION_DAYS = 45;

export const storageSettingKeys = {
  deletedFileRetentionDays: "deleted_file_retention_days",
  replacedFileRetentionDays: "replaced_file_retention_days",
} as const;

type RetentionReason = "ORIGINAL_VIDEO" | "DELETED_FILE" | "REPLACED_FILE";

type ScheduleMediaRetentionInput = {
  path?: string | null;
  postId?: string | null;
  reason: RetentionReason;
  deleteAfter: Date;
};

export async function scheduleMediaRetention(input: ScheduleMediaRetentionInput) {
  if (!input.path) {
    return;
  }

  await prisma.mediaRetentionFile.create({
    data: {
      postId: input.postId ?? null,
      path: input.path,
      reason: input.reason,
      deleteAfter: input.deleteAfter,
    },
  });
}

export function mediaUrlToProcessedPath(url?: string | null) {
  if (!url?.startsWith("/media/")) {
    return null;
  }

  const relativePath = url.slice("/media/".length);
  const resolved = path.resolve(mediaPaths.processedRoot, relativePath);
  const root = path.resolve(mediaPaths.processedRoot);

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

export function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function getStorageSettingInt(key: string, fallback: number) {
  const setting = await prisma.storageSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  const parsed = Number.parseInt(setting?.value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getReplacedFileRetentionDays() {
  return getStorageSettingInt(storageSettingKeys.replacedFileRetentionDays, DEFAULT_REPLACED_FILE_RETENTION_DAYS);
}

export async function getDeletedFileRetentionDays() {
  return getStorageSettingInt(storageSettingKeys.deletedFileRetentionDays, DEFAULT_DELETED_FILE_RETENTION_DAYS);
}
