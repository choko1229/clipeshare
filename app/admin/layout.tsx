import Link from "next/link";
import { requireModerator } from "@/lib/admin/auth";

const adminNav = [
  { href: "/admin", label: "概要" },
  { href: "/admin/reports", label: "通報" },
  { href: "/admin/posts", label: "投稿" },
  { href: "/admin/comments", label: "コメント" },
  { href: "/admin/moderation", label: "モデレーション" },
  { href: "/admin/tags", label: "タグ" },
  { href: "/admin/games", label: "ゲーム" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/audit-logs", label: "操作ログ" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireModerator();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">管理画面</h1>
        <nav className="mt-4 flex gap-2 overflow-x-auto">
          {adminNav.map((item) => (
            <Link
              className="shrink-0 rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </main>
  );
}
