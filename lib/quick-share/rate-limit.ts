import { prisma } from "@/lib/db/prisma";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { getUploadLimitsForUser } from "@/lib/uploads/account-limits";

type AssertQuickShareRateLimitInput = {
  userId: string | null;
  ipHash: string | null;
};

export async function assertQuickShareRateLimit({ userId, ipHash }: AssertQuickShareRateLimitInput) {
  if (userId) {
    const limits = await getUploadLimitsForUser(userId);

    if (limits.dailyUploadLimit === null) {
      return;
    }

    const count = await prisma.quickShare.count({
      where: {
        userId,
        createdAt: {
          gte: startOfDay(),
        },
      },
    });

    if (count >= limits.dailyUploadLimit) {
      throw new Error(`本日のアップロード上限 ${limits.dailyUploadLimit} 件に達しています。`);
    }

    return;
  }

  if (!ipHash) {
    throw new Error("アップロード元を確認できませんでした。");
  }

  const settings = await getQuickShareSettings();
  const count = await prisma.quickShare.count({
    where: {
      ipHash,
      createdAt: {
        gte: startOfDay(),
      },
    },
  });

  if (count >= settings.anonymousDailyLimit) {
    throw new Error(`本日のアップロード上限 ${settings.anonymousDailyLimit} 件に達しています。ログインすると上限が緩和されます。`);
  }
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
