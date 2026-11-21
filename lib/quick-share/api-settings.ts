import { prisma } from "@/lib/db/prisma";

/** Clipshare Quick 連携の設定(SiteSetting に保存し、管理画面から変更する) */
export const quickApiSettingKeys = {
  tokenIssuanceEnabled: "quick_api_token_issuance_enabled",
  tokenRateLimitPerMinute: "quick_api_rate_limit_token_per_minute",
  anonymousRateLimitPerMinute: "quick_api_rate_limit_anonymous_per_minute",
  authFailureLimitPer10Minutes: "quick_api_auth_failure_limit_per_10min",
  clientGithubRepo: "quick_client_github_repo",
  clientMinSupportedVersion: "quick_client_min_supported_version",
  clientReleaseCacheSeconds: "quick_client_release_cache_seconds",
  clientSupportedOs: "quick_client_supported_os",
  clientCertFingerprint: "quick_client_cert_fingerprint",
} as const;

export const quickApiDefaults = {
  tokenIssuanceEnabled: true,
  tokenRateLimitPerMinute: 30,
  anonymousRateLimitPerMinute: 10,
  authFailureLimitPer10Minutes: 20,
  clientGithubRepo: "choko1229/clipshare-qick",
  clientMinSupportedVersion: null,
  clientReleaseCacheSeconds: 600,
  clientSupportedOs: "Windows 11",
  clientCertFingerprint: null,
} as const;

export type QuickApiSettings = {
  tokenIssuanceEnabled: boolean;
  /** 0 = 無制限 */
  tokenRateLimitPerMinute: number;
  anonymousRateLimitPerMinute: number;
  authFailureLimitPer10Minutes: number;
  clientGithubRepo: string;
  clientMinSupportedVersion: string | null;
  clientReleaseCacheSeconds: number;
  clientSupportedOs: string;
  /** 自己署名証明書の SHA-256 フィンガープリント(大文字16進・コロン区切り)。DLページの信頼手順用 */
  clientCertFingerprint: string | null;
};

export const githubRepoPattern = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
export const semverPattern = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/;

/** "AB:CD:…" / "abcd…" / 空白区切りを受け付け、"AB:CD:…"(32組)に正規化する。不正なら null */
export function normalizeCertFingerprint(value: string) {
  const result = parseCertFingerprint(value);
  return result.ok ? result.value : null;
}

export type CertFingerprintParseResult = { ok: true; value: string } | { ok: false; reason: "sha1" | "format" };

/**
 * 自己署名証明書(Publisher `CN=choko1229`)の SHA-256 フィンガープリントの入力を検証する。
 * 受け付けるのは2形式だけ: 64桁の16進(区切りなし。PowerShell の GetCertHashString(SHA256) / certutil の出力)
 * または 2桁ずつコロン区切りの32組(openssl x509 -fingerprint -sha256 の出力)。大文字小文字は問わない。
 * Windows の証明書画面が既定で出す「拇印」は SHA-1(40桁)なので、別の理由で拒否する。
 */
export function parseCertFingerprint(input: string): CertFingerprintParseResult {
  const value = input.trim();
  const plain = /^[0-9A-Fa-f]{64}$/.test(value);
  const colon = /^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){31}$/.test(value);

  if (plain || colon) {
    const hex = value.replace(/:/g, "").toUpperCase();
    return { ok: true, value: (hex.match(/.{2}/g) ?? []).join(":") };
  }

  if (/^[0-9A-Fa-f]{40}$/.test(value) || /^[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){19}$/.test(value)) {
    return { ok: false, reason: "sha1" };
  }

  return { ok: false, reason: "format" };
}

const CACHE_MS = 10_000;
let cached: { value: QuickApiSettings; expiresAt: number } | null = null;

export function clearQuickApiSettingsCache() {
  cached = null;
}

export async function getQuickApiSettings(): Promise<QuickApiSettings> {
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const rows = await prisma.siteSetting.findMany({
    where: {
      key: {
        in: Object.values(quickApiSettingKeys),
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const value = parseQuickApiSettings(new Map(rows.map((row) => [row.key, row.value])));
  cached = { value, expiresAt: now + CACHE_MS };
  return value;
}

export function parseQuickApiSettings(settingMap: Map<string, string>): QuickApiSettings {
  const repo = settingMap.get(quickApiSettingKeys.clientGithubRepo)?.trim() ?? "";
  const minVersion = settingMap.get(quickApiSettingKeys.clientMinSupportedVersion)?.trim() ?? "";
  const os = settingMap.get(quickApiSettingKeys.clientSupportedOs)?.trim() ?? "";

  return {
    tokenIssuanceEnabled: parseBoolean(settingMap.get(quickApiSettingKeys.tokenIssuanceEnabled), quickApiDefaults.tokenIssuanceEnabled),
    tokenRateLimitPerMinute: parseNonNegativeInt(
      settingMap.get(quickApiSettingKeys.tokenRateLimitPerMinute),
      quickApiDefaults.tokenRateLimitPerMinute,
    ),
    anonymousRateLimitPerMinute: parseNonNegativeInt(
      settingMap.get(quickApiSettingKeys.anonymousRateLimitPerMinute),
      quickApiDefaults.anonymousRateLimitPerMinute,
    ),
    authFailureLimitPer10Minutes: parseNonNegativeInt(
      settingMap.get(quickApiSettingKeys.authFailureLimitPer10Minutes),
      quickApiDefaults.authFailureLimitPer10Minutes,
    ),
    clientGithubRepo: githubRepoPattern.test(repo) ? repo : quickApiDefaults.clientGithubRepo,
    clientMinSupportedVersion: semverPattern.test(minVersion) ? minVersion : null,
    clientReleaseCacheSeconds: clamp(
      parseNonNegativeInt(settingMap.get(quickApiSettingKeys.clientReleaseCacheSeconds), quickApiDefaults.clientReleaseCacheSeconds),
      60,
      86_400,
    ),
    clientSupportedOs: os ? os.slice(0, 64) : quickApiDefaults.clientSupportedOs,
    clientCertFingerprint: normalizeCertFingerprint(settingMap.get(quickApiSettingKeys.clientCertFingerprint) ?? ""),
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  if (value === undefined || !/^\d{1,9}$/.test(value)) {
    return fallback;
  }

  return Number.parseInt(value, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
