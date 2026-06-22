import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const logs = await prisma.adminAuditLog.findMany({
    include: {
      admin: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">管理者操作ログ</h2>
      </div>
      <div className="divide-y divide-border">
        {logs.length > 0 ? (
          logs.map((log) => (
            <article className="grid gap-3 p-4 text-sm lg:grid-cols-[180px_160px_1fr_180px]" key={log.id}>
              <p className="font-semibold">{log.action}</p>
              <p className="text-muted-foreground">{log.targetType}</p>
              <p className="text-muted-foreground">
                {log.reason || "理由なし"} / {log.admin.username ?? log.admin.email ?? log.admin.id}
              </p>
              <p className="text-right text-muted-foreground">{log.createdAt.toLocaleString("ja-JP")}</p>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">操作ログはありません。</p>
        )}
      </div>
    </section>
  );
}
