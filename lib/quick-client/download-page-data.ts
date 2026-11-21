import { describeError, logApi } from "@/lib/api/log";
import { quickApiDefaults, getQuickApiSettings } from "@/lib/quick-share/api-settings";
import { getQuickShareSettings, quickShareDefaults } from "@/lib/quick-share/settings";
import {
  formatReleaseDate,
  formatReleaseNotes,
  RELEASE_HISTORY_MAX_ENTRIES,
} from "@/lib/quick-client/release-notes";
import {
  getClientReleaseHistory,
  getLatestClientRelease,
  pickInstallerAsset,
  type ClientRelease,
  type ClientReleaseAsset,
  type ClientReleaseHistoryEntry,
} from "@/lib/quick-client/releases";

export type DownloadAsset = {
  name: string;
  url: string;
  sizeBytes: number;
  sha256: string;
};

export type DownloadHistoryEntry = {
  version: string;
  /** 表示用の日付(日本時間 YYYY/MM/DD)。不明なら null */
  dateLabel: string | null;
  /** プレーンテキストの変更点(HTML として描画しないこと) */
  changes: string[];
};

/** ダウンロードページ(画面01)の表示データ。取得処理と画面を分けるための形 */
export type DownloadPageData = {
  supportedOs: string;
  retentionHours: number;
  anonymousDailyLimit: number;
  /** SHA-256 検証済みの配信中リリース(/api/v1/client/latest と同じ)。無ければ null = ダウンロード不可 */
  release: {
    version: string;
    installer: DownloadAsset;
    /** MSIX(補助のダウンロード)。リリースに無ければ null */
    msix: DownloadAsset | null;
  } | null;
  /** 管理画面で登録した証明書の SHA-256 フィンガープリント(AB:CD:… に正規化済み)。未登録なら null */
  certFingerprint: string | null;
  /** 更新履歴(新しい順・最大 RELEASE_HISTORY_MAX_ENTRIES 件)。取得できない・配信中が無いときは空 */
  history: DownloadHistoryEntry[];
};

function toAsset(asset: ClientReleaseAsset): DownloadAsset {
  return { name: asset.name, url: asset.url, sizeBytes: asset.sizeBytes, sha256: asset.sha256 };
}

function pickMsix(release: ClientRelease) {
  const lower = (asset: ClientReleaseAsset) => asset.name.toLowerCase();
  return release.assets.find((asset) => lower(asset).endsWith(".msix")) ?? release.assets.find((asset) => lower(asset).endsWith(".msixbundle")) ?? null;
}

/**
 * 更新履歴は「配信中のリリース以前」だけを出す(SHA-256 未検証でダウンロードできない新しい版の変更点を出さない)。
 * 配信中のリリースが無ければ出さない。
 */
export function buildHistory(entries: ClientReleaseHistoryEntry[], served: { version: string; publishedAt: string } | null): DownloadHistoryEntry[] {
  if (!served) {
    return [];
  }

  const index = entries.findIndex((entry) => entry.version === served.version);
  const servedTime = Date.parse(served.publishedAt);
  const eligible = index >= 0 ? entries.slice(index) : entries.filter((entry) => Date.parse(entry.publishedAt) <= servedTime);

  return eligible.slice(0, RELEASE_HISTORY_MAX_ENTRIES).map((entry) => ({
    version: entry.version,
    dateLabel: formatReleaseDate(entry.publishedAt),
    changes: formatReleaseNotes(entry.notes),
  }));
}

/** 失敗しても画面全体を落とさないよう、区画ごとに既定値へ縮退して記録する */
async function safely<T>(section: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    logApi("error", { event: "quick_download.section_failed", reason: `${section}: ${describeError(error)}` });
    return fallback;
  }
}

export async function getDownloadPageData(): Promise<DownloadPageData> {
  const [release, historyEntries, apiSettings, quickShareSettings] = await Promise.all([
    safely("release", () => getLatestClientRelease(), null),
    safely("history", () => getClientReleaseHistory(), [] as ClientReleaseHistoryEntry[]),
    safely("api_settings", () => getQuickApiSettings(), null),
    safely("quick_share_settings", () => getQuickShareSettings(), null),
  ]);

  const installer = pickInstallerAsset(release);
  const msix = release ? pickMsix(release) : null;

  return {
    supportedOs: apiSettings?.clientSupportedOs ?? quickApiDefaults.clientSupportedOs,
    retentionHours: quickShareSettings?.retentionHours ?? quickShareDefaults.retentionHours,
    anonymousDailyLimit: quickShareSettings?.anonymousDailyLimit ?? quickShareDefaults.anonymousDailyLimit,
    release:
      release && installer
        ? {
            version: release.version,
            installer: toAsset(installer),
            // セットアップが MSIX しか無い場合は、同じファイルの補助ボタンを出さない
            msix: msix && msix.name !== installer.name ? toAsset(msix) : null,
          }
        : null,
    certFingerprint: apiSettings?.clientCertFingerprint ?? null,
    history: release && installer ? buildHistory(historyEntries, release) : [],
  };
}
