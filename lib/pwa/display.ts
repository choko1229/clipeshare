export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

// 端末の画面幅(CSS px)。screen.width/height は向きに関係なく縦持ちの値を返す端末があるため、向きで選ぶ。
export function readDeviceWidth() {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  return isLandscape ? Math.max(window.screen.width, window.screen.height) : Math.min(window.screen.width, window.screen.height);
}

// iOS Safariの「ページの拡大/縮小」は devicePixelRatio を変えず、描画幅だけを 画面幅 ÷ 倍率 に広げる。
// (50%なら430ptの画面に対して innerWidth が860になる) そのため画面幅と描画幅の比で倍率が分かる。
// パソコンはウィンドウ幅と画面幅が一致しないので、タッチ操作が主の端末でだけ判定する。
export function readPageZoomRatio() {
  if (!window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints === 0) {
    return null;
  }

  const ratio = readDeviceWidth() / window.innerWidth;

  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function isNormalPageZoom(ratio: number) {
  return ratio >= 0.9 && ratio <= 1.1;
}
