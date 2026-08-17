"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Trash2, Video, X } from "lucide-react";
import { deleteQuickShare } from "@/app/qick/actions";
import { Button } from "@/components/ui/button";

export type QuickShareListItem = {
  canDelete: boolean;
  expiresAt: string;
  kind: "IMAGE" | "VIDEO";
  mediaUrl: string | null;
  publicId: string;
  shareUrl: string;
  status: "PROCESSING" | "READY" | "FAILED";
  thumbnailUrl: string | null;
};

type QuickShareListProps = {
  highlightId: string | null;
  isLoggedIn: boolean;
  items: QuickShareListItem[];
  showLoginPromptInitially: boolean;
};

export function QuickShareList({ highlightId, isLoggedIn, items, showLoginPromptInitially }: QuickShareListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(showLoginPromptInitially);
  const [dismissed, setDismissed] = useState(false);

  async function handleCopy(shareUrl: string, id: string) {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);

    if (!isLoggedIn && !dismissed) {
      setShowLoginPrompt(true);
    }
  }

  function closePrompt() {
    setShowLoginPrompt(false);
    setDismissed(true);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">アップロード履歴</h2>
      {items.map((item) => (
        <div
          className={`flex items-center gap-3 rounded-md border p-3 ${
            item.publicId === highlightId ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
          key={item.publicId}
        >
          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
            {item.kind === "IMAGE" && item.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-full object-cover" src={item.mediaUrl} />
            ) : item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="size-full object-cover" src={item.thumbnailUrl} />
            ) : (
              <Video className="text-muted-foreground" size={20} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" readOnly value={item.shareUrl} />
            {item.status === "PROCESSING" ? (
              <p className="mt-1 text-xs text-muted-foreground">圧縮中...(URLは発行済みで、そのまま使用できます)</p>
            ) : item.status === "FAILED" ? (
              <p className="mt-1 text-xs text-destructive">圧縮に失敗しました</p>
            ) : (
              <ExpiresLabel expiresAt={item.expiresAt} />
            )}
          </div>
          <Button onClick={() => handleCopy(item.shareUrl, item.publicId)} type="button" variant="outline">
            {copiedId === item.publicId ? <Check size={16} /> : <Copy size={16} />}
          </Button>
          {item.canDelete ? (
            <form action={deleteQuickShare.bind(null, item.publicId)}>
              <Button type="submit" variant="destructive">
                <Trash2 size={16} />
              </Button>
            </form>
          ) : null}
        </div>
      ))}

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

function ExpiresLabel({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState(() => formatRemaining(expiresAt));

  useEffect(() => {
    const interval = window.setInterval(() => setLabel(formatRemaining(expiresAt)), 60_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return <p className="mt-1 text-xs text-muted-foreground">{label}</p>;
}

function formatRemaining(expiresAt: string) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return "まもなく削除されます";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `残り${hours}時間${minutes}分で削除されます`;
  }

  return `残り${minutes}分で削除されます`;
}
