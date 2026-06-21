import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
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
          この画面は投稿機能実装フェーズで動画・スクリーンショットアップロードに接続します。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form className="space-y-5">
          <div>
            <label className="block text-sm font-medium" htmlFor="title">タイトル</label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              disabled
              id="title"
              placeholder="実装予定"
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="description">説明文</label>
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              disabled
              id="description"
              placeholder="実装予定"
            />
          </div>
          <Button disabled type="button">
            メディア投稿機能は次フェーズで実装
          </Button>
        </form>
      </section>
    </main>
  );
}
