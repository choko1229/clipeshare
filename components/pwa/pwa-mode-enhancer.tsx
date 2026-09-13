"use client";

import { useEffect } from "react";
import { DisplayScale } from "@/components/pwa/display-scale";
import { LongPressMenu } from "@/components/pwa/long-press-menu";
import { PageZoomNotice } from "@/components/pwa/page-zoom-notice";
import { isStandaloneDisplay } from "@/lib/pwa/display";

// 以前はPWA判定後に <meta name="viewport"> を書き換えて拡大を禁止していたが、iOS 10以降は
// user-scalable=no を無視するため効果がなく、行わない。
// ダブルタップでの拡大は globals.css の touch-action: manipulation で抑止している。
export function PwaModeEnhancer() {
  useEffect(() => {
    const root = document.documentElement;
    const isStandalone = isStandaloneDisplay();
    const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    root.dataset.pwa = isStandalone ? "standalone" : "browser";
    root.dataset.appleDevice = isAppleDevice ? "true" : "false";

    if (isStandalone) {
      document.body.classList.add("pwa-standalone");
    }
  }, []);

  return (
    <>
      <DisplayScale />
      <LongPressMenu />
      <PageZoomNotice />
    </>
  );
}
