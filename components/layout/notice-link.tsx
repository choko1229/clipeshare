import { Bell, Smartphone } from "lucide-react";
import Link from "next/link";

type NoticeLinkProps = {
  unreadCount: number;
};

export function NoticeLink({ unreadCount }: NoticeLinkProps) {
  const label = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="group relative">
      <Link
        aria-label={unreadCount > 0 ? `通知 ${label}件` : "通知"}
        className="relative grid size-10 place-items-center rounded-md transition hover:bg-muted"
        href="/notice"
        title="通知"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">
            {label}
          </span>
        ) : null}
      </Link>
      <div className="invisible absolute right-0 top-full z-50 w-52 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg">
          <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href="/notice">
            <Bell size={16} />
            通知一覧
          </Link>
          <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href="/settings/notifications">
            <Smartphone size={16} />
            端末通知を設定
          </Link>
          <Link className="flex items-center gap-2 rounded px-3 py-2 transition hover:bg-muted" href="/settings/notifications#install-app">
            <Smartphone size={16} />
            アプリとして追加
          </Link>
        </div>
      </div>
    </div>
  );
}
