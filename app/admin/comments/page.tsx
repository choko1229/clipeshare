import Link from "next/link";
import { deleteCommentByAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const comments = await prisma.comment.findMany({
    include: {
      user: true,
      post: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">コメント管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">直近100件のコメントを確認できます。削除済みコメントも監査用に表示します。</p>
      </div>
      <div className="divide-y divide-border">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <article className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]" key={comment.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{comment.user.username ?? comment.user.email ?? comment.user.id}</span>
                  <span>/</span>
                  <Link className="text-primary" href={`/c/${comment.post.publicId}#comment-${comment.id}`}>
                    {comment.post.title}
                  </Link>
                  <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs">{comment.status}</span>
                </div>
                <p
                  className={
                    comment.status === "DELETED"
                      ? "mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground line-through"
                      : "mt-2 whitespace-pre-wrap text-sm leading-6"
                  }
                >
                  {comment.body}
                </p>
                {comment.status === "DELETED" ? (
                  <p className="mt-2 text-xs text-muted-foreground">削除済み / deletedByAdminId: {comment.deletedByAdminId ?? "ユーザー削除または不明"}</p>
                ) : null}
              </div>
              {comment.status === "PUBLISHED" ? (
                <form action={deleteCommentByAdmin} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input name="commentId" type="hidden" value={comment.id} />
                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="削除理由" />
                  <Button type="submit" variant="destructive">
                    削除
                  </Button>
                </form>
              ) : (
                <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">操作なし</div>
              )}
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">コメントはありません。</p>
        )}
      </div>
    </section>
  );
}
