"use client";

import { useEffect } from "react";
import { LongPressMenu } from "@/components/pwa/long-press-menu";

// 以前はPWA判定後に <meta name="viewport"> を書き換えて拡大を禁止していたが、iOS 10以降は
// user-scalable=no を無視するため効果がなく、PWAでだけ描画幅が980pxに戻る不具合の唯一の差分だったので行わない。
// ダブルタップでの拡大は globals.css の touch-action: manipulation で抑止している。
export function PwaModeEnhancer() {
  useEffect(() => {
    const root = document.documentElement;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || isIosStandalone();
    const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    root.dataset.pwa = isStandalone ? "standalone" : "browser";
    root.dataset.appleDevice = isAppleDevice ? "true" : "false";

    if (isStandalone) {
      document.body.classList.add("pwa-standalone");
    }
  }, []);

  return <LongPressMenu />;
}

function isIosStandalone() {
  return "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}
