"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "clipshare:cookie-notice-accepted";
const CHANGE_EVENT = "clipshare:cookie-notice-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// localStorageが使えない環境では、毎回表示し続けるより非表示にするほうが利用を妨げない。
function isAccepted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function CookieNotice() {
  const pathname = usePathname();
  const accepted = useSyncExternalStore(subscribe, isAccepted, () => true);

  if (accepted || pathname.startsWith("/embed")) {
    return null;
  }

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 保存できなくても、このページ表示中は閉じられるようにする。
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <div
      aria-label="Cookieの利用について"
      className="above-tab-bar fixed inset-x-3 z-40 flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-xs shadow-2xl sm:inset-x-auto sm:right-4 sm:max-w-md sm:text-sm"
      role="region"
    >
      <p className="min-w-0 flex-1 leading-5 text-muted-foreground">
        ログイン維持・アクセス解析・広告配信のためにCookieを利用しています。
        <Link className="text-primary hover:underline" href="/privacy">
          詳しく見る
        </Link>
      </p>
      <Button className="h-8 shrink-0 px-3 text-xs" onClick={accept} type="button">
        同意する
      </Button>
    </div>
  );
}
