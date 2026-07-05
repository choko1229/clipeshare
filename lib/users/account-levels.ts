import type { AccountLevel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDailyUploadUsage, getUploadLimitsForUser } from "@/lib/uploads/account-limits";

export const manualAccountLevelNames = new Set(["Admin", "Nuisance"]);

export type AccountLevelMetrics = {
  postCount: number;
  followerCount: number;
  accountAgeDays: number;
};

export type AccountLevelProgress = {
  currentLevel: AccountLevel | null;
  nextLevel: AccountLevel | null;
  metrics: AccountLevelMetrics;
  dailyUploadCount: number;
  dailyUploadRemaining: number | null;
  limits: Awaited<ReturnType<typeof getUploadLimitsForUser>>;
};

function accountAgeDays(createdAt: Date) {
  const elapsed = Date.now() - createdAt.getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

function isEligible(level: AccountLevel, metrics: AccountLevelMetrics) {
  return (
    metrics.postCount >= level.minPostCount &&
    metrics.accountAgeDays >= level.minAccountAgeDays &&
    metrics.followerCount >= level.minFollowerCount
  );
}

async function getMetrics(userId: string, createdAt: Date): Promise<AccountLevelMetrics> {
  const [postCount, followerCount] = await Promise.all([
    prisma.post.count({
      where: {
        userId,
        status: {
          not: "DELETED",
        },
      },
    }),
    prisma.follow.count({
      where: {
        followingId: userId,
      },
    }),
  ]);

  return {
    postCount,
    followerCount,
    accountAgeDays: accountAgeDays(createdAt),
  };
}

export async function syncUserAccountLevel(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accountLevel: true,
    },
  });

  if (!user) {
    return null;
  }

  if (user.accountLevel?.isManualOnly || (user.accountLevel?.name && manualAccountLevelNames.has(user.accountLevel.name))) {
    return user.accountLevel;
  }

  const [levels, metrics] = await Promise.all([
    prisma.accountLevel.findMany({
      where: {
        isManualOnly: false,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getMetrics(user.id, user.createdAt),
  ]);

  const eligible = levels.filter((level) => isEligible(level, metrics)).at(-1);

  if (!eligible) {
    return user.accountLevel;
  }

  if (!user.accountLevel || eligible.sortOrder > user.accountLevel.sortOrder) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountLevelId: eligible.id,
      },
      include: {
        accountLevel: true,
      },
    });

    return updated.accountLevel;
  }

  return user.accountLevel;
}

export async function getAccountLevelProgress(userId: string): Promise<AccountLevelProgress | null> {
  await syncUserAccountLevel(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accountLevel: true,
    },
  });

  if (!user) {
    return null;
  }

  const [levels, metrics, limits, dailyUploadCount] = await Promise.all([
    prisma.accountLevel.findMany({
      where: {
        isManualOnly: false,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getMetrics(user.id, user.createdAt),
    getUploadLimitsForUser(user.id),
    getDailyUploadUsage(user.id),
  ]);

  const currentLevel =
    user.accountLevel ??
    levels.find((level) => level.isDefault) ??
    levels[0] ??
    null;
  const nextLevel = currentLevel
    ? levels.find((level) => level.sortOrder > currentLevel.sortOrder && !isEligible(level, metrics)) ??
      levels.find((level) => level.sortOrder > currentLevel.sortOrder) ??
      null
    : null;

  return {
    currentLevel,
    nextLevel,
    metrics,
    limits,
    dailyUploadCount,
    dailyUploadRemaining: limits.dailyUploadLimit === null ? null : Math.max(0, limits.dailyUploadLimit - dailyUploadCount),
  };
}
