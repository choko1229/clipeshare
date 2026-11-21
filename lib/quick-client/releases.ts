import { z } from "zod";
import { logApi } from "@/lib/api/log";
import { prisma } from "@/lib/db/prisma";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";
import { isSha256Hex, parseSha256Sums, SHA256SUMS_MAX_BYTES, sha256SumsAssetNames } from "@/lib/quick-client/checksums";
import { fetchFromGithub, GithubFetchError, isAllowedGithubUrl } from "@/lib/quick-client/github-fetch";

/** 最後に配信できたリリース(SHA-256 がすべて揃ったもの)。再起動後や GitHub 障害時のフォールバック */
export const releaseCacheSettingKey = "quick_client_release_cache";
/** 更新履歴(ダウンロードページ用)の最後の取得結果 */
export const releaseHistoryCacheSettingKey = "quick_client_release_history_cache";

const FAILURE_BACKOFF_MS = 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const RELEASE_LIST_MAX_BYTES = 2 * 1024 * 1024;
const RELEASE_LIST_PER_PAGE = 10;
/** 最新が配信不可(SHA-256 不足)のとき、遡って確認するリリース数 */
const MAX_RELEASES_TO_VERIFY = 3;

/**
 * 添付の SHA256SUMS が壊れているリリースを、管理画面の手動登録で配信可能にしてよいか。
 * false(既定・Q-026 承認済み 2026-11-22): 壊れた SHA256SUMS のリリースは手動登録があっても配信しない。
 * 方針を変えるときはここ1か所だけを切り替える(テスト「an invalid SHA256SUMS cannot be overridden…」も合わせて更新)。
 */
export const ALLOW_MANUAL_OVERRIDE_OF_INVALID_SHA256SUMS = false;

/** 配布ファイル(セットアップ exe と MSIX)。これ以外のアセットは返さない */
export function isDistributableAssetName(name: string) {
  return /\.(exe|msix|msixbundle)$/i.test(name);
}

export type ChecksumSource = "SHA256SUMS" | "MANUAL";

export type ClientReleaseAsset = {
  name: string;
  url: string;
  sizeBytes: number;
  /** 常に64桁の小文字16進(null にはならない) */
  sha256: string;
};

export type ClientRelease = {
  repo: string;
  tag: string;
  version: string;
  publishedAt: string;
  notes: string;
  htmlUrl: string;
  assets: ClientReleaseAsset[];
};

export type ClientReleaseHistoryEntry = {
  version: string;
  publishedAt: string;
  notes: string;
  htmlUrl: string;
};

export type ReleaseAssetStatus = {
  name: string;
  sha256: string | null;
  source: ChecksumSource | null;
};

/** 管理画面用: 直近のリリースごとの判定結果 */
export type ReleaseVerificationStatus = {
  tag: string;
  version: string;
  publishedAt: string;
  servable: boolean;
  reason: string | null;
  assets: ReleaseAssetStatus[];
};

const githubAssetSchema = z.object({
  name: z.string().min(1).max(255),
  browser_download_url: z.string().url(),
  size: z.number().int().nonnegative(),
  digest: z.string().nullable().optional(),
});

const githubReleaseSchema = z.object({
  tag_name: z.string().min(1).max(100),
  published_at: z.string().nullable(),
  body: z.string().nullable().optional(),
  html_url: z.string().url(),
  draft: z.boolean().optional(),
  prerelease: z.boolean().optional(),
  assets: z.array(githubAssetSchema).max(100),
});

type GithubRelease = z.infer<typeof githubReleaseSchema>;

const storedReleaseSchema = z.object({
  repo: z.string(),
  tag: z.string(),
  version: z.string(),
  publishedAt: z.string(),
  notes: z.string(),
  htmlUrl: z.string(),
  assets: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        sizeBytes: z.number(),
        sha256: z.string().refine(isSha256Hex),
      }),
    )
    .min(1),
});

const storedHistorySchema = z.object({
  repo: z.string(),
  entries: z.array(z.object({ version: z.string(), publishedAt: z.string(), notes: z.string(), htmlUrl: z.string() })),
});

function toVersion(tag: string) {
  return tag.replace(/^v/i, "");
}

function toPublishedAt(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function githubDigest(digest: string | null | undefined) {
  if (!digest?.startsWith("sha256:")) {
    return null;
  }
  const value = digest.slice(7).toLowerCase();
  return isSha256Hex(value) ? value : null;
}

/** GitHub の一覧応答から公開リリースだけを取り出す(下書き・プレリリース・不正な URL を除く) */
export function parseReleaseList(raw: unknown): GithubRelease[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => githubReleaseSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((release) => !release.draft && !release.prerelease && isAllowedGithubUrl(release.html_url));
}

type ManualChecksums = Map<string, Map<string, string>>;

/**
 * 1つのリリースの配布ファイルすべてに SHA-256 を割り当てる。
 * 優先: SHA256SUMS(リリースに添付) → 管理画面での手動登録。GitHub が digest を返す場合は一致を確認する。
 */
export async function verifyRelease(repo: string, release: GithubRelease, manual: ManualChecksums): Promise<{ status: ReleaseVerificationStatus; release: ClientRelease | null }> {
  const version = toVersion(release.tag_name);
  const base = { tag: release.tag_name, version, publishedAt: toPublishedAt(release.published_at) };
  const distributable = release.assets.filter((asset) => isDistributableAssetName(asset.name) && isAllowedGithubUrl(asset.browser_download_url));

  const fail = (reason: string, assets: ReleaseAssetStatus[]) => {
    logApi("warn", { event: "quick_client.release_not_servable", repo, version, reason });
    return { status: { ...base, servable: false, reason, assets }, release: null };
  };

  if (distributable.length === 0) {
    return fail("no_distributable_assets", []);
  }

  let sums: Map<string, string> | null = null;
  let sumsProblem: string | null = null;
  const sumsAsset = release.assets.find((asset) => (sha256SumsAssetNames as readonly string[]).includes(asset.name));

  if (!sumsAsset) {
    sumsProblem = "sha256sums_missing";
  } else {
    try {
      const body = await fetchFromGithub(sumsAsset.browser_download_url, {
        maxBytes: SHA256SUMS_MAX_BYTES,
        timeoutMs: FETCH_TIMEOUT_MS,
        accept: "application/octet-stream",
      });
      const parsed = parseSha256Sums(body.toString("utf8"));

      if (!parsed.ok) {
        sumsProblem = `sha256sums_invalid:${parsed.reason}${parsed.line ? `@line${parsed.line}` : ""}`;
      } else {
        // ファイル名は GitHub のアセット名と完全一致が必要。リリースに無いファイルの行があれば、別リリースの SHA256SUMS とみなして信用しない
        const assetNames = new Set(release.assets.map((asset) => asset.name));
        const unknown = [...parsed.sums.keys()].find((name) => !assetNames.has(name));
        if (unknown) {
          sumsProblem = "sha256sums_invalid:unknown_file";
        } else {
          sums = parsed.sums;
        }
      }
    } catch (error) {
      sumsProblem = error instanceof GithubFetchError ? `sha256sums_fetch_failed:${error.reason}` : "sha256sums_fetch_failed";
      logApi("warn", {
        event: "quick_client.sha256sums_fetch_failed",
        repo,
        version,
        reason: error instanceof GithubFetchError ? `${error.reason} ${error.detail} ${error.status ?? ""}`.trim() : "unknown",
      });
    }
  }

  if (sumsProblem) {
    logApi("warn", { event: "quick_client.sha256sums_unavailable", repo, version, reason: sumsProblem });
  }

  // SHA256SUMS があるのに不正: そのリリースは配信しない(手動登録でも上書きしない。Q-026 承認済み)。
  // 手動登録のフォールバックは SHA256SUMS が「無い」「取得できない」場合だけ
  if (sumsProblem?.startsWith("sha256sums_invalid") && !ALLOW_MANUAL_OVERRIDE_OF_INVALID_SHA256SUMS) {
    return fail(
      sumsProblem,
      distributable.map((asset) => ({ name: asset.name, sha256: null, source: null })),
    );
  }

  const manualForTag = manual.get(release.tag_name) ?? new Map<string, string>();
  const statuses: ReleaseAssetStatus[] = distributable.map((asset) => {
    const fromSums = sums?.get(asset.name);
    if (fromSums) {
      return { name: asset.name, sha256: fromSums, source: "SHA256SUMS" };
    }
    const fromManual = manualForTag.get(asset.name);
    return fromManual ? { name: asset.name, sha256: fromManual, source: "MANUAL" } : { name: asset.name, sha256: null, source: null };
  });

  const missing = statuses.filter((status) => status.sha256 === null);

  if (missing.length > 0) {
    return fail(sumsProblem ? `${sumsProblem}; asset_without_checksum` : "asset_without_checksum", statuses);
  }

  // GitHub が計算した digest と食い違うものは配信しない(SHA256SUMS か手動登録の誤り、またはファイルの差し替え)
  for (const asset of distributable) {
    const digest = githubDigest(asset.digest);
    const status = statuses.find((item) => item.name === asset.name);
    if (digest && status?.sha256 && digest !== status.sha256) {
      return fail(`digest_mismatch:${asset.name}`, statuses);
    }
  }

  const verifiedAssets: ClientReleaseAsset[] = [];

  for (const asset of distributable) {
    const sha256 = statuses.find((status) => status.name === asset.name)?.sha256;

    // 上で欠落を確認済みだが、型の上でも空文字や null を配信しないことを保証する
    if (!sha256 || !isSha256Hex(sha256)) {
      return fail("asset_without_checksum", statuses);
    }

    verifiedAssets.push({ name: asset.name, url: asset.browser_download_url, sizeBytes: asset.size, sha256 });
  }

  return {
    status: { ...base, servable: true, reason: null, assets: statuses },
    release: {
      repo,
      tag: release.tag_name,
      version,
      publishedAt: base.publishedAt,
      notes: (release.body ?? "").slice(0, 20_000),
      htmlUrl: release.html_url,
      assets: verifiedAssets,
    },
  };
}

type CacheState = {
  repo: string;
  release: ClientRelease | null;
  history: ClientReleaseHistoryEntry[];
  statuses: ReleaseVerificationStatus[];
  /** 次に GitHub へ問い合わせてよい時刻 */
  refreshAfter: number;
};

let cache: CacheState | null = null;
let inflight: Promise<CacheState> | null = null;

export function resetClientReleaseCache() {
  cache = null;
  inflight = null;
}

async function getState(now: number): Promise<CacheState> {
  const settings = await getQuickApiSettings();
  const repo = settings.clientGithubRepo;

  if (cache && cache.repo === repo && cache.refreshAfter > now) {
    return cache;
  }

  if (!inflight) {
    inflight = refresh(repo, settings.clientReleaseCacheSeconds * 1000, now).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

/**
 * 配信するリリース(配布ファイルすべてに SHA-256 があるもの)。無ければ null(API は 503)。
 * 最新が SHA-256 不足なら、遡って確認したリリース → 前回配信したリリース の順で使う(旧バージョン継続)。
 */
export async function getLatestClientRelease(now: number = Date.now()): Promise<ClientRelease | null> {
  return (await getState(now)).release;
}

/** ダウンロードページの更新履歴用(新しい順) */
export async function getClientReleaseHistory(now: number = Date.now()): Promise<ClientReleaseHistoryEntry[]> {
  return (await getState(now)).history;
}

/** 管理画面用: 直近のリリースの SHA-256 の判定結果 */
export async function getClientReleaseStatuses(now: number = Date.now()) {
  const state = await getState(now);
  return { repo: state.repo, servedVersion: state.release?.version ?? null, statuses: state.statuses };
}

async function refresh(repo: string, ttlMs: number, now: number): Promise<CacheState> {
  try {
    const body = await fetchFromGithub(`https://api.github.com/repos/${repo}/releases?per_page=${RELEASE_LIST_PER_PAGE}`, {
      maxBytes: RELEASE_LIST_MAX_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      accept: "application/vnd.github+json",
    });
    const releases = parseReleaseList(JSON.parse(body.toString("utf8")) as unknown);
    const manual = await loadManualChecksums(
      repo,
      releases.slice(0, MAX_RELEASES_TO_VERIFY).map((release) => release.tag_name),
    );

    const statuses: ReleaseVerificationStatus[] = [];
    let release: ClientRelease | null = null;

    for (const candidate of releases.slice(0, MAX_RELEASES_TO_VERIFY)) {
      const verified = await verifyRelease(repo, candidate, manual);
      statuses.push(verified.status);

      if (verified.release) {
        release = verified.release;
        break;
      }
    }

    const history = releases.map((item) => ({
      version: toVersion(item.tag_name),
      publishedAt: toPublishedAt(item.published_at),
      notes: (item.body ?? "").slice(0, 20_000),
      htmlUrl: item.html_url,
    }));

    if (release) {
      await persist(releaseCacheSettingKey, release);
    } else {
      // 新しく配信できるものが無い: 前回配信したもの(同じリポジトリ)を継続。
      // ただし今回確認して配信不可と判定したリリース(手動登録の削除・SHA256SUMS の差し替えなど)は継続しない
      const failedTags = new Set(statuses.map((status) => status.tag));
      const previous = cache?.repo === repo && cache.release ? cache.release : await loadPersistedRelease(repo);
      release = previous && !failedTags.has(previous.tag) ? previous : null;
      logApi("warn", {
        event: "quick_client.no_servable_release",
        repo,
        reason: release ? `keeping ${release.version}` : "nothing_to_serve",
      });
    }

    await persist(releaseHistoryCacheSettingKey, { repo, entries: history });
    cache = { repo, release, history, statuses, refreshAfter: now + ttlMs };
    logApi("info", { event: "quick_client.releases_refreshed", repo, served: release?.version ?? null, checked: statuses.length });
    return cache;
  } catch (error) {
    logApi("warn", {
      event: "quick_client.release_fetch_failed",
      repo,
      reason: error instanceof GithubFetchError ? `${error.reason} ${error.detail} ${error.status ?? ""}`.trim() : error instanceof SyntaxError ? "invalid_json" : "unknown",
    });

    const previous = cache?.repo === repo ? cache : null;
    cache = {
      repo,
      release: previous?.release ?? (await loadPersistedRelease(repo)),
      history: previous?.history.length ? previous.history : await loadPersistedHistory(repo),
      statuses: previous?.statuses ?? [],
      refreshAfter: now + FAILURE_BACKOFF_MS,
    };
    return cache;
  }
}

async function loadManualChecksums(repo: string, tags: string[]): Promise<ManualChecksums> {
  const result: ManualChecksums = new Map();

  if (tags.length === 0) {
    return result;
  }

  const rows = await prisma.quickClientAssetChecksum.findMany({
    where: { repo, tag: { in: tags } },
    select: { tag: true, assetName: true, sha256: true },
  });

  for (const row of rows) {
    if (!isSha256Hex(row.sha256)) {
      continue;
    }
    const forTag = result.get(row.tag) ?? new Map<string, string>();
    forTag.set(row.assetName, row.sha256);
    result.set(row.tag, forTag);
  }

  return result;
}

async function persist(key: string, value: unknown) {
  try {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value), description: "Clipshare Quick release lookup cache." },
    });
  } catch (error) {
    logApi("warn", { event: "quick_client.release_persist_failed", reason: error instanceof Error ? error.name : "unknown" });
  }
}

async function readPersisted(key: string): Promise<unknown> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row ? (JSON.parse(row.value) as unknown) : null;
  } catch {
    return null;
  }
}

async function loadPersistedRelease(repo: string): Promise<ClientRelease | null> {
  const parsed = storedReleaseSchema.safeParse(await readPersisted(releaseCacheSettingKey));
  // sha256 が揃っていない古い形式(v1.1 時代の null を含むもの)は使わない
  return parsed.success && parsed.data.repo === repo ? parsed.data : null;
}

async function loadPersistedHistory(repo: string): Promise<ClientReleaseHistoryEntry[]> {
  const parsed = storedHistorySchema.safeParse(await readPersisted(releaseHistoryCacheSettingKey));
  return parsed.success && parsed.data.repo === repo ? parsed.data.entries : [];
}

/**
 * ダウンロードボタンに使うファイル。セットアップ exe を優先(自己署名の MSIX は証明書の信頼が必要なため)。
 * 無ければ MSIX。
 */
export function pickInstallerAsset(release: ClientRelease | null) {
  if (!release) {
    return null;
  }

  const lower = (asset: ClientReleaseAsset) => asset.name.toLowerCase();
  return (
    release.assets.find((asset) => lower(asset).endsWith(".exe")) ??
    release.assets.find((asset) => lower(asset).endsWith(".msix")) ??
    release.assets.find((asset) => lower(asset).endsWith(".msixbundle")) ??
    null
  );
}
