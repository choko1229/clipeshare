"use client";

import { useState } from "react";
import { Check, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuickShareItemViewerProps = {
  canDelete: boolean;
  deleteAction: (formData: FormData) => void | Promise<void>;
  errorMessage: string | null;
  expiresAtLabel: string;
  isLoggedIn: boolean;
  kind: "IMAGE" | "VIDEO";
  shareUrl: string;
  status: "PROCESSING" | "READY" | "FAILED";
};

export function QuickShareItemViewer({
  canDelete,
  deleteAction,
  errorMessage,
  expiresAtLabel,
  isLoggedIn,
  kind,
  shareUrl,
  status,
}: QuickShareItemViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(!isLoggedIn);
  const [dismissed, setDismissed] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);

    if (!isLoggedIn && !dismissed) {
      setShowLoginPrompt(true);
    }
  }

  function closePrompt() {
    setShowLoginPrompt(false);
    setDismissed(true);
  }

  return (
    <div className="w-full">
      <div className="group relative overflow-hidden rounded-lg border border-border bg-card">
        {status === "FAILED" ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="font-medium text-destructive">圧縮処理に失敗しました</p>
            {errorMessage ? <p className="text-xs text-muted-foreground">{errorMessage}</p> : null}
          </div>
        ) : kind === "IMAGE" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="アップロードされた画像" className="max-h-[70vh] w-full object-contain" src={shareUrl} />
        ) : (
          <video className="max-h-[70vh] w-full" controls src={shareUrl} />
        )}

        {status === "PROCESSING" ? (
          <div className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            圧縮中... 完了までこのURLは無圧縮の動画を返します
          </div>
        ) : null}

        {status !== "FAILED" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
            <Button className="pointer-events-auto" onClick={handleCopy} type="button">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "コピーしました" : "URLをコピー"}
            </Button>
            {canDelete ? (
              <form action={deleteAction} className="pointer-events-auto">
                <Button type="submit" variant="destructive">
                  <Trash2 size={16} />
                  削除
                </Button>
              </form>
            ) : null}
          </div>
        ) : canDelete ? (
          <div className="flex justify-center border-t border-border p-3">
            <form action={deleteAction}>
              <Button type="submit" variant="destructive">
                <Trash2 size={16} />
                削除
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" readOnly value={shareUrl} />
        <Button onClick={handleCopy} type="button" variant="outline">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">このメディアは {expiresAtLabel} に自動的に削除されます。</p>

      {showLoginPrompt && !isLoggedIn ? (
        <div aria-label="ログインのご案内" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog">
          <div className="w-full max-w-sm rounded-md border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold">ログインのご案内</h3>
              <button aria-label="閉じる" onClick={closePrompt} type="button">
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              ログインすると、アップロード履歴をどの端末からでも確認でき、1日あたりのアップロード上限も緩和されます。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={closePrompt} type="button" variant="ghost">
                後で
              </Button>
              <Button asChild>
                <a href="/login">ログイン</a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
