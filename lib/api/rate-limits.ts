import { ApiError } from "@/lib/api/errors";
import { FixedWindowRateLimiter } from "@/lib/api/rate-limiter";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";

export const apiRequestLimiter = new FixedWindowRateLimiter(60 * 1000);

export type RateLimitSubject = { kind: "token"; tokenId: string } | { kind: "anonymous"; ipHash: string };

/** `/api/v1/*` のリクエスト数制限。トークンごと、匿名は IP ハッシュごと(値は管理画面で変更) */
export async function enforceApiRateLimit(subject: RateLimitSubject) {
  const settings = await getQuickApiSettings();
  const [key, limit] =
    subject.kind === "token"
      ? [`token:${subject.tokenId}`, settings.tokenRateLimitPerMinute]
      : [`ip:${subject.ipHash}`, settings.anonymousRateLimitPerMinute];

  const result = apiRequestLimiter.consume(key, limit);

  if (!result.allowed) {
    throw new ApiError("RATE_LIMITED", {
      details: { retryAfterSeconds: result.retryAfterSeconds },
      headers: { "Retry-After": String(result.retryAfterSeconds) },
      reason: `rate_limited_${subject.kind}`,
    });
  }
}
