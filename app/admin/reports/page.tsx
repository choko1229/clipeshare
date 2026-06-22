import Link from "next/link";
import { updateReportStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await prisma.report.findMany({
    include: {
      reporter: true,
      handler: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">通報管理</h2>
      </div>
      <div className="divide-y divide-border">
        {reports.length > 0 ? (
          reports.map((report) => (
            <article className="space-y-4 p-4" key={report.id}>
              <div className="grid gap-3 text-sm lg:grid-cols-[140px_1fr_160px]">
                <div>
                  <p className="font-semibold">{report.reason}</p>
                  <p className="text-muted-foreground">{report.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{report.detail || "詳細なし"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    通報者: {report.reporter.username ?? report.reporter.email ?? report.reporter.id}
                  </p>
                  {report.targetType === "POST" ? (
                    <Link className="mt-2 inline-block text-sm text-primary" href={`/admin/posts?target=${report.targetId}`}>
                      対象投稿を確認
                    </Link>
                  ) : null}
                </div>
                <p className="text-right text-xs text-muted-foreground">{report.createdAt.toLocaleString("ja-JP")}</p>
              </div>

              <form action={updateReportStatus} className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                <input name="reportId" type="hidden" value={report.id} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="status" defaultValue={report.status}>
                  <option value="OPEN">OPEN</option>
                  <option value="REVIEWING">REVIEWING</option>
                  <option value="ACTION_TAKEN">ACTION_TAKEN</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="対応メモ" />
                <Button type="submit">更新</Button>
              </form>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">通報はありません。</p>
        )}
      </div>
    </section>
  );
}
