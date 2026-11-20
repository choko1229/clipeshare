import type { ApiTokenRevokeReason } from "@prisma/client";
import { logApi } from "@/lib/api/log";
import { prisma } from "@/lib/db/prisma";

/** 失効済みでなければ失効させる。本人のトークンでなければ何もしない(false) */
export async function revokeOwnApiToken(tokenId: string, userId: string, reason: ApiTokenRevokeReason, now: Date = new Date()) {
  const result = await prisma.apiToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });

  if (result.count > 0) {
    logApi("info", { event: "api_token.revoked", userId, tokenId, reason });
  }

  return result.count > 0;
}

/** 連携アプリ管理(画面13)用。有効なトークンと今日の件数 */
export async function listActiveApiTokensForUser(userId: string, startOfDay: Date) {
  const tokens = await prisma.apiToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      platform: true,
      clientVersion: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  if (tokens.length === 0) {
    return [];
  }

  const counts = await prisma.quickShare.groupBy({
    by: ["apiTokenId"],
    where: {
      apiTokenId: { in: tokens.map((token) => token.id) },
      createdAt: { gte: startOfDay },
    },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((row) => [row.apiTokenId, row._count._all]));

  return tokens.map((token) => ({
    ...token,
    todayCount: countById.get(token.id) ?? 0,
  }));
}
