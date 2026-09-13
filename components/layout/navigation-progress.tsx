"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// App Routerにはナビゲーション開始イベントが無いため、内部リンクのクリックを起点に進捗バーを出す。
// loading.tsx はストリーミング開始後に notFound() が呼ばれるとHTTP 200を返してしまうため使わない。
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentUrl = search ? `${pathname}?${search}` : pathname;
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextUrl = `${url.pathname}${url.search}`;
      const nowUrl = `${window.location.pathname}${window.location.search}`;
      if (nextUrl !== nowUrl) {
        setPendingUrl(nextUrl);
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const isNavigating = pendingUrl !== null && pendingUrl !== currentUrl;

  if (!isNavigating) {
    return null;
  }

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/20">
      <div className="submit-progress-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}
