"use client";

import { Eye, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveChatInput } from "@/components/live/live-chat-input";
import { LiveChatList } from "@/components/live/live-chat-list";
import { LivePlayer } from "@/components/live/live-player";
import { ReportStreamButton } from "@/components/live/report-stream-button";
import { useLiveSocket } from "@/components/live/use-live-socket";

type LiveViewerPanelProps = {
  viewToken: string;
  hlsSrc: string;
  streamerName: string;
  isLoggedIn: boolean;
};

export function LiveViewerPanel({ viewToken, hlsSrc, streamerName, isLoggedIn }: LiveViewerPanelProps) {
  const [chatToken, setChatToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    let cancelled = false;

    async function fetchToken() {
      try {
        const response = await fetch("/api/live/chat-token", { method: "POST" });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setChatToken(data.token);
        }
      } catch {
        // チャットトークンが取得できなくても視聴自体は継続できる
      }
    }

    void fetchToken();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const { live, viewerCount, likeCount, liked, messages, sendChat, sendLike } = useLiveSocket(viewToken, chatToken);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(360px,4fr)]">
      <div className="min-w-0">
        <div className="relative">
          <LivePlayer src={hlsSrc} />
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
            LIVE
          </span>
          <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
            <Eye size={13} />
            {viewerCount}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
              {streamerName.slice(0, 1).toUpperCase()}
            </div>
            <span className="truncate text-sm font-semibold">{streamerName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              disabled={!chatToken}
              onClick={sendLike}
              type="button"
              variant={liked ? "secondary" : "default"}
            >
              <Heart size={16} />
              {likeCount}
            </Button>
            <ReportStreamButton isLoggedIn={isLoggedIn} viewToken={viewToken} />
          </div>
        </div>

        {!live ? (
          <p className="mt-3 text-sm text-muted-foreground">配信が終了している可能性があります。ページを再読み込みしてください。</p>
        ) : null}
      </div>

      <aside className="flex max-h-[520px] flex-col rounded-md border border-border bg-card p-4 xl:sticky xl:top-24">
        <p className="mb-3 text-sm font-semibold">チャット</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LiveChatList messages={messages} />
        </div>
        {isLoggedIn ? (
          <LiveChatInput onSend={sendChat} />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            コメントするにはログインしてください。
          </p>
        )}
      </aside>
    </div>
  );
}
