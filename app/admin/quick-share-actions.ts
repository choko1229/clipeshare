"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { logApi } from "@/lib/api/log";
import { prisma } from "@/lib/db/prisma";
import { parseMegabytes } from "@/lib/format/megabytes";
import { clearQuickApiSettingsCache, githubRepoPattern, quickApiSettingKeys, semverPattern } from "@/lib/quick-share/api-settings";

const idSchema = z.string().min(1).max(64);
/** 空欄 = NULL(サイト全体設定を使う)、0 = 無制限 */
const optionalMegabytes = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") {
      return null;
    }

    const bytes = parseMegabytes(value);

    if (bytes === null) {
      context.addIssue({ code: "custom", message: "0以上のMBで入力してください。" });
      return z.NEVER;
    }

    return bytes;
  });

/** 画面20: アカウントレベルのクイック共有上限(画像/動画 MB)だけを更新する */
export async function updateAccountLevelQuickShareLimits(formData: FormData) {
  const admin = await requireAdmin();
  const accountLevelId = idSchema.parse(formData.get("accountLevelId"));
  const quickShareImageMaxBytes = optionalMegabytes.parse(formData.get("quickShareImageMaxMb") ?? "");
  const quickShareVideoMaxBytes = optionalMegabytes.parse(formData.get("quickShareVideoMaxMb") ?? "");

  const before = await prisma.accountLevel.findUnique({
    where: { id: accountLevelId },
    select: { id: true, name: true, quickShareImageMaxBytes: true, quickShareVideoMaxBytes: true },
  });

  if (!before) {
    throw new Error("アカウントレベルが見つかりません。");
  }

  const after = await prisma.accountLevel.update({
    where: { id: accountLevelId },
    data: { quickShareImageMaxBytes, quickShareVideoMaxBytes },
    select: { id: true, name: true, quickShareImageMaxBytes: true, quickShareVideoMaxBytes: true },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: "account_level.update_quick_share_limits",
    targetType: "account_level",
    targetId: accountLevelId,
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/quick-share");
}

/** トークン管理: 他ユーザーのトークンを失効させる(値は扱わない)。監査ログに記録 */
export async function revokeApiTokenByAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const tokenId = idSchema.parse(formData.get("tokenId"));
  const reason = z.string().trim().max(500).optional().parse(formData.get("reason") || undefined) ?? null;

  const before = await prisma.apiToken.findUnique({
    where: { id: tokenId },
    select: { id: true, userId: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true, revokedReason: true },
  });

  if (!before) {
    throw new Error("トークンが見つかりません。");
  }

  if (before.revokedAt) {
    revalidatePath("/admin/api-tokens");
    return;
  }

  // 監査ログには識別用の項目だけを明示的に残す(トークンのハッシュ等は入れない)
  const snapshot = {
    id: before.id,
    userId: before.userId,
    name: before.name,
    prefix: before.prefix,
    createdAt: before.createdAt,
    lastUsedAt: before.lastUsedAt,
    revokedAt: before.revokedAt,
    revokedReason: before.revokedReason,
  };
  const now = new Date();
  const result = await prisma.apiToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: now, revokedReason: "ADMIN" },
  });

  if (result.count > 0) {
    await writeAuditLog({
      adminId: admin.id,
      action: "api_token.revoke",
      targetType: "api_token",
      targetId: tokenId,
      beforeData: snapshot,
      afterData: { ...snapshot, revokedAt: now, revokedReason: "ADMIN" },
      reason,
    });
    logApi("info", { event: "api_token.revoked", userId: before.userId, tokenId, reason: "ADMIN" });
  }

  revalidatePath("/admin/api-tokens");
}

const nonNegativeInt = (max: number) => z.coerce.number().int().min(0).max(max);

/** Clipshare Quick 連携の設定(トークン発行の緊急停止、レート制限、配布元) */
export async function updateQuickApiSettings(formData: FormData) {
  const admin = await requireAdmin();
  const tokenIssuanceEnabled = formData.get("tokenIssuanceEnabled") === "on";
  const tokenRateLimitPerMinute = nonNegativeInt(100_000).parse(formData.get("tokenRateLimitPerMinute"));
  const anonymousRateLimitPerMinute = nonNegativeInt(100_000).parse(formData.get("anonymousRateLimitPerMinute"));
  const authFailureLimitPer10Minutes = nonNegativeInt(100_000).parse(formData.get("authFailureLimitPer10Minutes"));
  const clientGithubRepo = z.string().trim().regex(githubRepoPattern, "owner/repo の形式で入力してください。").parse(formData.get("clientGithubRepo"));
  const clientMinSupportedVersion = z
    .string()
    .trim()
    .refine((value) => value === "" || semverPattern.test(value), "1.2.3 の形式で入力してください。")
    .parse(formData.get("clientMinSupportedVersion") ?? "");
  const clientReleaseCacheSeconds = z.coerce.number().int().min(60).max(86_400).parse(formData.get("clientReleaseCacheSeconds"));
  const clientSupportedOs = z.string().trim().min(1).max(64).parse(formData.get("clientSupportedOs"));

  const entries = [
    { key: quickApiSettingKeys.tokenIssuanceEnabled, value: tokenIssuanceEnabled ? "true" : "false" },
    { key: quickApiSettingKeys.tokenRateLimitPerMinute, value: String(tokenRateLimitPerMinute) },
    { key: quickApiSettingKeys.anonymousRateLimitPerMinute, value: String(anonymousRateLimitPerMinute) },
    { key: quickApiSettingKeys.authFailureLimitPer10Minutes, value: String(authFailureLimitPer10Minutes) },
    { key: quickApiSettingKeys.clientGithubRepo, value: clientGithubRepo },
    { key: quickApiSettingKeys.clientMinSupportedVersion, value: clientMinSupportedVersion },
    { key: quickApiSettingKeys.clientReleaseCacheSeconds, value: String(clientReleaseCacheSeconds) },
    { key: quickApiSettingKeys.clientSupportedOs, value: clientSupportedOs },
  ];

  const before = await prisma.siteSetting.findMany({
    where: { key: { in: entries.map((entry) => entry.key) } },
  });

  const after = await prisma.$transaction(
    entries.map((entry) =>
      prisma.siteSetting.upsert({
        where: { key: entry.key },
        update: { value: entry.value, updatedByAdminId: admin.id },
        create: { key: entry.key, value: entry.value, updatedByAdminId: admin.id },
      }),
    ),
  );

  clearQuickApiSettingsCache();

  await writeAuditLog({
    adminId: admin.id,
    action: "site_setting.update_quick_api",
    targetType: "site_setting",
    targetId: "quick_api",
    beforeData: before,
    afterData: after,
  });

  revalidatePath("/admin/api-tokens");
  revalidatePath("/qick/download");
}
