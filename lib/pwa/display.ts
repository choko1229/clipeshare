export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

// iOS Safariの「ページの拡大/縮小」は devicePixelRatio を変えず、描画幅だけを 画面幅 ÷ 倍率 に広げる。
// (50%なら430ptの画面に対して innerWidth が860になる) そのため画面幅と描画幅の比で倍率が分かる。
// パソコンはウィンドウ幅と画面幅が一致しないので、タッチ操作が主の端末でだけ判定する。
export function readPageZoomRatio() {
  if (!window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints === 0) {
    return null;
  }

  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const deviceWidth = isLandscape ? Math.max(window.screen.width, window.screen.height) : Math.min(window.screen.width, window.screen.height);
  const ratio = deviceWidth / window.innerWidth;

  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function isNormalPageZoom(ratio: number) {
  return ratio >= 0.9 && ratio <= 1.1;
}
