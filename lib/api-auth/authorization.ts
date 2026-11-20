import { Prisma, type ApiAuthorization } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { logApi } from "@/lib/api/log";
import {
  AUTHORIZATION_CODE_TTL_MS,
  AUTHORIZATION_REQUEST_TTL_MS,
  buildRedirectUrl,
  type AuthorizeParams,
} from "@/lib/api-auth/authorize-params";
import {
  generateApiToken,
  generateAuthorizationCode,
  generateCsrfToken,
  hashSecret,
  secretMatchesHash,
  verifyPkceS256,
} from "@/lib/api-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";

const STALE_AUTHORIZATION_MS = 24 * 60 * 60 * 1000;

export type StartAuthorizationResult =
  | { kind: "ready"; authorization: ApiAuthorization; csrfToken: string }
  | { kind: "invalid"; reason: string };

/**
 * 認可画面の表示時に呼ぶ。同じ code_challenge の未処理要求(同じユーザー・同じ内容)は再利用するので、
 * 再読み込みで行が増えない。処理済み・期限切れ・別ユーザー・内容違いは invalid。
 */
export async function startAuthorization(userId: string, params: AuthorizeParams, now: Date = new Date()): Promise<StartAuthorizationResult> {
  await deleteStaleAuthorizations(now);

  const { csrfToken, csrfTokenHash } = generateCsrfToken();
  const existing = await prisma.apiAuthorization.findUnique({
    where: { codeChallenge: params.code_challenge },
  });

  if (existing) {
    if (
      existing.userId !== userId ||
      existing.status !== "PENDING" ||
      existing.expiresAt <= now ||
      existing.redirectUri !== params.redirect_uri ||
      existing.state !== params.state ||
      existing.connectionCode !== params.connection_code ||
      existing.deviceName !== params.device_name ||
      existing.clientId !== params.client_id
    ) {
      return { kind: "invalid", reason: "reused_or_expired_request" };
    }

    const updated = await prisma.apiAuthorization.update({
      where: { id: existing.id },
      data: { csrfTokenHash },
    });

    return { kind: "ready", authorization: updated, csrfToken };
  }

  try {
    const authorization = await prisma.apiAuthorization.create({
      data: {
        userId,
        clientId: params.client_id,
        redirectUri: params.redirect_uri,
        state: params.state,
        codeChallenge: params.code_challenge,
        connectionCode: params.connection_code,
        deviceName: params.device_name,
        devicePlatform: params.device_platform ?? null,
        csrfTokenHash,
        expiresAt: new Date(now.getTime() + AUTHORIZATION_REQUEST_TTL_MS),
      },
    });

    return { kind: "ready", authorization, csrfToken };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { kind: "invalid", reason: "concurrent_request" };
    }

    throw error;
  }
}

export type DecideAuthorizationInput = {
  authorizationId: string;
  csrfToken: string;
  userId: string;
  approve: boolean;
};

export type DecideAuthorizationResult = { kind: "redirect"; location: string } | { kind: "invalid"; reason: string };

/** 「許可する」「キャンセル」の処理。CSRF トークン・本人・未処理・期限を確認してから状態を1回だけ変える */
export async function decideAuthorization(input: DecideAuthorizationInput, now: Date = new Date()): Promise<DecideAuthorizationResult> {
  const authorization = await prisma.apiAuthorization.findUnique({
    where: { id: input.authorizationId },
  });

  if (!authorization || authorization.userId !== input.userId) {
    return { kind: "invalid", reason: "not_found" };
  }

  if (!secretMatchesHash(input.csrfToken, authorization.csrfTokenHash)) {
    return { kind: "invalid", reason: "csrf_mismatch" };
  }

  if (authorization.status !== "PENDING" || authorization.expiresAt <= now) {
    return { kind: "invalid", reason: "already_decided_or_expired" };
  }

  if (!input.approve) {
    const denied = await prisma.apiAuthorization.updateMany({
      where: { id: authorization.id, status: "PENDING" },
      data: { status: "DENIED", decidedAt: now },
    });

    if (denied.count !== 1) {
      return { kind: "invalid", reason: "already_decided" };
    }

    return {
      kind: "redirect",
      location: buildRedirectUrl(authorization.redirectUri, { error: "access_denied", state: authorization.state }),
    };
  }

  const settings = await getQuickApiSettings();

  if (!settings.tokenIssuanceEnabled) {
    return { kind: "invalid", reason: "token_issuance_disabled" };
  }

  const { code, codeHash } = generateAuthorizationCode();
  const approved = await prisma.apiAuthorization.updateMany({
    where: { id: authorization.id, status: "PENDING" },
    data: {
      status: "APPROVED",
      decidedAt: now,
      codeHash,
      codeExpiresAt: new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS),
    },
  });

  if (approved.count !== 1) {
    return { kind: "invalid", reason: "already_decided" };
  }

  return {
    kind: "redirect",
    location: buildRedirectUrl(authorization.redirectUri, { code, state: authorization.state }),
  };
}

export type ExchangeCodeInput = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  ipHash: string;
  clientVersion: string | null;
  requestId: string;
};

export type ExchangeCodeResult = {
  token: string;
  tokenId: string;
  user: {
    id: string;
    name: string;
  };
};

const invalidGrant = (reason: string) => new ApiError("INVALID_REQUEST", { message: "認可コードが無効です。アプリから連携をやり直してください。", reason });

/** 認可コード + PKCE verifier をトークンに交換する。コードは原子的に1回だけ使える */
export async function exchangeAuthorizationCode(input: ExchangeCodeInput, now: Date = new Date()): Promise<ExchangeCodeResult> {
  const authorization = await prisma.apiAuthorization.findUnique({
    where: { codeHash: hashSecret(input.code) },
    include: {
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

  if (!authorization) {
    throw invalidGrant("unknown_code");
  }

  if (authorization.usedAt) {
    // 使用済みコードの再提示 = 漏えいの可能性。発行済みトークンを失効させる(RFC 6749 4.1.2)
    if (authorization.apiTokenId) {
      await prisma.apiToken.updateMany({
        where: { id: authorization.apiTokenId, revokedAt: null },
        data: { revokedAt: now, revokedReason: "CODE_REUSE" },
      });
    }

    logApi("warn", {
      event: "api_auth.code_reuse",
      requestId: input.requestId,
      userId: authorization.userId,
      tokenId: authorization.apiTokenId,
      ipHash: input.ipHash,
    });
    throw invalidGrant("code_reused");
  }

  if (authorization.status !== "APPROVED" || !authorization.codeExpiresAt || authorization.codeExpiresAt <= now) {
    throw invalidGrant("code_expired_or_not_approved");
  }

  if (authorization.redirectUri !== input.redirectUri) {
    throw invalidGrant("redirect_uri_mismatch");
  }

  if (!verifyPkceS256(input.codeVerifier, authorization.codeChallenge)) {
    throw invalidGrant("pkce_mismatch");
  }

  const settings = await getQuickApiSettings();

  if (!settings.tokenIssuanceEnabled) {
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "現在、新しい連携を受け付けていません。", reason: "token_issuance_disabled" });
  }

  if (authorization.user.isBanned) {
    throw new ApiError("FORBIDDEN", { message: "このアカウントは利用できません。", reason: "user_banned" });
  }

  const generated = generateApiToken();

  const approved = authorization;
  const issueTokenTransaction = () =>
    prisma.$transaction(async (tx) => {
      const used = await tx.apiAuthorization.updateMany({
        where: { id: approved.id, usedAt: null },
        data: { usedAt: now },
      });

      if (used.count !== 1) {
        throw invalidGrant("code_reused_concurrently");
      }

      const created = await tx.apiToken.create({
        data: {
          userId: approved.userId,
          clientId: approved.clientId,
          name: approved.deviceName,
          platform: approved.devicePlatform,
          clientVersion: input.clientVersion,
          tokenHash: generated.tokenHash,
          prefix: generated.prefix,
          lastUsedAt: now,
          lastUsedIpHash: input.ipHash,
        },
      });

      await tx.apiAuthorization.update({
        where: { id: approved.id },
        data: { apiTokenId: created.id },
      });

      return created;
    });

  let tokenRow: Awaited<ReturnType<typeof prisma.apiToken.create>>;

  try {
    tokenRow = await issueTokenTransaction();
  } catch (error) {
    if (error instanceof ApiError && error.reason === "code_reused_concurrently") {
      // 同時の再使用: 先に成功した側のトークンも失効させる(ベストエフォート)
      const winner = await prisma.apiAuthorization.findUnique({ where: { id: authorization.id }, select: { apiTokenId: true } });
      if (winner?.apiTokenId) {
        await prisma.apiToken.updateMany({
          where: { id: winner.apiTokenId, revokedAt: null },
          data: { revokedAt: now, revokedReason: "CODE_REUSE" },
        });
      }
      logApi("warn", { event: "api_auth.code_reuse", requestId: input.requestId, userId: authorization.userId, tokenId: winner?.apiTokenId ?? null, ipHash: input.ipHash });
    }
    throw error;
  }

  logApi("info", {
    event: "api_auth.token_issued",
    requestId: input.requestId,
    userId: authorization.userId,
    tokenId: tokenRow.id,
    ipHash: input.ipHash,
  });

  return {
    token: generated.token,
    tokenId: tokenRow.id,
    user: {
      id: authorization.user.id,
      name: displayNameOf(authorization.user),
    },
  };
}

/** 完了画面用: このユーザーが直近に許可した要求 */
export async function findRecentApprovedAuthorization(userId: string, now: Date = new Date()) {
  return prisma.apiAuthorization.findFirst({
    where: {
      userId,
      status: "APPROVED",
      decidedAt: {
        gte: new Date(now.getTime() - AUTHORIZATION_CODE_TTL_MS),
      },
    },
    orderBy: { decidedAt: "desc" },
    select: {
      deviceName: true,
      devicePlatform: true,
    },
  });
}

export function displayNameOf(user: { displayName: string | null; username: string | null; name: string | null }) {
  return user.displayName || user.username || user.name || "";
}

async function deleteStaleAuthorizations(now: Date) {
  try {
    await prisma.apiAuthorization.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(now.getTime() - STALE_AUTHORIZATION_MS),
        },
      },
    });
  } catch (error) {
    // 掃除の失敗で認可そのものは止めない
    logApi("warn", { event: "api_auth.cleanup_failed", reason: error instanceof Error ? error.name : "unknown" });
  }
}
