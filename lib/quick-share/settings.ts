import { prisma } from "@/lib/db/prisma";

export const quickShareSettingKeys = {
  maxImageBytes: "quick_share_max_image_bytes",
  maxVideoBytes: "quick_share_max_video_bytes",
  retentionHours: "quick_share_retention_hours",
  anonymousDailyLimit: "quick_share_anonymous_daily_limit",
} as const;

export const quickShareDefaults = {
  maxImageBytes: 20_000_000,
  maxVideoBytes: 200_000_000,
  retentionHours: 24,
  anonymousDailyLimit: 5,
};

export type QuickShareSettings = {
  maxImageBytes: number;
  maxVideoBytes: number;
  retentionHours: number;
  anonymousDailyLimit: number;
};

export async function getQuickShareSettings(): Promise<QuickShareSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: Object.values(quickShareSettingKeys),
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const settingMap = new Map(rows.map((row) => [row.key, row.value]));

  return {
    maxImageBytes: parsePositiveInt(settingMap.get(quickShareSettingKeys.maxImageBytes), quickShareDefaults.maxImageBytes),
    maxVideoBytes: parsePositiveInt(settingMap.get(quickShareSettingKeys.maxVideoBytes), quickShareDefaults.maxVideoBytes),
    retentionHours: parsePositiveInt(settingMap.get(quickShareSettingKeys.retentionHours), quickShareDefaults.retentionHours),
    anonymousDailyLimit: parsePositiveInt(
      settingMap.get(quickShareSettingKeys.anonymousDailyLimit),
      quickShareDefaults.anonymousDailyLimit,
    ),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
