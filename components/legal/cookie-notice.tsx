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
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-md border border-border bg-card p-4 text-sm shadow-2xl sm:inset-x-auto sm:right-4 sm:max-w-md xl:bottom-4"
      role="region"
    >
      <p className="leading-6 text-muted-foreground">
        Clipshareは、ログイン状態の維持、アクセス解析、広告配信のためにCookieを利用しています。詳しくは
        <Link className="text-primary hover:underline" href="/privacy">
          プライバシーポリシー
        </Link>
        をご確認ください。
      </p>
      <div className="mt-3 flex justify-end">
        <Button className="h-9" onClick={accept} type="button">
          同意して閉じる
        </Button>
      </div>
    </div>
  );
}
