"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Info, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallGuide() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => (typeof window !== "undefined" ? isStandaloneMode() : false));
  const [message, setMessage] = useState("");
  const isAppleDevice = useMemo(() => typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent), []);
  const supportsInstallPrompt = Boolean(installPrompt);
  const supportsServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage("Clipshareをアプリとして追加しました。");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setMessage("インストールを開始しました。");
      setInstallPrompt(null);
    } else {
      setMessage("インストールはキャンセルされました。");
    }
  }

  return (
    <section className="scroll-mt-24 rounded-md border border-border bg-card p-5" id="install-app">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-primary">
          <Smartphone size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">アプリとして使う</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ホーム画面に追加すると、PWAとして全画面に近い表示で起動できます。PWA起動中は拡大を抑制し、操作感をアプリ寄りにします。
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {installed ? (
          <div className="rounded-md border border-border bg-background p-3 text-sm">この端末ではPWAとして起動中です。</div>
        ) : supportsInstallPrompt ? (
          <Button className="w-fit" onClick={install} type="button">
            <Download size={18} />
            この端末にインストール
          </Button>
        ) : isAppleDevice ? (
          <div className="rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Share size={16} />
              iPhone / iPad / Safari の追加方法
            </div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>SafariでClipshareを開きます。</li>
              <li>共有ボタンを押します。</li>
              <li>「ホーム画面に追加」を選びます。</li>
              <li>ホーム画面のClipshareアイコンから起動します。</li>
            </ol>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Info size={16} />
              インストール案内
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              このブラウザでは自動インストールボタンを表示できません。ブラウザのメニューから「アプリをインストール」または
              「ホーム画面に追加」が表示される場合があります。
            </p>
          </div>
        )}

        {!supportsServiceWorker ? (
          <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            この環境はService Workerに対応していないため、オフライン表示や端末通知は利用できません。
          </p>
        ) : null}
        {message ? <p className="rounded-md border border-border bg-background p-3 text-sm">{message}</p> : null}
      </div>
    </section>
  );
}

function isStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}
