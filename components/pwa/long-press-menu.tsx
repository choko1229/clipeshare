"use client";

import { Copy, ExternalLink, Share } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

const LONG_PRESS_MS = 450;
// これ以上指が動いたらスクロールとみなして長押しを取り消す。
const MOVE_TOLERANCE_PX = 10;

type MenuTarget = {
  href: string;
  title: string;
  // メニューを開いたページ。遷移したら閉じたものとして扱う。
  openedOn: string;
};

function labelFor(anchor: HTMLAnchorElement) {
  const label =
    anchor.dataset.longPressTitle ||
    anchor.getAttribute("aria-label") ||
    anchor.querySelector("img")?.alt.replace(/のサムネイル$/, "") ||
    anchor.textContent?.trim() ||
    "リンク";

  return label.slice(0, 80);
}

function findInternalLink(node: EventTarget | null) {
  const anchor = node instanceof Element ? node.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }

  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin ? { anchor, url } : null;
}

function isStandalone() {
  return document.documentElement.dataset.pwa === "standalone";
}

// PWAではiOS標準のリンクプレビュー(ブラウザと同じ見た目)を止め、アプリ風のボトムシートを出す。
// 通常のブラウザではSafari/Chromeの標準の長押しメニューを残す。
export function LongPressMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let start: { x: number; y: number } | null = null;
    // 長押しが成立したリンク。指を離したときにそのリンクへ届く1回分のクリックだけを止める。
    // 時間で区切ると、メニューが出た直後に押した「開く」「キャンセル」まで無視してしまう。
    let suppressNextClickOn: HTMLAnchorElement | null = null;

    function cancel() {
      window.clearTimeout(timer);
      timer = undefined;
      start = null;
    }

    function handleTouchStart(event: TouchEvent) {
      suppressNextClickOn = null;

      if (!isStandalone() || event.touches.length !== 1) {
        return;
      }

      const link = findInternalLink(event.target);
      if (!link) {
        return;
      }

      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        suppressNextClickOn = link.anchor;
        start = null;
        setCopied(false);
        setTarget({
          href: `${link.url.pathname}${link.url.search}${link.url.hash}`,
          title: labelFor(link.anchor),
          openedOn: window.location.pathname,
        });
      }, LONG_PRESS_MS);
    }

    function handleTouchMove(event: TouchEvent) {
      if (!start) {
        return;
      }

      const touch = event.touches[0];
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MOVE_TOLERANCE_PX) {
        cancel();
      }
    }

    function handleClick(event: MouseEvent) {
      if (suppressNextClickOn && event.target instanceof Node && suppressNextClickOn.contains(event.target)) {
        suppressNextClickOn = null;
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handleContextMenu(event: MouseEvent) {
      if (isStandalone() && findInternalLink(event.target)) {
        event.preventDefault();
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", cancel);
    document.addEventListener("touchcancel", cancel);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      cancel();
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", cancel);
      document.removeEventListener("touchcancel", cancel);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  if (!target || target.openedOn !== pathname) {
    return null;
  }

  const absoluteUrl = new URL(target.href, window.location.origin).href;
  const canShare = typeof navigator.share === "function";
  const close = () => setTarget(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(close, 900);
    } catch {
      close();
    }
  }

  async function share() {
    try {
      await navigator.share({ title: target?.title, url: absoluteUrl });
    } catch {
      // ユーザーが共有シートを閉じた場合も例外になるので無視する。
    }
    close();
  }

  return (
    <div
      aria-label="リンクのメニュー"
      aria-modal="true"
      className="fixed inset-0 z-[70]"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
        }
      }}
      role="dialog"
    >
      <button aria-label="閉じる" className="long-press-backdrop absolute inset-0 cursor-default bg-black/55" onClick={close} type="button" />
      <div className="long-press-sheet absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-2xl border-t border-border bg-card px-4 pt-3">
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" />
        <div className="px-2 pb-3 pt-3">
          <p className="line-clamp-2 text-base font-bold">{target.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{absoluteUrl.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <MenuAction
            autoFocus
            icon={ExternalLink}
            label="開く"
            onSelect={() => {
              close();
              router.push(target.href);
            }}
          />
          <MenuAction icon={Copy} label={copied ? "コピーしました" : "リンクをコピー"} onSelect={() => void copyLink()} />
          {canShare ? <MenuAction icon={Share} label="共有…" onSelect={() => void share()} /> : null}
        </div>
        <button className="mt-3 h-12 w-full rounded-xl bg-muted text-base font-semibold transition active:scale-[0.98]" onClick={close} type="button">
          キャンセル
        </button>
      </div>
    </div>
  );
}

function MenuAction({
  autoFocus = false,
  icon: Icon,
  label,
  onSelect,
}: {
  autoFocus?: boolean;
  icon: ComponentType<{ size?: number }>;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      autoFocus={autoFocus}
      className="flex h-14 w-full items-center gap-3 border-b border-border px-4 text-left text-base font-medium transition last:border-b-0 active:bg-muted"
      onClick={onSelect}
      type="button"
    >
      <Icon size={20} />
      {label}
    </button>
  );
}
