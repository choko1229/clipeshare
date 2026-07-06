"use client";

import { LogOut, Settings, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";

type HeaderProfileProps = {
  image?: string | null;
  name?: string | null;
  username?: string | null;
};

export function HeaderProfile({ image, name, username }: HeaderProfileProps) {
  const label = name ?? username ?? "プロフィール";
  const href = username ? `/users/${username}` : "/settings/profile";

  return (
    <div className="group relative min-w-0">
      <Link className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted" href={href}>
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
      </Link>

      <div className="invisible absolute right-0 top-full z-50 w-52 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
          <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href={href}>
            <UserRound size={16} />
            プロフィールを表示
          </Link>
          <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href="/settings/profile">
            <Settings size={16} />
            プロフィール設定
          </Link>
          <button
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-destructive transition hover:bg-destructive/10"
            onClick={() => signOut({ callbackUrl: "/" })}
            type="button"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}
