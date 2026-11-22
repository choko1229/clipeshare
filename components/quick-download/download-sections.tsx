import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/quick-download/copy-button";
import type { DownloadHistoryEntry, DownloadPageData } from "@/lib/quick-client/download-page-data";
import { formatBytes } from "@/lib/uploads/account-limits";

/** 画面01の文言(デザインの仮置きのまま。変えるときはデザインを先に更新する) */
const trustSteps = [
  { title: "セットアップを開く", body: "ダウンロードしたセットアップを実行します。" },
  { title: "証明書を信頼する", body: "確認が表示されたら、発行元 choko1229 の証明書を信頼します。" },
  { title: "インストール", body: "信頼したあと、続けてインストールします。" },
];

/** 検証済みリリースが無いときのボタン文言(Q-029 確定) */
export const UNAVAILABLE_DOWNLOAD_LABEL = "準備中";

/**
 * デザイン01「状態：検証済みリリースなし」のボタン: カード背景・薄い文字・枠線・不透明度0.7・not-allowed。
 * ボタン既定の disabled(pointer-events なし・不透明度0.5)を上書きする。disabled のためクリックは発火しない
 */
const unavailableButtonClassName =
  "h-12 bg-card text-[15px] font-bold text-muted-foreground hover:bg-card disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-70";

export function DownloadButtons({ release, supportedOs }: Pick<DownloadPageData, "release" | "supportedOs">) {
  if (!release) {
    // SHA-256 検証済みのリリースが無い間はダウンロードさせない(/api/v1/client/latest の 503 と同じ扱い)。
    // MSIX ボタンとバージョン行は出さない(Q-029)。デザインの「状態：…」はキャンバス上の状態名で、画面には出さない
    return (
      <div className="mt-[22px] flex flex-wrap items-center gap-4">
        <Button aria-disabled="true" className={unavailableButtonClassName} disabled type="button" variant="outline">
          <Download aria-hidden="true" size={16} />
          {UNAVAILABLE_DOWNLOAD_LABEL}
        </Button>
      </div>
    );
  }

  const label = `${supportedOs} 版をダウンロード`;

  const meta = [`v${release.version}`, formatBytes(release.installer.sizeBytes), supportedOs].join(" · ");

  return (
    <div className="mt-[22px] flex flex-wrap items-center gap-4">
      <Button asChild className="h-12 text-[15px] font-bold">
        <a href={release.installer.url} rel="noopener noreferrer">
          <Download aria-hidden="true" size={16} />
          {label}
        </a>
      </Button>
      {release.msix ? (
        <Button asChild className="h-12 font-bold" variant="outline">
          <a href={release.msix.url} rel="noopener noreferrer">
            MSIXをダウンロード
          </a>
        </Button>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">{meta}</p>
    </div>
  );
}

function NumberBadge({ value }: { value: number }) {
  return <div className="grid size-7 place-items-center rounded-full bg-primary text-[13px] font-extrabold text-primary-foreground">{value}</div>;
}

export function TrustSteps({ certFingerprint }: Pick<DownloadPageData, "certFingerprint">) {
  return (
    <>
      <h2 className="text-xl font-extrabold leading-snug">証明書の信頼手順</h2>
      <div className="flex flex-wrap gap-4">
        {trustSteps.map((step, index) => (
          <div className="flex-[1_1_240px] rounded-md border border-border bg-card p-5" key={step.title}>
            <NumberBadge value={index + 1} />
            <p className="mt-3 text-[15px] font-extrabold leading-relaxed">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
      {certFingerprint ? (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card px-5 py-4" data-testid="cert-fingerprint">
          <div className="min-w-0 flex-[1_1_280px]">
            <p className="text-sm font-bold leading-relaxed">証明書のSHA-256フィンガープリント</p>
            <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground">{certFingerprint}</p>
          </div>
          <CopyButton value={certFingerprint} />
        </div>
      ) : null}
    </>
  );
}

export function ReleaseHistory({ history }: { history: DownloadHistoryEntry[] }) {
  // 取得失敗・配信中なし・0件のときは区画ごと出さない(デザインに空の状態が無いため)
  if (history.length === 0) {
    return null;
  }

  return (
    <>
      <h2 className="text-xl font-extrabold leading-snug">更新履歴</h2>
      <div className="overflow-hidden rounded-md border border-border bg-card" data-testid="release-history">
        {history.map((entry) => (
          <div className="flex flex-wrap items-start gap-4 border-b border-border px-5 py-3.5 last:border-b-0" key={entry.version}>
            <div className="flex w-[200px] flex-none items-center gap-2.5">
              <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-muted px-2 text-xs font-bold text-muted-foreground">
                v{entry.version}
              </span>
              {entry.dateLabel ? <p className="text-xs leading-relaxed text-muted-foreground">{entry.dateLabel}</p> : null}
            </div>
            {entry.changes.length > 0 ? (
              <p className="min-w-0 flex-[1_1_320px] break-words text-[13px] leading-[1.8]">
                {entry.changes.map((change, index) => (
                  <span key={`${index}-${change}`}>
                    {index > 0 ? <br /> : null}・{change}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
