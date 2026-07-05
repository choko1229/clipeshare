import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createPost } from "@/app/posts/new/actions";
import { PostMediaInput } from "@/components/posts/post-media-input";
import { PostSubmitButton } from "@/components/posts/post-submit-button";
import { prisma } from "@/lib/db/prisma";
import { formatBytes, getUploadLimitsForUser } from "@/lib/uploads/account-limits";
import { syncUserAccountLevel } from "@/lib/users/account-levels";
import { searchParamError } from "@/lib/actions/error-message";

type NewPostPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewPostPage({ searchParams }: NewPostPageProps) {
  const { error } = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  await syncUserAccountLevel(session.user.id);
  const [gameSuggestions, uploadLimits] = await Promise.all([
    prisma.game.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
      take: 80,
    }),
    getUploadLimitsForUser(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">投稿作成</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          画像はすぐ公開されます。動画はアップロード後にHLSへ変換され、完了後に公開されます。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <div
          className="mb-5 rounded-md border p-3 text-sm"
          style={{
            backgroundColor: `${uploadLimits.levelColor}16`,
            borderColor: `${uploadLimits.levelColor}88`,
          }}
        >
          <p className="font-semibold" style={{ color: uploadLimits.levelColor }}>
            {uploadLimits.accountLevelName}
          </p>
          <p className="mt-1 text-muted-foreground">
            動画 {uploadLimits.maxVideoSeconds}秒 / {formatBytes(uploadLimits.maxVideoSizeBytes)}、画像{" "}
            {formatBytes(uploadLimits.maxImageSizeBytes)}、画像枚数 {uploadLimits.maxImagesPerPost}枚、日次投稿{" "}
            {uploadLimits.dailyUploadLimit === null ? "無制限" : `${uploadLimits.dailyUploadLimit}件`}
          </p>
        </div>

        <form action={createPost} className="space-y-5">
          <input name="returnTo" type="hidden" value="/posts/new" />
          <ActionError message={searchParamError(error)} />
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
              placeholder={"1行目がタイトル\n2行目以降が説明文\n#タグ も本文内に入力できます"}
              required
            />
            <p className="mt-2 text-xs text-muted-foreground">
              1行目をタイトル、2行目以降を説明文として保存します。本文内の #タグ は最大10個までタグとして保存します。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="gameName">
              ゲーム名
            </label>
            <input
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              id="gameName"
              list="game-suggestions"
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

          <PostSubmitButton />
        </form>
      </section>
    </main>
  );
}

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}
