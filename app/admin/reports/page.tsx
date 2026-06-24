import Link from "next/link";
import { getServerSession } from "next-auth";
import { takeReportAction, updateReportStatus } from "@/app/admin/actions";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  const canBanUser = session?.user?.role === "ADMIN" || session?.user?.role === "OWNER";
  const reports = await prisma.report.findMany({
    include: {
      reporter: true,
      handler: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const postIds = reports.filter((report) => report.targetType === "POST").map((report) => report.targetId);
  const commentIds = reports.filter((report) => report.targetType === "COMMENT").map((report) => report.targetId);
  const userIds = reports.filter((report) => report.targetType === "USER").map((report) => report.targetId);

  const [posts, comments, users] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: {
            id: {
              in: postIds,
            },
          },
          include: {
            user: true,
          },
        })
      : [],
    commentIds.length
      ? prisma.comment.findMany({
          where: {
            id: {
              in: commentIds,
            },
          },
          include: {
            post: true,
            user: true,
          },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
        })
      : [],
  ]);

  const postById = new Map(posts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">通報管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">通報内容を確認し、投稿非公開化、コメント削除、対象ユーザーBANまで同じ画面で対応できます。</p>
      </div>
      <div className="divide-y divide-border">
        {reports.length > 0 ? (
          reports.map((report) => {
            const targetPost = report.targetType === "POST" ? postById.get(report.targetId) : null;
            const targetComment = report.targetType === "COMMENT" ? commentById.get(report.targetId) : null;
            const targetUser = report.targetType === "USER" ? userById.get(report.targetId) : null;
            const targetOwner = targetPost?.user ?? targetComment?.user ?? targetUser ?? null;
            const targetUrl = targetPost ? `/c/${targetPost.publicId}` : targetComment ? `/c/${targetComment.post.publicId}#comment-${targetComment.id}` : null;
            const canAct = report.status !== "ACTION_TAKEN" && report.status !== "CLOSED";

            return (
              <article className="space-y-4 p-4" key={report.id}>
                <div className="grid gap-3 text-sm lg:grid-cols-[160px_1fr_180px]">
                  <div>
                    <p className="font-semibold">{report.reason}</p>
                    <p className="text-muted-foreground">{report.status}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{report.targetType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{report.detail || "詳細なし"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      通報者: {report.reporter.username ?? report.reporter.email ?? report.reporter.id}
                    </p>
                    {targetOwner ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        対象ユーザー: {targetOwner.username ?? targetOwner.email ?? targetOwner.id}
                      </p>
                    ) : null}
                    {targetUrl ? (
                      <Link className="mt-2 inline-block text-sm text-primary" href={targetUrl}>
                        対象を確認
                      </Link>
                    ) : report.targetType === "USER" && targetUser?.username ? (
                      <Link className="mt-2 inline-block text-sm text-primary" href={`/users/${targetUser.username}`}>
                        対象ユーザーを確認
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">対象は削除済み、または見つかりません。</p>
                    )}
                  </div>
                  <p className="text-right text-xs text-muted-foreground">{report.createdAt.toLocaleString("ja-JP")}</p>
                </div>

                {canAct ? (
                  <div className="grid gap-3 rounded-md border border-border bg-background p-3">
                    {targetPost ? (
                      <form action={takeReportAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input name="reportId" type="hidden" value={report.id} />
                        <input name="action" type="hidden" value="HIDE_POST" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="非公開理由" required />
                        <Button type="submit" variant="destructive">
                          投稿を非公開
                        </Button>
                      </form>
                    ) : null}
                    {targetComment ? (
                      <form action={takeReportAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input name="reportId" type="hidden" value={report.id} />
                        <input name="action" type="hidden" value="DELETE_COMMENT" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="コメント削除理由" required />
                        <Button disabled={targetComment.status === "DELETED"} type="submit" variant="destructive">
                          コメントを削除
                        </Button>
                      </form>
                    ) : null}
                    {canBanUser && targetOwner ? (
                      <form action={takeReportAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input name="reportId" type="hidden" value={report.id} />
                        <input name="action" type="hidden" value="BAN_TARGET_USER" />
                        <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="BAN理由" required />
                        <Button disabled={targetOwner.isBanned} type="submit" variant="destructive">
                          対象ユーザーBAN
                        </Button>
                      </form>
                    ) : null}
                    {!canBanUser && targetOwner ? <p className="text-xs text-muted-foreground">ユーザーBANは ADMIN / OWNER のみ実行できます。</p> : null}
                  </div>
                ) : null}

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
                  <Button type="submit">ステータス更新</Button>
                </form>
              </article>
            );
          })
        ) : (
          <p className="p-4 text-sm text-muted-foreground">通報はありません。</p>
        )}
      </div>
    </section>
  );
}
