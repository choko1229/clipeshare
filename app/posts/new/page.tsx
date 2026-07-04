import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createPost } from "@/app/posts/new/actions";
import { PostMediaInput } from "@/components/posts/post-media-input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export default async function NewPostPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

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
        <h1 className="text-3xl font-bold">投稿作成</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          スクリーンショットはすぐ公開されます。動画はアップロード後にHLSへ変換され、完了後に公開されます。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form action={createPost} className="space-y-5">
          <PostMediaInput />

          <div>
            <label className="block text-sm font-medium" htmlFor="bodyText">
              本文
            </label>
            <textarea
              className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              id="bodyText"
              maxLength={4200}
              name="bodyText"
              placeholder={"1行目がタイトル\n2行目以降が説明文"}
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              1行目をタイトル、2行目以降を説明文として保存します。本文内の #タグ を最大10個までタグとして保存します。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="gameName">
              ゲーム名
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              autoComplete="off"
              list="game-suggestions"
              id="gameName"
              maxLength={120}
              name="gameName"
              placeholder="空欄の場合は本文・タグ・ファイル名から推定"
            />
            <datalist id="game-suggestions">
              {gameSuggestions.map((game) => (
                <option key={game.id} value={game.name} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input className="size-4 accent-primary" name="visibility" type="checkbox" value="PRIVATE" />
              非公開で投稿
            </label>
            <label className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm">
              <input className="size-4 accent-primary" name="isNsfw" type="checkbox" />
              NSFWとして投稿
            </label>
          </div>

          <Button type="submit">投稿する</Button>
        </form>
      </section>
    </main>
  );
}
