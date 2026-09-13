"use client";

import { ZoomIn, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { isNormalPageZoom, readPageZoomRatio } from "@/lib/pwa/display";

const DISMISSED_KEY = "clipshare:page-zoom-notice-dismissed";
const CHANGE_EVENT = "clipshare:page-zoom-notice-change";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  // data-pwa と data-forced-zoom はハイドレーション後に付くため、少し後にも再計算する。
  const timer = window.setTimeout(onChange, 500);

  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.clearTimeout(timer);
  };
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function readSnapshot() {
  const root = document.documentElement;
  const ratio = readPageZoomRatio();
  if (ratio === null || isNormalPageZoom(ratio)) {
    return "";
  }

  const percent = String(Math.round(ratio * 100));
  if (readDismissed() === percent) {
    return "";
  }

  const mode = root.dataset.pwa === "standalone" ? "standalone" : "browser";
  return `${percent}|${mode}`;
}

export function PageZoomNotice() {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "");

  if (!snapshot) {
    return null;
  }

  const [percent, mode] = snapshot.split("|");

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, percent);
    } catch {
      // 保存できなくても、このページ表示中は閉じられるようにする。
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div
      aria-label="表示倍率のお知らせ"
      className="below-header fixed inset-x-3 z-40 flex items-start gap-3 rounded-md border border-primary/40 bg-card p-3 text-sm shadow-2xl sm:inset-x-auto sm:right-4 sm:max-w-md"
      role="status"
    >
      <ZoomIn className="mt-0.5 shrink-0 text-primary" size={18} />
      <p className="min-w-0 flex-1 leading-6">
        表示倍率が<strong>{percent}%</strong>になっています。
        {mode === "standalone"
          ? "Safariで clipshare.link を開き、アドレスバーの「ぁあ」から100%に戻したあと、このアプリを再起動すると本来のサイズで表示されます。"
          : "アドレスバーの「ぁあ」から100%に戻すと、本来のサイズで表示されます。"}
      </p>
      <button aria-label="閉じる" className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted" onClick={dismiss} type="button">
        <X size={18} />
      </button>
    </div>
  );
}
