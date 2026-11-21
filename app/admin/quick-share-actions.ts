"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { writeAuditLog } from "@/lib/admin/audit";
import { logApi } from "@/lib/api/log";
import { prisma } from "@/lib/db/prisma";
import { parseMegabytes } from "@/lib/format/megabytes";
import { isSha256Hex } from "@/lib/quick-client/checksums";
import { isDistributableAssetName, resetClientReleaseCache } from "@/lib/quick-client/releases";
import {
  clearQuickApiSettingsCache,
  getQuickApiSettings,
  githubRepoPattern,
  parseCertFingerprint,
  quickApiSettingKeys,
  semverPattern,
} from "@/lib/quick-share/api-settings";

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
  const fingerprintInput = z.string().trim().max(200).parse(formData.get("clientCertFingerprint") ?? "");
  const fingerprint = fingerprintInput === "" ? null : parseCertFingerprint(fingerprintInput);

  if (fingerprint && !fingerprint.ok) {
    throw new Error(
      fingerprint.reason === "sha1"
        ? "SHA-1(40桁)の拇印ではなく、SHA-256(64桁)のフィンガープリントを入力してください。"
        : "証明書のフィンガープリントは SHA-256(64桁の16進数。区切りなし、または2桁ずつコロン区切り)で入力してください。",
    );
  }

  const clientCertFingerprint = fingerprint?.ok ? fingerprint.value : "";

  const entries = [
    { key: quickApiSettingKeys.tokenIssuanceEnabled, value: tokenIssuanceEnabled ? "true" : "false" },
    { key: quickApiSettingKeys.tokenRateLimitPerMinute, value: String(tokenRateLimitPerMinute) },
    { key: quickApiSettingKeys.anonymousRateLimitPerMinute, value: String(anonymousRateLimitPerMinute) },
    { key: quickApiSettingKeys.authFailureLimitPer10Minutes, value: String(authFailureLimitPer10Minutes) },
    { key: quickApiSettingKeys.clientGithubRepo, value: clientGithubRepo },
    { key: quickApiSettingKeys.clientMinSupportedVersion, value: clientMinSupportedVersion },
    { key: quickApiSettingKeys.clientReleaseCacheSeconds, value: String(clientReleaseCacheSeconds) },
    { key: quickApiSettingKeys.clientSupportedOs, value: clientSupportedOs },
    { key: quickApiSettingKeys.clientCertFingerprint, value: clientCertFingerprint },
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
  resetClientReleaseCache();

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

const checksumTagSchema = z.string().trim().regex(/^[\x21-\x7e]{1,100}$/, "タグ名を入力してください。");
const checksumAssetSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => isDistributableAssetName(value) && !/[\\/\u0000-\u001f]/.test(value), "配布ファイル名(.exe / .msix)を入力してください。");
const checksumSha256Schema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine(isSha256Hex, "SHA-256 は64桁の16進数で入力してください。");

/**
 * 配布ファイルの SHA-256 を手動で登録する(リリースに SHA256SUMS が無い・壊れている場合のフォールバック)。
 * 同じリポジトリ・タグ・ファイル名は上書き。監査ログに記録し、リリース情報のキャッシュを捨てる。
 */
export async function registerClientAssetChecksum(formData: FormData) {
  const admin = await requireAdmin();
  const settings = await getQuickApiSettings();
  const tag = checksumTagSchema.parse(formData.get("tag") ?? "");
  const assetName = checksumAssetSchema.parse(formData.get("assetName") ?? "");
  const sha256 = checksumSha256Schema.parse(formData.get("sha256") ?? "");
  const repo = settings.clientGithubRepo;

  const before = await prisma.quickClientAssetChecksum.findUnique({
    where: { repo_tag_assetName: { repo, tag, assetName } },
  });
  const after = await prisma.quickClientAssetChecksum.upsert({
    where: { repo_tag_assetName: { repo, tag, assetName } },
    update: { sha256, createdByAdminId: admin.id },
    create: { repo, tag, assetName, sha256, createdByAdminId: admin.id },
  });

  await writeAuditLog({
    adminId: admin.id,
    action: before ? "quick_client.checksum.update" : "quick_client.checksum.create",
    targetType: "quick_client_asset_checksum",
    targetId: after.id,
    beforeData: before ?? undefined,
    afterData: after,
  });
  logApi("info", { event: "quick_client.checksum_registered", repo, reason: `${tag} ${assetName}` });

  resetClientReleaseCache();
  revalidatePath("/admin/api-tokens");
  revalidatePath("/qick/download");
}

export async function deleteClientAssetChecksum(formData: FormData) {
  const admin = await requireAdmin();
  const id = idSchema.parse(formData.get("checksumId"));
  const before = await prisma.quickClientAssetChecksum.findUnique({ where: { id } });

  if (!before) {
    revalidatePath("/admin/api-tokens");
    return;
  }

  await prisma.quickClientAssetChecksum.deleteMany({ where: { id } });
  await writeAuditLog({
    adminId: admin.id,
    action: "quick_client.checksum.delete",
    targetType: "quick_client_asset_checksum",
    targetId: id,
    beforeData: before,
  });

  resetClientReleaseCache();
  revalidatePath("/admin/api-tokens");
  revalidatePath("/qick/download");
}
