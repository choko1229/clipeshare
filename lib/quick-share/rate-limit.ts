import { prisma } from "@/lib/db/prisma";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { getUploadLimitsForUser } from "@/lib/uploads/account-limits";

type AssertQuickShareRateLimitInput = {
  userId: string | null;
  ipHash: string | null;
};

export type QuickShareDailyOwner = { userId: string } | { ipHash: string };

export type QuickShareDailyUsage = {
  /** null = 無制限 */
  limit: number | null;
  used: number;
  resetsAt: Date;
};

/**
 * 1日上限の数え方(Web/APIで共通)。サーバーのローカル時刻の当日0時以降に作成された
 * QuickShare の行数を、ログイン中は userId、匿名は ipHash で数える(削除済みも含む)。
 */
export async function countQuickSharesToday(owner: QuickShareDailyOwner, now: Date = new Date()) {
  return prisma.quickShare.count({
    where: {
      ...owner,
      createdAt: {
        gte: startOfQuickShareDay(now),
      },
    },
  });
}

export async function getQuickShareDailyUsage(owner: QuickShareDailyOwner, now: Date = new Date()): Promise<QuickShareDailyUsage> {
  const limit =
    "userId" in owner
      ? (await getUploadLimitsForUser(owner.userId)).dailyUploadLimit
      : (await getQuickShareSettings()).anonymousDailyLimit;
  const used = await countQuickSharesToday(owner, now);

  return {
    limit,
    used,
    resetsAt: nextQuickShareDayReset(now),
  };
}

export async function assertQuickShareRateLimit({ userId, ipHash }: AssertQuickShareRateLimitInput) {
  if (userId) {
    const limits = await getUploadLimitsForUser(userId);

    if (limits.dailyUploadLimit === null) {
      return;
    }

    const count = await countQuickSharesToday({ userId });

    if (count >= limits.dailyUploadLimit) {
      throw new Error(`本日のアップロード上限 ${limits.dailyUploadLimit} 件に達しています。`);
    }

    return;
  }

  if (!ipHash) {
    throw new Error("アップロード元を確認できませんでした。");
  }

  const settings = await getQuickShareSettings();
  const count = await countQuickSharesToday({ ipHash });

  if (count >= settings.anonymousDailyLimit) {
    throw new Error(`本日のアップロード上限 ${settings.anonymousDailyLimit} 件に達しています。ログインすると上限が緩和されます。`);
  }
}

export function startOfQuickShareDay(now: Date = new Date()) {
  const date = new Date(now.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

export function nextQuickShareDayReset(now: Date = new Date()) {
  const date = startOfQuickShareDay(now);
  date.setDate(date.getDate() + 1);
  return date;
}
