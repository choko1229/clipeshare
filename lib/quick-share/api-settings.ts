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
};

export const githubRepoPattern = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
export const semverPattern = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/;

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
