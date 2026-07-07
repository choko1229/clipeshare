"use client";

import { useEffect } from "react";

export function PwaModeEnhancer() {
  useEffect(() => {
    const root = document.documentElement;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || isIosStandalone();
    const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    root.dataset.pwa = isStandalone ? "standalone" : "browser";
    root.dataset.appleDevice = isAppleDevice ? "true" : "false";

    if (isStandalone) {
      lockViewportScale();
      document.body.classList.add("pwa-standalone");
    }
  }, []);

  return null;
}

function isIosStandalone() {
  return "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function lockViewportScale() {
  let viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement("meta");
    viewport.name = "viewport";
    document.head.appendChild(viewport);
  }

  viewport.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
}
