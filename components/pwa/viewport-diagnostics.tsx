"use client";

import { useSyncExternalStore } from "react";
import { readPageZoomRatio } from "@/lib/pwa/display";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  // data-pwa はハイドレーション後に付くので、少し待ってから再計測されるよう定期的に更新する。
  const interval = window.setInterval(onChange, 1000);

  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
    window.clearInterval(interval);
  };
}

function readDiagnostics() {
  const root = document.documentElement;
  const probe = document.getElementById("safe-area-probe");
  const probeStyle = probe ? getComputedStyle(probe) : null;
  const clientWidth = root.clientWidth;
  const overflowing = [...document.querySelectorAll("body *")]
    .filter((element) => element.getBoundingClientRect().right > clientWidth + 1)
    .slice(0, 8)
    .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)} → ${Math.round(element.getBoundingClientRect().right)}px`);

  return JSON.stringify(
    {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth,
      scrollWidth: root.scrollWidth,
      visualViewport: window.visualViewport
        ? { width: Math.round(window.visualViewport.width), height: Math.round(window.visualViewport.height), scale: window.visualViewport.scale }
        : null,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
      dataPwa: root.dataset.pwa ?? null,
      // components/pwa/display-scale.tsx が適用した値。
      pageZoomRatio: (() => {
        const ratio = readPageZoomRatio();
        return ratio === null ? null : Number(ratio.toFixed(3));
      })(),
      forcedZoom: root.dataset.forcedZoom ?? null,
      innerWidthAfterZoom: root.dataset.forcedZoom ? window.innerWidth : null,
      viewportUnitScale: root.dataset.viewportUnitScale ?? null,
      systemBodyPx: root.dataset.systemBodyPx ?? null,
      textScale: root.style.getPropertyValue("--text-scale") || null,
      rootFontSize: getComputedStyle(root).fontSize,
      safeArea: probeStyle
        ? { top: probeStyle.paddingTop, right: probeStyle.paddingRight, bottom: probeStyle.paddingBottom, left: probeStyle.paddingLeft }
        : null,
      viewportMeta: [...document.querySelectorAll('meta[name="viewport"]')].map((meta) => meta.getAttribute("content")),
      overflowing,
      userAgent: navigator.userAgent,
    },
    null,
    2,
  );
}

export function ViewportDiagnostics() {
  const diagnostics = useSyncExternalStore(subscribe, readDiagnostics, () => "");

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none invisible fixed left-0 top-0"
        id="safe-area-probe"
        style={{ padding: "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)" }}
      />
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-card p-4 text-xs leading-5">
        {diagnostics || "計測中…"}
      </pre>
    </>
  );
}
