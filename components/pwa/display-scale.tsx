"use client";

import { useEffect } from "react";

// iOSの「テキストサイズ」が標準(大)のときの本文サイズ。
const IOS_DEFAULT_BODY_PX = 17;
// アクセシビリティの特大サイズ(最大約3倍)でもレイアウトが破綻しないよう、追従する範囲を制限する。
// 実機のPWAで「テキストサイズ」を変えても実測値(14px)が変わらない報告があり、実測が設定を正しく
// 反映していない可能性があるため、確認できるまでは標準より小さくする方向には追従しない。
const MIN_TEXT_SCALE = 1;
const MAX_TEXT_SCALE = 1.35;

// iPhone/iPadの「テキストサイズ」設定をページに反映する。描画するものはなく、<html> のCSS変数だけを更新する。
// -apple-system-body の実寸を測り、--text-scale として基準文字サイズに掛ける(globals.css)。
//
// PWAでのページ拡大/縮小の打ち消しは行わない。iOSでは <html> に zoom を掛けても描画幅が縮まず、
// 拡大された要素がはみ出してiOSがさらに縮小表示した(描画幅860→1070、表示倍率0.5→0.4)ため。
export function DisplayScale() {
  useEffect(() => {
    const root = document.documentElement;

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

    function handleVisibilityChange() {
      // 設定アプリでテキストサイズを変えて戻ってきた場合に追従する。
      if (document.visibilityState === "visible") {
        measureTextScale();
      }
    }

    measureTextScale();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
