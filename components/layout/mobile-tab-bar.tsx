"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Clapperboard, House, ImagePlus, LogIn, Plus, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileTabBarProps = {
  isLoggedIn: boolean;
  profileHref: string;
  unreadCount: number;
};

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
  badge?: number;
  isPrimary?: boolean;
};

export function MobileTabBar({ isLoggedIn, profileHref, unreadCount }: MobileTabBarProps) {
  const pathname = usePathname();

  if (pathname.startsWith("/embed")) {
    return null;
  }

  const tabs: Tab[] = [
    { href: "/", label: "ホーム", icon: House, isActive: (path) => path === "/" },
    { href: "/v", label: "動画", icon: Clapperboard, isActive: (path) => path === "/v" },
    { href: "/posts/new", label: "投稿", icon: Plus, isActive: (path) => path === "/posts/new", isPrimary: true },
    ...(isLoggedIn
      ? [
          { href: "/notice", label: "通知", icon: Bell, isActive: (path: string) => path.startsWith("/notice"), badge: unreadCount },
          {
            href: profileHref,
            label: "マイページ",
            icon: UserRound,
            isActive: (path: string) => path === profileHref || path.startsWith("/settings"),
          },
        ]
      : [
          { href: "/qick", label: "共有", icon: ImagePlus, isActive: (path: string) => path === "/qick" },
          { href: "/login", label: "ログイン", icon: LogIn, isActive: (path: string) => path === "/login" },
        ]),
  ];

  return (
    <nav
      aria-label="メインメニュー"
      className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur xl:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
        {tabs.map((tab) => {
          const isActive = tab.isActive(pathname);
          const Icon = tab.icon;
          const badgeLabel = tab.badge && tab.badge > 99 ? "99+" : String(tab.badge ?? 0);

          return (
            <li key={tab.label}>
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.badge ? `${tab.label} 未読${badgeLabel}件` : tab.label}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                href={tab.href}
              >
                {tab.isPrimary ? (
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-95">
                    <Icon size={24} strokeWidth={2.4} />
                  </span>
                ) : (
                  <>
                    {isActive ? <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" /> : null}
                    <span className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                      {tab.badge ? (
                        <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">
                          {badgeLabel}
                        </span>
                      ) : null}
                    </span>
                    <span>{tab.label}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
