"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        // 更新確認時にHTTPキャッシュを使わず、デプロイ直後から新しいService Workerを取り込む。
        updateViaCache: "none",
      });
    });
  }, []);

  return null;
}
