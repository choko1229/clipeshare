import Link from "next/link";
import { hidePost, restorePost, togglePostNsfw } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type AdminPostsPageProps = {
  searchParams: Promise<{
    target?: string;
  }>;
};

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const { target } = await searchParams;
  const posts = await prisma.post.findMany({
    where: target ? { id: target } : undefined,
    include: {
      user: true,
      game: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">投稿管理</h2>
      </div>
      <div className="divide-y divide-border">
        {posts.length > 0 ? (
          posts.map((post) => (
            <article className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]" key={post.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-semibold text-primary" href={`/c/${post.publicId}`}>
                    {post.title}
                  </Link>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{post.status}</span>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{post.visibility}</span>
                  {post.isNsfw ? <span className="rounded bg-destructive px-2 py-1 text-xs">NSFW</span> : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {post.game.name} / {post.user.username ?? post.user.email ?? post.user.id}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.description}</p>
              </div>

              <div className="grid gap-3">
                <form action={post.status === "HIDDEN" ? restorePost : hidePost} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input name="postId" type="hidden" value={post.id} />
                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="理由" />
                  <Button type="submit" variant={post.status === "HIDDEN" ? "secondary" : "destructive"}>
                    {post.status === "HIDDEN" ? "公開へ戻す" : "非公開化"}
                  </Button>
                </form>
                <form action={togglePostNsfw} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input name="postId" type="hidden" value={post.id} />
                  <input name="isNsfw" type="hidden" value={post.isNsfw ? "false" : "true"} />
                  <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="理由" />
                  <Button type="submit" variant="outline">
                    {post.isNsfw ? "NSFW解除" : "NSFW指定"}
                  </Button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">投稿はありません。</p>
        )}
      </div>
    </section>
  );
}
