import { z } from "zod";
import { logApi } from "@/lib/api/log";
import { prisma } from "@/lib/db/prisma";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";

/** 最後に取得できたリリース情報を残す SiteSetting(再起動後や GitHub 障害時のフォールバック) */
export const releaseCacheSettingKey = "quick_client_release_cache";
const FAILURE_BACKOFF_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;

export type ClientReleaseAsset = {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string | null;
};

export type ClientRelease = {
  repo: string;
  version: string;
  publishedAt: string;
  notes: string;
  htmlUrl: string;
  assets: ClientReleaseAsset[];
};

const githubReleaseSchema = z.object({
  tag_name: z.string().min(1).max(100),
  published_at: z.string().nullable(),
  body: z.string().nullable().optional(),
  html_url: z.string().url(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  assets: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        browser_download_url: z.string().url(),
        size: z.number().int().nonnegative(),
        digest: z.string().nullable().optional(),
      }),
    )
    .max(100),
});

const storedReleaseSchema = z.object({
  repo: z.string(),
  version: z.string(),
  publishedAt: z.string(),
  notes: z.string(),
  htmlUrl: z.string(),
  assets: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      sizeBytes: z.number(),
      sha256: z.string().nullable(),
    }),
  ),
});

const isGithubUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "github.com" || url.hostname.endsWith(".githubusercontent.com"));
  } catch {
    return false;
  }
};

/** GitHub API の応答を契約の形に変換する。想定外の URL は捨てる */
export function toClientRelease(repo: string, raw: unknown): ClientRelease | null {
  const parsed = githubReleaseSchema.safeParse(raw);

  if (!parsed.success || parsed.data.draft || !isGithubUrl(parsed.data.html_url)) {
    return null;
  }

  const release = parsed.data;

  return {
    repo,
    version: release.tag_name.replace(/^v/i, ""),
    publishedAt: release.published_at ? new Date(release.published_at).toISOString() : new Date(0).toISOString(),
    notes: (release.body ?? "").slice(0, 20_000),
    htmlUrl: release.html_url,
    assets: release.assets
      .filter((asset) => isGithubUrl(asset.browser_download_url))
      .map((asset) => ({
        name: asset.name,
        url: asset.browser_download_url,
        sizeBytes: asset.size,
        sha256: asset.digest?.startsWith("sha256:") && /^[0-9a-f]{64}$/i.test(asset.digest.slice(7)) ? asset.digest.slice(7).toLowerCase() : null,
      })),
  };
}

type CacheState = {
  release: ClientRelease | null;
  /** 次に GitHub へ問い合わせてよい時刻 */
  refreshAfter: number;
  repo: string;
};

let cache: CacheState | null = null;
let inflight: Promise<ClientRelease | null> | null = null;

export function resetClientReleaseCache() {
  cache = null;
  inflight = null;
}

/**
 * 最新リリース。メモリに TTL(管理画面の設定)だけ保持し、期限切れなら GitHub に問い合わせる。
 * 失敗したら最後に成功した結果(メモリ → DB)を返し、1分は再試行しない。
 * 未認証の GitHub API は 60回/時/IP なので、TTL 600秒なら 6回/時に収まる。
 */
export async function getLatestClientRelease(now: number = Date.now()): Promise<ClientRelease | null> {
  const settings = await getQuickApiSettings();
  const repo = settings.clientGithubRepo;

  if (cache && cache.repo === repo && cache.refreshAfter > now) {
    return cache.release;
  }

  if (!inflight) {
    inflight = refresh(repo, settings.clientReleaseCacheSeconds * 1000, now).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

async function refresh(repo: string, ttlMs: number, now: number) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Clipshare-Server",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`GitHub responded ${response.status}`);
    }

    const release = toClientRelease(repo, (await response.json()) as unknown);

    if (!release) {
      throw new Error("Unexpected GitHub release payload");
    }

    cache = { release, refreshAfter: now + ttlMs, repo };
    await persist(release);
    return release;
  } catch (error) {
    logApi("warn", { event: "quick_client.release_fetch_failed", reason: error instanceof Error ? error.message : "unknown" });
    const fallback = cache?.repo === repo && cache.release ? cache.release : await loadPersisted(repo);
    cache = { release: fallback, refreshAfter: now + FAILURE_BACKOFF_MS, repo };
    return fallback;
  }
}

async function persist(release: ClientRelease) {
  try {
    await prisma.siteSetting.upsert({
      where: { key: releaseCacheSettingKey },
      update: { value: JSON.stringify(release) },
      create: { key: releaseCacheSettingKey, value: JSON.stringify(release), description: "Last successful Clipshare Quick release lookup." },
    });
  } catch (error) {
    logApi("warn", { event: "quick_client.release_persist_failed", reason: error instanceof Error ? error.name : "unknown" });
  }
}

async function loadPersisted(repo: string): Promise<ClientRelease | null> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: releaseCacheSettingKey } });

    if (!row) {
      return null;
    }

    const parsed = storedReleaseSchema.safeParse(JSON.parse(row.value) as unknown);
    return parsed.success && parsed.data.repo === repo ? parsed.data : null;
  } catch {
    return null;
  }
}

/** ダウンロードボタンに使うインストーラー(MSIX を優先) */
export function pickInstallerAsset(release: ClientRelease | null) {
  if (!release) {
    return null;
  }

  const lower = (asset: ClientReleaseAsset) => asset.name.toLowerCase();
  return (
    release.assets.find((asset) => lower(asset).endsWith(".msix")) ??
    release.assets.find((asset) => lower(asset).endsWith(".msixbundle")) ??
    null
  );
}
