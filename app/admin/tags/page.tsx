import { mergeTag, updateTag } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type AdminTagsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function AdminTagsPage({ searchParams }: AdminTagsPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const tags = await prisma.tag.findMany({
    where: query
      ? {
          OR: [{ name: { contains: query } }, { slug: { contains: query.toLowerCase() } }],
        }
      : undefined,
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    take: 100,
  });

  const mergeTargets = tags.filter((tag) => tag.isActive);

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">タグ管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">タグ名の修正、有効/無効切り替え、表記ゆれの統合ができます。</p>
        <form action="/admin/tags" className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={q}
            name="q"
            placeholder="タグ名またはスラッグで検索"
          />
          <Button type="submit" variant="outline">
            検索
          </Button>
        </form>
      </div>

      <div className="divide-y divide-border">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <article className="grid gap-4 p-4 xl:grid-cols-[260px_1fr]" key={tag.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">#{tag.name}</span>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{tag._count.posts} posts</span>
                  {!tag.isActive ? <span className="rounded bg-destructive px-2 py-1 text-xs">inactive</span> : null}
                </div>
                <p className="mt-2 break-all text-xs text-muted-foreground">/{tag.slug}</p>
              </div>

              <div className="grid gap-3">
                <form action={updateTag} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <input name="tagId" type="hidden" value={tag.id} />
                  <label className="grid gap-1 text-sm">
                    タグ名
                    <input
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      defaultValue={tag.name}
                      maxLength={80}
                      name="name"
                      required
                    />
                  </label>
                  <label className="flex h-10 items-center gap-2 self-end text-sm">
                    <input defaultChecked={tag.isActive} name="isActive" type="checkbox" />
                    有効
                  </label>
                  <Button className="self-end" type="submit">
                    保存
                  </Button>
                </form>

                <form action={mergeTag} className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input name="sourceTagId" type="hidden" value={tag.id} />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue=""
                    name="targetTagId"
                    required
                  >
                    <option disabled value="">
                      統合先タグを選択
                    </option>
                    {mergeTargets
                      .filter((target) => target.id !== tag.id)
                      .map((target) => (
                        <option key={target.id} value={target.id}>
                          #{target.name} / {target._count.posts} posts
                        </option>
                      ))}
                  </select>
                  <Button type="submit" variant="outline">
                    統合
                  </Button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">タグはまだありません。</p>
        )}
      </div>
    </section>
  );
}
