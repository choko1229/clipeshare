import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { updatePost } from "@/app/c/[id]/edit/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { joinPostBody } from "@/lib/posts/post-body";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getCustomText(value: unknown) {
  if (typeof value === "object" && value !== null && "note" in value && typeof (value as { note: unknown }).note === "string") {
    return (value as { note: string }).note;
  }

  return "";
}

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
  const customText = getCustomText(post.customFields);
  const bodyText = joinPostBody(post.title, post.description);
  const gameSuggestions = await prisma.game.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    take: 80,
  });

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
            <label className="block text-sm font-medium" htmlFor="bodyText">
              本文
            </label>
            <textarea
              className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={bodyText}
              id="bodyText"
              maxLength={4200}
              name="bodyText"
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">1行目をタイトル、2行目以降を説明文として保存します。</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="gameName">
                ゲーム名
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                autoComplete="off"
                defaultValue={post.game.name}
                id="gameName"
                list="game-suggestions"
                maxLength={120}
                name="gameName"
                required
              />
              <datalist id="game-suggestions">
                {gameSuggestions.map((game) => (
                  <option key={game.id} value={game.name} />
                ))}
              </datalist>
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

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium" htmlFor="rankName">
                ランク帯
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={post.rankName ?? ""}
                id="rankName"
                maxLength={80}
                name="rankName"
                placeholder="Diamond / Master など"
              />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="discordServerName">
                Discordサーバー名
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={post.discordServerName ?? ""}
                id="discordServerName"
                maxLength={120}
                name="discordServerName"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="customText">
              カスタム項目
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={customText}
              id="customText"
              maxLength={1000}
              name="customText"
              placeholder="補足情報を自由に入力"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input
                className="size-4 accent-primary"
                defaultChecked={post.visibility === "PRIVATE"}
                name="visibility"
                type="checkbox"
                value="PRIVATE"
              />
              非公開にする
            </label>
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input className="size-4 accent-primary" defaultChecked={post.isNsfw} name="isNsfw" type="checkbox" />
              NSFWとして表示
            </label>
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
