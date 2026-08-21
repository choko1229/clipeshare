"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type HeaderProfileProps = {
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

export function HeaderProfile({ image, name, username }: HeaderProfileProps) {
  const label = name ?? username ?? "プロフィール";
  const href = username ? `/users/${username}` : "/settings/profile";
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
    <div className="relative min-w-0" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-card">
          {image ? (
            <Image alt="" className="object-cover" fill sizes="32px" src={image} />
          ) : (
            <span className="grid h-full place-items-center text-xs font-bold text-primary">
              {label.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{label}</span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-50 w-52 pt-2" role="menu">
          <div className="overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
            <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href={href} onClick={closeMenu} role="menuitem">
              <UserRound size={16} />
              プロフィールを表示
            </Link>
            <Link
              className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted"
              href="/settings/profile"
              onClick={closeMenu}
              role="menuitem"
            >
              <Settings size={16} />
              プロフィール設定
            </Link>
            <button
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-destructive transition hover:bg-destructive/10"
              onClick={() => {
                closeMenu();
                void signOut({ callbackUrl: "/" });
              }}
              role="menuitem"
              type="button"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
