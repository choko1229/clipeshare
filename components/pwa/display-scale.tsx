"use client";

import { useEffect } from "react";
import { isNormalPageZoom, isStandaloneDisplay, readPageZoomRatio } from "@/lib/pwa/display";

// iOSの「テキストサイズ」が標準(大)のときの本文サイズ。
const IOS_DEFAULT_BODY_PX = 17;
// アクセシビリティの特大サイズ(最大約3倍)でもレイアウトが破綻しないよう、追従する範囲を制限する。
const MIN_TEXT_SCALE = 0.85;
const MAX_TEXT_SCALE = 1.35;
// Safariのページ拡大/縮小は50%〜300%(打ち消す倍率では2倍〜1/3倍)。画面幅と描画幅の比は端数が出るので
// 少し余裕を持たせ、それを超える値は測定の異常とみなして打ち消さない。
const MIN_FORCED_ZOOM = 0.32;
const MAX_FORCED_ZOOM = 2.05;

// 端末の表示設定をページに反映する。描画するものはなく、<html> のCSS変数とdata属性だけを更新する。
// - iPhone/iPadの「テキストサイズ」: -apple-system-body の実寸を測り、--text-scale として文字サイズに掛ける。
// - PWAのページ拡大/縮小: PWAにはSafariの「ぁあ」メニューがなく利用者が戻せないため、zoomで打ち消す。
export function DisplayScale() {
  useEffect(() => {
    const root = document.documentElement;

    // zoomの有無で結果が変わる測定は、必ず zoom を外した状態で行ってから掛け直す。
    // zoomを掛けた状態の innerWidth から倍率を逆算すると、ブラウザによって innerWidth の変わり方が異なり、
    // 誤差が掛け算で積み上がって倍率が発散する(Chromeでは2倍→4.9倍→28倍→…と暴走した)。
    // 外す・測る・掛け直すは同じタスク内で完結するので、画面がちらつくことはない。
    function withoutZoom<T>(measure: () => T) {
      const zoom = root.style.zoom;
      root.style.removeProperty("zoom");
      try {
        return measure();
      } finally {
        if (zoom) {
          root.style.zoom = zoom;
        }
      }
    }

    function measureTextScale() {
      if (!window.matchMedia("(pointer: coarse)").matches || !CSS.supports("font", "-apple-system-body")) {
        root.style.removeProperty("--text-scale");
        delete root.dataset.systemBodyPx;
        return;
      }

      const bodyPx = withoutZoom(() => {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
        probe.textContent = "あ";
        document.body.appendChild(probe);
        const size = Number.parseFloat(getComputedStyle(probe).fontSize);
        probe.remove();
        return size;
      });

      if (!Number.isFinite(bodyPx) || bodyPx <= 0) {
        return;
      }

      const scale = Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, bodyPx / IOS_DEFAULT_BODY_PX));
      root.style.setProperty("--text-scale", scale.toFixed(3));
      root.dataset.systemBodyPx = String(bodyPx);
    }

    // zoom下で 100dvh が実際の画面の高さからずれる分を --viewport-unit-scale として補正する。
    // 画面全体に固定配置した要素(zoomの実装に関係なく必ず画面と一致する)と、100dvh の要素を同じ条件で比べる。
    function measureViewportUnits() {
      const screenProbe = document.createElement("div");
      const unitProbe = document.createElement("div");
      screenProbe.style.cssText = "position:fixed;inset:0;visibility:hidden;pointer-events:none";
      unitProbe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none";
      document.body.append(screenProbe, unitProbe);
      const screenHeight = screenProbe.getBoundingClientRect().height;
      const unitHeight = unitProbe.getBoundingClientRect().height;
      screenProbe.remove();
      unitProbe.remove();

      const scale = screenHeight > 0 && unitHeight > 0 ? screenHeight / unitHeight : 1;
      root.style.setProperty("--viewport-unit-scale", scale.toFixed(4));
      root.dataset.viewportUnitScale = scale.toFixed(3);
    }

    function clearForcedZoom() {
      root.style.removeProperty("zoom");
      root.style.removeProperty("--viewport-unit-scale");
      delete root.dataset.forcedZoom;
      delete root.dataset.viewportUnitScale;
    }

    function applyForcedZoom() {
      if (!isStandaloneDisplay() || !CSS.supports("zoom", "1")) {
        clearForcedZoom();
        return;
      }

      const ratio = withoutZoom(readPageZoomRatio);
      const zoom = ratio === null ? null : 1 / ratio;
      if (ratio === null || isNormalPageZoom(ratio) || zoom === null || zoom < MIN_FORCED_ZOOM || zoom > MAX_FORCED_ZOOM) {
        clearForcedZoom();
        return;
      }

      const current = Number.parseFloat(root.style.zoom || "1");
      if (Math.abs(current - zoom) >= 0.001) {
        root.style.zoom = zoom.toFixed(4);
        root.dataset.forcedZoom = zoom.toFixed(3);
      }

      measureViewportUnits();
    }

    function handleVisibilityChange() {
      // 設定アプリでテキストサイズやページ拡大/縮小を変えて戻ってきた場合に追従する。
      if (document.visibilityState === "visible") {
        measureTextScale();
        applyForcedZoom();
      }
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
