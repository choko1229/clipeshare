"use client";

import { Eye, Heart, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveChatList } from "@/components/live/live-chat-list";
import { LivePlayer } from "@/components/live/live-player";
import { useLiveSocket } from "@/components/live/use-live-socket";

type LiveDashboardPanelProps = {
  viewToken: string;
  hlsSrc: string;
};

export function LiveDashboardPanel({ viewToken, hlsSrc }: LiveDashboardPanelProps) {
  const [chatToken, setChatToken] = useState<string | null>(null);

  useEffect(() => {
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
        // 取得できなくてもプレビュー自体は表示できる
      }
    }

    void fetchToken();
    return () => {
      cancelled = true;
    };
  }, []);

  const { live, viewerCount, likeCount, messages } = useLiveSocket(viewToken, chatToken);

  return (
    <div>
      {live ? (
        <div className="relative">
          <LivePlayer src={hlsSrc} />
          <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
            <Radio size={11} />
            LIVE
          </span>
        </div>
      ) : (
        <div className="grid aspect-video place-items-center gap-2 rounded-md border border-border bg-muted text-center">
          <p className="text-sm font-semibold">OBSからの接続を待っています</p>
          <p className="text-xs text-muted-foreground">下記のサーバー / キーをOBSに入力し、配信を開始してください</p>
        </div>
      )}

      <div className="mt-3 flex gap-3">
        <div className="flex-1 rounded-md border border-border bg-card p-3 text-center">
          <Eye className="mx-auto mb-1" size={16} />
          <p className="text-sm font-semibold">{viewerCount}</p>
          <p className="text-[10px] text-muted-foreground">視聴者数</p>
        </div>
        <div className="flex-1 rounded-md border border-border bg-card p-3 text-center">
          <Heart className="mx-auto mb-1" size={16} />
          <p className="text-sm font-semibold">{likeCount}</p>
          <p className="text-[10px] text-muted-foreground">いいね</p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">チャット(視聴者と共通・閲覧のみ)</p>
        <LiveChatList messages={messages} />
      </div>
    </div>
  );
}
