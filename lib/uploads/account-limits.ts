import { prisma } from "@/lib/db/prisma";

export type UploadLimits = {
  accountLevelId: string | null;
  accountLevelName: string;
  maxVideoSeconds: number;
  maxVideoSizeBytes: number;
  maxImageSizeBytes: number;
  dailyUploadLimit: number | null;
};

const fallbackLimits: UploadLimits = {
  accountLevelId: null,
  accountLevelName: "default",
  maxVideoSeconds: 180,
  maxVideoSizeBytes: 300_000_000,
  maxImageSizeBytes: 50_000_000,
  dailyUploadLimit: 20,
};

export async function getUploadLimitsForUser(userId: string): Promise<UploadLimits> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountLevel: true,
    },
  });

  const level =
    user?.accountLevel ??
    (await prisma.accountLevel.findFirst({
      where: { isDefault: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!level) {
    return fallbackLimits;
  }

  return {
    accountLevelId: level.id,
    accountLevelName: level.name,
    maxVideoSeconds: level.maxVideoSeconds,
    maxVideoSizeBytes: Number(level.maxVideoSizeBytes),
    maxImageSizeBytes: Number(level.maxImageSizeBytes),
    dailyUploadLimit: level.dailyUploadLimit,
  };
}

export async function assertDailyUploadLimit(userId: string, limits: UploadLimits) {
  if (!limits.dailyUploadLimit) {
    return;
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const count = await prisma.post.count({
    where: {
      userId,
      createdAt: {
        gte: startOfDay,
      },
      status: {
        not: "DELETED",
      },
    },
  });

  if (count >= limits.dailyUploadLimit) {
    throw new Error(`本日の投稿上限 ${limits.dailyUploadLimit} 件に達しています。`);
  }
}

export function formatBytes(bytes: number) {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
  }

  return `${Math.round(bytes / 1_000_000)}MB`;
}
