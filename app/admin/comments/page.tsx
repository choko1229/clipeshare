import Link from "next/link";
import { deleteCommentByAdmin } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminCommentsPage() {
  const comments = await prisma.comment.findMany({
    where: {
      status: "PUBLISHED",
    },
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
      </div>
      <div className="divide-y divide-border">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <article className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]" key={comment.id}>
              <div>
                <p className="text-sm text-muted-foreground">
                  {comment.user.username ?? comment.user.email ?? comment.user.id} /{" "}
                  <Link className="text-primary" href={`/c/${comment.post.publicId}`}>
                    {comment.post.title}
                  </Link>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
              </div>
              <form action={deleteCommentByAdmin} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="commentId" type="hidden" value={comment.id} />
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="削除理由" />
                <Button type="submit" variant="destructive">
                  削除
                </Button>
              </form>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">コメントはありません。</p>
        )}
      </div>
    </section>
  );
}
