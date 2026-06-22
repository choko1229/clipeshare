import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { updatePost } from "@/app/c/[id]/edit/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const post = await prisma.post.findFirst({
    where: {
      publicId: id,
      userId: session.user.id,
      status: {
        notIn: ["HIDDEN", "DELETED"],
      },
    },
    include: {
      game: true,
      tags: {
        include: {
          tag: true,
        },
        orderBy: {
          tag: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!post) {
    notFound();
  }

  const tagText = post.tags.map(({ tag }) => tag.name).join(" ");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">投稿編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          タイトル、説明文、ゲーム名、タグを編集できます。メディア差し替えは別フェーズで追加します。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form action={updatePost} className="space-y-5">
          <input name="publicId" type="hidden" value={post.publicId} />

          <div>
            <label className="block text-sm font-medium" htmlFor="title">
              タイトル
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={post.title}
              id="title"
              maxLength={120}
              name="title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="description">
              説明文
            </label>
            <textarea
              className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={post.description}
              id="description"
              maxLength={4000}
              name="description"
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="gameName">
                ゲーム名
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={post.game.name}
                id="gameName"
                maxLength={120}
                name="gameName"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="tags">
                タグ
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={tagText}
                id="tags"
                maxLength={300}
                name="tags"
                placeholder="ace clutch screenshot"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">保存する</Button>
            <Button asChild variant="outline">
              <Link href={`/c/${post.publicId}`}>キャンセル</Link>
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
