import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [openReports, posts, comments, users, recentReports] = await Promise.all([
    prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.post.count(),
    prisma.comment.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count(),
    prisma.report.findMany({
      include: {
        reporter: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = [
    { label: "未対応通報", value: openReports, href: "/admin/reports" },
    { label: "投稿", value: posts, href: "/admin/posts" },
    { label: "コメント", value: comments, href: "/admin/comments" },
    { label: "ユーザー", value: users, href: "/admin/users" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link className="rounded-md border border-border bg-card p-5 hover:border-primary" href={stat.href} key={stat.label}>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">最近の通報</h2>
        </div>
        <div className="divide-y divide-border">
          {recentReports.length > 0 ? (
            recentReports.map((report) => (
              <div className="grid gap-2 p-4 text-sm md:grid-cols-[160px_1fr_140px]" key={report.id}>
                <span className="font-medium">{report.reason}</span>
                <span className="text-muted-foreground">{report.detail || "詳細なし"}</span>
                <span className="text-right text-muted-foreground">{report.status}</span>
              </div>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">通報はありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
