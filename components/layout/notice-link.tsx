"use client";

import { Bell, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NoticeLinkProps = {
  unreadCount: number;
};

export function NoticeLink({ unreadCount }: NoticeLinkProps) {
  const label = unreadCount > 99 ? "99+" : String(unreadCount);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={unreadCount > 0 ? `通知 ${label}件` : "通知"}
        className="relative grid size-10 place-items-center rounded-md transition hover:bg-muted"
        onClick={() => setIsOpen((current) => !current)}
        title="通知"
        type="button"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">
            {label}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 w-52 pt-2" role="menu">
          <div className="overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
            <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href="/notice" onClick={closeMenu} role="menuitem">
              <Bell size={16} />
              通知一覧
            </Link>
            <Link
              className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted"
              href="/settings/notifications"
              onClick={closeMenu}
              role="menuitem"
            >
              <Smartphone size={16} />
              端末通知を設定
            </Link>
            <Link
              className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted"
              href="/settings/notifications#install-app"
              onClick={closeMenu}
              role="menuitem"
            >
              <Smartphone size={16} />
              アプリとして追加
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
