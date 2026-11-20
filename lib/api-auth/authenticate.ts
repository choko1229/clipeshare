import { ApiError } from "@/lib/api/errors";
import { parseClientVersion, type ApiRequestContext } from "@/lib/api/handler";
import { logApi } from "@/lib/api/log";
import { FixedWindowRateLimiter } from "@/lib/api/rate-limiter";
import { constantTimeEqual, hashSecret, looksLikeApiToken } from "@/lib/api-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";
import { computeClientIpHash } from "@/lib/quick-share/ip-hash";

export type ApiTokenUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
};

export type ApiAuthContext =
  | { kind: "anonymous"; ipHash: string }
  | {
      kind: "token";
      ipHash: string;
      tokenId: string;
      user: ApiTokenUser;
    };

const AUTH_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const LAST_USED_UPDATE_INTERVAL_MS = 60 * 1000;

export const authFailureLimiter = new FixedWindowRateLimiter(AUTH_FAILURE_WINDOW_MS);

/**
 * Bearer トークンの検証。ヘッダが無ければ匿名。ヘッダがあって不正・失効なら 401(匿名にはしない)。
 * 同じ IP からの認証失敗が続いたら 429 と警告ログ。
 */
export async function authenticateApiRequest(request: Request, context: ApiRequestContext): Promise<ApiAuthContext> {
  const ipHash = computeClientIpHash(request.headers);
  context.logFields.ipHash = ipHash;

  const header = request.headers.get("authorization");

  if (header === null) {
    return { kind: "anonymous", ipHash };
  }

  const settings = await getQuickApiSettings();
  const failureLimit = settings.authFailureLimitPer10Minutes;
  const blocked = authFailureLimiter.peek(ipHash, failureLimit);

  if (!blocked.allowed) {
    throw new ApiError("RATE_LIMITED", {
      details: { retryAfterSeconds: blocked.retryAfterSeconds },
      headers: { "Retry-After": String(blocked.retryAfterSeconds) },
      reason: "auth_failures_blocked",
    });
  }

  const match = /^Bearer ([^\s]+)$/i.exec(header.trim());
  const presented = match?.[1] ?? "";

  if (!looksLikeApiToken(presented)) {
    throw recordAuthFailure(ipHash, failureLimit, context, "malformed_token");
  }

  const presentedHash = hashSecret(presented);
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: presentedHash },
    select: {
      id: true,
      tokenHash: true,
      revokedAt: true,
      lastUsedAt: true,
      clientVersion: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
          isBanned: true,
        },
      },
    },
  });

  if (!token || !constantTimeEqual(token.tokenHash, presentedHash)) {
    throw recordAuthFailure(ipHash, failureLimit, context, "unknown_token");
  }

  context.logFields.tokenId = token.id;
  context.logFields.userId = token.user.id;

  if (token.revokedAt) {
    throw recordAuthFailure(ipHash, failureLimit, context, "revoked_token");
  }

  if (token.user.isBanned) {
    throw new ApiError("FORBIDDEN", { message: "このアカウントは利用できません。", reason: "user_banned" });
  }

  await touchToken(token, ipHash, parseClientVersion(request.headers.get("user-agent")), context);

  return {
    kind: "token",
    ipHash,
    tokenId: token.id,
    user: {
      id: token.user.id,
      username: token.user.username,
      displayName: token.user.displayName,
      name: token.user.name,
    },
  };
}

/** Bearer 必須の API 用 */
export async function requireApiToken(request: Request, context: ApiRequestContext) {
  const auth = await authenticateApiRequest(request, context);

  if (auth.kind !== "token") {
    throw new ApiError("UNAUTHORIZED", { reason: "missing_token" });
  }

  return auth;
}

function recordAuthFailure(ipHash: string, limit: number, context: ApiRequestContext, reason: string) {
  const result = authFailureLimiter.consume(ipHash, limit);

  if (!result.allowed || (Number.isFinite(result.remaining) && result.remaining === 0)) {
    logApi("warn", {
      event: "api_auth.repeated_failures",
      requestId: context.requestId,
      ipHash,
      reason,
    });
  }

  return new ApiError("UNAUTHORIZED", { reason });
}

async function touchToken(
  token: { id: string; lastUsedAt: Date | null; clientVersion: string | null },
  ipHash: string,
  clientVersion: string | null,
  context: ApiRequestContext,
) {
  const now = Date.now();
  const versionChanged = clientVersion !== null && clientVersion !== token.clientVersion;

  if (!versionChanged && token.lastUsedAt && now - token.lastUsedAt.getTime() < LAST_USED_UPDATE_INTERVAL_MS) {
    return;
  }

  try {
    await prisma.apiToken.update({
      where: { id: token.id },
      data: {
        lastUsedAt: new Date(now),
        lastUsedIpHash: ipHash,
        ...(versionChanged ? { clientVersion } : {}),
      },
    });
  } catch (error) {
    // 最終使用時刻の更新失敗で本処理は止めない
    logApi("warn", {
      event: "api_auth.touch_failed",
      requestId: context.requestId,
      tokenId: token.id,
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}
