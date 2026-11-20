import { getQuickShareSettings, type QuickShareSettings } from "@/lib/quick-share/settings";
import { getUploadLimitsForUser } from "@/lib/uploads/account-limits";

/** サイズ上限(バイト)。0 = 無制限 */
export type QuickShareSizeLimits = {
  imageMaxBytes: number;
  videoMaxBytes: number;
};

type LevelQuickShareLimits = {
  quickShareImageMaxBytes: number | null;
  quickShareVideoMaxBytes: number | null;
};

/**
 * レベル別の上限があればそれを、無ければ(NULL)サイト全体設定を使う。0 は無制限としてそのまま返す。
 * 匿名(level=null)は常にサイト全体設定。
 */
export function resolveQuickShareSizeLimits(
  level: LevelQuickShareLimits | null,
  settings: Pick<QuickShareSettings, "maxImageBytes" | "maxVideoBytes">,
): QuickShareSizeLimits {
  return {
    imageMaxBytes: normalizeLimit(level?.quickShareImageMaxBytes ?? null, settings.maxImageBytes),
    videoMaxBytes: normalizeLimit(level?.quickShareVideoMaxBytes ?? null, settings.maxVideoBytes),
  };
}

export function exceedsSizeLimit(sizeBytes: number, limitBytes: number) {
  return limitBytes > 0 && sizeBytes > limitBytes;
}

export async function getQuickShareSizeLimits(userId: string | null): Promise<QuickShareSizeLimits> {
  const settings = await getQuickShareSettings();

  if (!userId) {
    return resolveQuickShareSizeLimits(null, settings);
  }

  const limits = await getUploadLimitsForUser(userId);
  return resolveQuickShareSizeLimits(limits, settings);
}

function normalizeLimit(levelValue: number | null, fallback: number) {
  if (levelValue === null) {
    return fallback;
  }

  return Number.isSafeInteger(levelValue) && levelValue >= 0 ? levelValue : fallback;
}
