"use client";

import { useSyncExternalStore } from "react";
import { readDeviceWidth, readPageZoomRatio } from "@/lib/pwa/display";

// 実験で viewport を書き換える前の状態。書き換え後の値と比べられるよう、最初の計測時に一度だけ記録する。
let initialViewportContent: string | null = null;
let initialPageZoomRatio: number | null = null;
let lastExperiment = "なし";

function captureInitialState() {
  if (initialViewportContent !== null) {
    return;
  }

  initialViewportContent = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "";
  initialPageZoomRatio = readPageZoomRatio();
}

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  // data-pwa はハイドレーション後に付き、viewportの書き換えも非同期に反映されるので定期的に再計測する。
  const interval = window.setInterval(onChange, 1000);

  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
    window.clearInterval(interval);
  };
}

function readDiagnostics() {
  captureInitialState();

  const root = document.documentElement;
  const probe = document.getElementById("safe-area-probe");
  const probeStyle = probe ? getComputedStyle(probe) : null;
  const clientWidth = root.clientWidth;
  const overflowing = [...document.querySelectorAll("body *")]
    .filter((element) => element.getBoundingClientRect().right > clientWidth + 1)
    .slice(0, 8)
    .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)} → ${Math.round(element.getBoundingClientRect().right)}px`);
  const currentRatio = readPageZoomRatio();

  return JSON.stringify(
    {
      experiment: lastExperiment,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth,
      scrollWidth: root.scrollWidth,
      visualViewport: window.visualViewport
        ? { width: Math.round(window.visualViewport.width), height: Math.round(window.visualViewport.height), scale: Number(window.visualViewport.scale.toFixed(3)) }
        : null,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
      navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone ?? null,
      dataPwa: root.dataset.pwa ?? null,
      initialPageZoomRatio: initialPageZoomRatio === null ? null : Number(initialPageZoomRatio.toFixed(3)),
      currentPageZoomRatio: currentRatio === null ? null : Number(currentRatio.toFixed(3)),
      // 起動時(と画面復帰時)に DisplayScale が測った値と、この瞬間に測り直した値。
      // 設定アプリでテキストサイズを変えて戻ったとき、どちらが変わるかで反映のタイミングを切り分ける。
      systemBodyPx: root.dataset.systemBodyPx ?? null,
      systemBodyPxLive: (() => {
        if (!CSS.supports("font", "-apple-system-body")) {
          return null;
        }
        const bodyProbe = document.createElement("span");
        bodyProbe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
        bodyProbe.textContent = "あ";
        document.body.appendChild(bodyProbe);
        const size = getComputedStyle(bodyProbe).fontSize;
        bodyProbe.remove();
        return size;
      })(),
      textScale: root.style.getPropertyValue("--text-scale") || null,
      rootFontSize: getComputedStyle(root).fontSize,
      safeArea: probeStyle
        ? { top: probeStyle.paddingTop, right: probeStyle.paddingRight, bottom: probeStyle.paddingBottom, left: probeStyle.paddingLeft }
        : null,
      initialViewportMeta: initialViewportContent,
      viewportMeta: [...document.querySelectorAll('meta[name="viewport"]')].map((meta) => meta.getAttribute("content")),
      overflowing,
      userAgent: navigator.userAgent,
    },
    null,
    2,
  );
}

function setViewport(label: string, content: string) {
  captureInitialState();
  document.querySelector('meta[name="viewport"]')?.setAttribute("content", content);
  lastExperiment = `${label}: ${content}`;
  window.dispatchEvent(new Event("resize"));
}

// PWAではSafariの「ぁあ」メニューがなくページ拡大/縮小を戻せないため、viewportの指定で打ち消せるかを実機で試す。
// iOSがページ拡大/縮小を明示的な width にどう作用させるかはドキュメントがなく、実測で判断する。
const experiments = [
  {
    label: "A 幅を画面幅に固定",
    content: () => `width=${Math.round(readDeviceWidth())}, initial-scale=1, viewport-fit=cover`,
  },
  {
    label: "B A＋倍率を逆数に",
    content: () => `width=${Math.round(readDeviceWidth())}, initial-scale=${(1 / (initialPageZoomRatio ?? 1)).toFixed(3)}, viewport-fit=cover`,
  },
  {
    label: "C 幅を画面幅×倍率に",
    content: () => `width=${Math.round(readDeviceWidth() * (initialPageZoomRatio ?? 1))}, initial-scale=1, viewport-fit=cover`,
  },
];

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
      <div className="mt-4 grid grid-cols-2 gap-2">
        {experiments.map((experiment) => (
          <button
            className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold transition active:scale-[0.98]"
            key={experiment.label}
            onClick={() => setViewport(experiment.label, experiment.content())}
            type="button"
          >
            {experiment.label}
          </button>
        ))}
        <button
          className="h-11 rounded-md border border-primary/50 bg-primary/10 px-3 text-sm font-semibold text-primary transition active:scale-[0.98]"
          onClick={() => setViewport("元に戻す", initialViewportContent ?? "width=device-width, initial-scale=1, viewport-fit=cover")}
          type="button"
        >
          元に戻す
        </button>
      </div>
      <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-card p-4 text-xs leading-5">
        {diagnostics || "計測中…"}
      </pre>
    </>
  );
}
