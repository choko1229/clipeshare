import { getQuickShareSizeLimits } from "@/lib/quick-share/limits";
import { getQuickShareDailyUsage, type QuickShareDailyOwner } from "@/lib/quick-share/rate-limit";

/** API 契約の `Limits`。0 = 無制限 */
export type ApiLimits = {
  imageMaxBytes: number;
  videoMaxBytes: number;
  dailyLimit: number;
  dailyUsed: number;
  resetsAt: string;
  banner: boolean;
};

export type ApiLimitsSubject = { kind: "token"; userId: string } | { kind: "anonymous"; ipHash: string };

export function dailyOwnerOf(subject: ApiLimitsSubject): QuickShareDailyOwner {
  return subject.kind === "token" ? { userId: subject.userId } : { ipHash: subject.ipHash };
}

export async function getApiLimits(subject: ApiLimitsSubject, now: Date = new Date()): Promise<ApiLimits> {
  const [sizeLimits, daily] = await Promise.all([
    getQuickShareSizeLimits(subject.kind === "token" ? subject.userId : null),
    getQuickShareDailyUsage(dailyOwnerOf(subject), now),
  ]);

  return {
    imageMaxBytes: sizeLimits.imageMaxBytes,
    videoMaxBytes: sizeLimits.videoMaxBytes,
    dailyLimit: daily.limit ?? 0,
    dailyUsed: daily.used,
    resetsAt: daily.resetsAt.toISOString(),
    // バナーは API 経由のみ分岐: トークンあり=なし、匿名=あり
    banner: subject.kind === "anonymous",
  };
}
