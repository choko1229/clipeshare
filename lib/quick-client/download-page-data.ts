import { getQuickApiSettings } from "@/lib/quick-share/api-settings";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { getClientReleaseHistory, getLatestClientRelease, pickInstallerAsset, type ClientReleaseHistoryEntry } from "@/lib/quick-client/releases";

/**
 * ダウンロードページ(画面01)の表示データ。
 * 「自己署名証明書の信頼手順」と「更新履歴」の区画はデザイン更新待ち(PROGRESS.md「D」)。
 * ここではデータの取得までを用意し、画面にはまだ出さない。
 */
export type DownloadPageData = {
  supportedOs: string;
  retentionHours: number;
  anonymousDailyLimit: number;
  release: {
    version: string;
    downloadUrl: string;
    installerName: string;
    installerSizeBytes: number;
    installerSha256: string;
  } | null;
  /** 配布元のリリースページ(リリースが無いときのリンク先) */
  releasesPageUrl: string;
  /** 信頼手順で表示する証明書のフィンガープリント(管理画面で設定。未設定なら null) */
  certFingerprint: string | null;
  /** 更新履歴(新しい順。GitHub Releases の公開リリース。サーバー側でキャッシュ) */
  history: ClientReleaseHistoryEntry[];
};

export async function getDownloadPageData(): Promise<DownloadPageData> {
  const [release, history, apiSettings, quickShareSettings] = await Promise.all([
    getLatestClientRelease(),
    getClientReleaseHistory(),
    getQuickApiSettings(),
    getQuickShareSettings(),
  ]);
  const installer = pickInstallerAsset(release);

  return {
    supportedOs: apiSettings.clientSupportedOs,
    retentionHours: quickShareSettings.retentionHours,
    anonymousDailyLimit: quickShareSettings.anonymousDailyLimit,
    release:
      release && installer
        ? {
            version: release.version,
            downloadUrl: installer.url,
            installerName: installer.name,
            installerSizeBytes: installer.sizeBytes,
            installerSha256: installer.sha256,
          }
        : null,
    releasesPageUrl: `https://github.com/${apiSettings.clientGithubRepo}/releases`,
    certFingerprint: apiSettings.clientCertFingerprint,
    history,
  };
}
