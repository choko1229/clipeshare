"use client";

import { useEffect } from "react";
import { isNormalPageZoom, isStandaloneDisplay, readPageZoomRatio } from "@/lib/pwa/display";

// iOSの「テキストサイズ」が標準(大)のときの本文サイズ。
const IOS_DEFAULT_BODY_PX = 17;
// アクセシビリティの特大サイズ(最大約3倍)でもレイアウトが破綻しないよう、追従する範囲を制限する。
const MIN_TEXT_SCALE = 0.85;
const MAX_TEXT_SCALE = 1.35;

// 端末の表示設定をページに反映する。描画するものはなく、<html> のCSS変数とdata属性だけを更新する。
// - iPhone/iPadの「テキストサイズ」: -apple-system-body の実寸を測り、--text-scale として文字サイズに掛ける。
// - PWAのページ拡大/縮小: PWAにはSafariの「ぁあ」メニューがなく利用者が戻せないため、zoomで打ち消す。
export function DisplayScale() {
  useEffect(() => {
    const root = document.documentElement;
    let appliedZoom = 1;
    // zoomを掛けると innerWidth まで変わる実装では、次回の倍率計算で掛けた分を戻さないと
    // 「打ち消す→100%に見える→打ち消しを外す」を繰り返してしまう。初回適用時に実測して判断する。
    let innerWidthFollowsZoom = false;

    function measureTextScale() {
      if (!window.matchMedia("(pointer: coarse)").matches || !CSS.supports("font", "-apple-system-body")) {
        root.style.removeProperty("--text-scale");
        delete root.dataset.systemBodyPx;
        return;
      }

      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
      probe.textContent = "あ";
      document.body.appendChild(probe);
      const bodyPx = Number.parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();

      if (!Number.isFinite(bodyPx) || bodyPx <= 0) {
        return;
      }

      const scale = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, bodyPx / IOS_DEFAULT_BODY_PX));
      root.style.setProperty("--text-scale", scale.toFixed(3));
      root.dataset.systemBodyPx = String(bodyPx);
    }

    // zoom下で 100dvh が画面の高さからずれる分を実測し、--viewport-unit-scale として補正する。
    function measureViewportUnits() {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      const probeHeight = probe.getBoundingClientRect().height;
      probe.remove();

      const scale = probeHeight > 0 ? window.innerHeight / probeHeight : 1;
      root.style.setProperty("--viewport-unit-scale", scale.toFixed(4));
      root.dataset.viewportUnitScale = scale.toFixed(3);
    }

    function clearForcedZoom() {
      root.style.removeProperty("zoom");
      root.style.removeProperty("--viewport-unit-scale");
      delete root.dataset.forcedZoom;
      delete root.dataset.viewportUnitScale;
      appliedZoom = 1;
    }

    function applyForcedZoom() {
      const rawRatio = readPageZoomRatio();
      if (!isStandaloneDisplay() || rawRatio === null || !CSS.supports("zoom", "1")) {
        clearForcedZoom();
        return;
      }

      const pageZoomRatio = innerWidthFollowsZoom ? rawRatio / appliedZoom : rawRatio;
      if (isNormalPageZoom(pageZoomRatio)) {
        clearForcedZoom();
        return;
      }

      const zoom = 1 / pageZoomRatio;
      if (Math.abs(zoom - appliedZoom) >= 0.01) {
        const widthBefore = window.innerWidth;
        root.style.zoom = String(zoom);
        if (appliedZoom === 1) {
          innerWidthFollowsZoom = Math.abs(window.innerWidth - widthBefore) > 1;
        }
        appliedZoom = zoom;
        root.dataset.forcedZoom = zoom.toFixed(3);
      }

      measureViewportUnits();
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") {
        return;
      }

      // 設定アプリでテキストサイズを変えて戻ってきた場合に追従する。zoomの影響を受けずに測るため一度外す。
      const zoom = root.style.zoom;
      root.style.removeProperty("zoom");
      measureTextScale();
      if (zoom) {
        root.style.zoom = zoom;
      }
      applyForcedZoom();
    }

    measureTextScale();
    applyForcedZoom();

    window.addEventListener("resize", applyForcedZoom);
    window.addEventListener("orientationchange", applyForcedZoom);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", applyForcedZoom);
      window.removeEventListener("orientationchange", applyForcedZoom);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
