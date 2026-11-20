import { ApiError } from "@/lib/api/errors";
import { apiNoContent, apiRoute } from "@/lib/api/handler";
import { logApi } from "@/lib/api/log";
import { enforceApiRateLimit } from "@/lib/api/rate-limits";
import { authenticateApiRequest } from "@/lib/api-auth/authenticate";
import { constantTimeEqual } from "@/lib/api-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { deleteQuickShareRecord } from "@/lib/quick-share/delete-quick-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = (reason: string) => new ApiError("NOT_FOUND", { reason });

/**
 * Bearer: 本人が API 経由でアップロードしたものだけ削除できる。
 * 匿名: X-Delete-Token が一致すれば削除できる。
 * どの失敗も 404(存在や所有者を漏らさない)。
 */
export const DELETE = apiRoute<{ id: string }>("/api/v1/quick/[id]", async (request, context, params) => {
  const auth = await authenticateApiRequest(request, context);
  await enforceApiRateLimit(auth.kind === "token" ? { kind: "token", tokenId: auth.tokenId } : { kind: "anonymous", ipHash: auth.ipHash });

  const publicId = params.id;

  if (!/^[A-Za-z0-9_-]{1,32}$/.test(publicId)) {
    throw notFound("invalid_id");
  }

  const quickShare = await prisma.quickShare.findUnique({ where: { publicId } });

  if (!quickShare || quickShare.deletedAt !== null || quickShare.expiresAt <= new Date()) {
    throw notFound("missing_or_gone");
  }

  if (auth.kind === "token") {
    if (quickShare.userId !== auth.user.id || quickShare.apiTokenId === null) {
      throw notFound("not_owner");
    }
  } else {
    const presented = request.headers.get("x-delete-token") ?? "";

    if (quickShare.userId !== null || presented.length === 0 || presented.length > 64 || !constantTimeEqual(presented, quickShare.deleteToken)) {
      throw notFound("delete_token_mismatch");
    }
  }

  await deleteQuickShareRecord(quickShare);
  logApi("info", { event: "quick_share.deleted", requestId: context.requestId, userId: quickShare.userId, tokenId: quickShare.apiTokenId });
  return apiNoContent(context);
});
