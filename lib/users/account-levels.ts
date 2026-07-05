import type { AccountLevel, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getDailyUploadUsage, getUploadLimitsForUser } from "@/lib/uploads/account-limits";

export const manualAccountLevelNames = new Set(["Admin", "Nuisance"]);

export type AccountLevelMetrics = {
  postCount: number;
  followerCount: number;
  accountAgeDays: number;
  emailVerified: boolean;
  hasAdminFollow: boolean;
};

export type AccountLevelProgress = {
  currentLevel: AccountLevel | null;
  nextLevel: AccountLevel | null;
  metrics: AccountLevelMetrics;
  dailyUploadCount: number;
  dailyUploadRemaining: number | null;
  limits: Awaited<ReturnType<typeof getUploadLimitsForUser>>;
};

type PromotionClause = {
  minPostCount?: number;
  minAccountAgeDays?: number;
  minFollowerCount?: number;
  requiresEmailVerified?: boolean;
};

type PromotionRule = {
  anyOf?: PromotionClause[];
  requiresAdminFollow?: boolean;
};

function accountAgeDays(from: Date) {
  const elapsed = Date.now() - from.getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

function isObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePromotionRule(value: Prisma.JsonValue | null): PromotionRule | null {
  if (!value || !isObject(value)) {
    return null;
  }

  const anyOf = Array.isArray(value.anyOf)
    ? value.anyOf
        .filter((item): item is Prisma.JsonObject => isObject(item))
        .map((item) => ({
          minPostCount: typeof item.minPostCount === "number" ? item.minPostCount : undefined,
          minAccountAgeDays: typeof item.minAccountAgeDays === "number" ? item.minAccountAgeDays : undefined,
          minFollowerCount: typeof item.minFollowerCount === "number" ? item.minFollowerCount : undefined,
          requiresEmailVerified: item.requiresEmailVerified === true,
        }))
    : undefined;

  return {
    anyOf,
    requiresAdminFollow: value.requiresAdminFollow === true,
  };
}

function matchesClause(clause: PromotionClause, metrics: AccountLevelMetrics) {
  if (clause.minPostCount !== undefined && metrics.postCount < clause.minPostCount) {
    return false;
  }

  if (clause.minAccountAgeDays !== undefined && metrics.accountAgeDays < clause.minAccountAgeDays) {
    return false;
  }

  if (clause.minFollowerCount !== undefined && metrics.followerCount < clause.minFollowerCount) {
    return false;
  }

  if (clause.requiresEmailVerified && !metrics.emailVerified) {
    return false;
  }

  return true;
}

function isEligible(level: AccountLevel, metrics: AccountLevelMetrics) {
  const rule = parsePromotionRule(level.promotionRule);

  if (rule) {
    if (rule.requiresAdminFollow && !metrics.hasAdminFollow) {
      return false;
    }

    if (rule.anyOf?.length) {
      return rule.anyOf.some((clause) => matchesClause(clause, metrics));
    }
  }

  return (
    metrics.postCount >= level.minPostCount &&
    metrics.accountAgeDays >= level.minAccountAgeDays &&
    metrics.followerCount >= level.minFollowerCount
  );
}

function progressStartDate(user: { createdAt: Date; levelProgressResetAt: Date | null }) {
  if (user.levelProgressResetAt && user.levelProgressResetAt > user.createdAt) {
    return user.levelProgressResetAt;
  }

  return user.createdAt;
}

async function hasAdminFollow(userId: string) {
  const adminRoles: UserRole[] = ["MODERATOR", "ADMIN", "OWNER"];
  const count = await prisma.follow.count({
    where: {
      followingId: userId,
      follower: {
        role: {
          in: adminRoles,
        },
      },
    },
  });

  return count > 0;
}

async function getMetrics(
  userId: string,
  user: { createdAt: Date; levelProgressResetAt: Date | null; emailVerified: Date | null },
): Promise<AccountLevelMetrics> {
  const resetAt = progressStartDate(user);
  const [postCount, followerCount, adminFollow] = await Promise.all([
    prisma.post.count({
      where: {
        userId,
        createdAt: {
          gte: resetAt,
        },
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
    hasAdminFollow(userId),
  ]);

  return {
    postCount,
    followerCount,
    hasAdminFollow: adminFollow,
    emailVerified: Boolean(user.emailVerified),
    accountAgeDays: accountAgeDays(resetAt),
  };
}

async function expireNuisanceIfNeeded(user: {
  id: string;
  accountLevel: AccountLevel | null;
  accountLevelExpiresAt: Date | null;
}) {
  if (user.accountLevel?.name !== "Nuisance" || !user.accountLevelExpiresAt || user.accountLevelExpiresAt > new Date()) {
    return user.accountLevel;
  }

  const visitor = await prisma.accountLevel.findUnique({
    where: {
      name: "Visitor",
    },
  });

  const updated = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      accountLevelId: visitor?.id ?? null,
      accountLevelExpiresAt: null,
      levelProgressResetAt: new Date(),
    },
    include: {
      accountLevel: true,
    },
  });

  return updated.accountLevel;
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

  const currentAfterExpiry = await expireNuisanceIfNeeded(user);

  if (currentAfterExpiry?.isManualOnly || (currentAfterExpiry?.name && manualAccountLevelNames.has(currentAfterExpiry.name))) {
    return currentAfterExpiry;
  }

  const [levels, metrics] = await Promise.all([
    prisma.accountLevel.findMany({
      where: {
        isManualOnly: false,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    getMetrics(user.id, user),
  ]);

  const eligible = levels.filter((level) => isEligible(level, metrics)).at(-1);

  if (!eligible) {
    return currentAfterExpiry;
  }

  if (!currentAfterExpiry || eligible.sortOrder > currentAfterExpiry.sortOrder || !user.accountLevelId) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        accountLevelId: eligible.id,
        accountLevelExpiresAt: null,
      },
      include: {
        accountLevel: true,
      },
    });

    return updated.accountLevel;
  }

  return currentAfterExpiry;
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
    getMetrics(user.id, user),
    getUploadLimitsForUser(user.id),
    getDailyUploadUsage(user.id),
  ]);

  const currentLevel = user.accountLevel ?? levels.find((level) => level.isDefault) ?? levels[0] ?? null;
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
