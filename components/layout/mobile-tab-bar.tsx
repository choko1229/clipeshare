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
      className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur xl:hidden"
    >
      <ul className="mx-auto grid h-[68px] max-w-2xl grid-cols-5 px-1">
        {tabs.map((tab) => {
          const isActive = tab.isActive(pathname);
          const Icon = tab.icon;
          const badgeLabel = tab.badge && tab.badge > 99 ? "99+" : String(tab.badge ?? 0);

          return (
            <li className="min-w-0" key={tab.label}>
              <Link
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.badge ? `${tab.label} 未読${badgeLabel}件` : tab.label}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition active:scale-95",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                href={tab.href}
              >
                {tab.isPrimary ? (
                  <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                    <Icon size={26} strokeWidth={2.4} />
                  </span>
                ) : (
                  <>
                    {isActive ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" /> : null}
                    <span className="relative">
                      <Icon size={24} strokeWidth={isActive ? 2.4 : 2} />
                      {tab.badge ? (
                        <span className="absolute -right-3 -top-1.5 min-w-[1.125rem] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-[1.125rem] text-destructive-foreground">
                          {badgeLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-full truncate leading-none">{tab.label}</span>
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
