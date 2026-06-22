import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createPost } from "@/app/posts/new/actions";
import { Button } from "@/components/ui/button";

export default async function NewPostPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

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
          <div>
            <label className="block text-sm font-medium" htmlFor="postType">
              投稿タイプ
            </label>
            <select
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              id="postType"
              name="postType"
              required
            >
              <option value="SCREENSHOT">スクリーンショット</option>
              <option value="CLIP">クリップ動画</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="media">
              メディアファイル
            </label>
            <input
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
              className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
              id="media"
              name="media"
              required
              type="file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="title">
              タイトル
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
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
              className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
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
                id="tags"
                maxLength={300}
                name="tags"
                placeholder="ace clutch screenshot"
              />
            </div>
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
