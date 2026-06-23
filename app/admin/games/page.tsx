import Link from "next/link";
import { mergeGame, syncGameFromIgdb, updateGameMetadata } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function AdminGamesPage() {
  const games = await prisma.game.findMany({
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
  const mergeTargets = games.filter((game) => game.isActive);

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">ゲーム管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          投稿に使われたゲーム名へ概要や外部IDを追加できます。API同期は認証情報を設定してから追加します。
        </p>
      </div>
      <div className="divide-y divide-border">
        {games.length > 0 ? (
          games.map((game) => {
            const genres = jsonStringArray(game.genres).join(", ");
            const platforms = jsonStringArray(game.platforms).join(", ");

            return (
              <article className="grid gap-4 p-4 xl:grid-cols-[260px_1fr]" key={game.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link className="font-semibold text-primary" href={`/games/${game.slug}`}>
                      {game.name}
                    </Link>
                    <span className="rounded bg-muted px-2 py-1 text-xs">{game._count.posts} posts</span>
                    {!game.isActive ? <span className="rounded bg-destructive px-2 py-1 text-xs">inactive</span> : null}
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">/{game.slug}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {game.igdbId ? <p>IGDB: {game.igdbId}</p> : null}
                    {game.steamAppId ? <p>Steam: {game.steamAppId}</p> : null}
                    {game.rawgSlug ? <p>RAWG: {game.rawgSlug}</p> : null}
                    {game.lastSyncedAt ? <p>同期: {game.lastSyncedAt.toLocaleString("ja-JP")}</p> : null}
                  </div>
                </div>

                <form action={updateGameMetadata} className="grid gap-3">
                  <input name="gameId" type="hidden" value={game.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      名前
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.name}
                        maxLength={120}
                        name="name"
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      発売日
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={dateInputValue(game.releaseDate)}
                        name="releaseDate"
                        type="date"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1 text-sm">
                    概要
                    <textarea
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      defaultValue={game.summary ?? ""}
                      maxLength={5000}
                      name="summary"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1 text-sm">
                      カバー画像URL
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.coverUrl ?? ""}
                        name="coverUrl"
                        type="url"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      ヒーロー画像URL
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.heroUrl ?? ""}
                        name="heroUrl"
                        type="url"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      公式・外部URL
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.officialUrl ?? ""}
                        name="officialUrl"
                        type="url"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      RAWG slug
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.rawgSlug ?? ""}
                        maxLength={120}
                        name="rawgSlug"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1 text-sm">
                      IGDB ID
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.igdbId ?? ""}
                        min={1}
                        name="igdbId"
                        type="number"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      Steam App ID
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={game.steamAppId ?? ""}
                        min={1}
                        name="steamAppId"
                        type="number"
                      />
                    </label>
                    <label className="grid gap-1 text-sm lg:col-span-2">
                      ジャンル
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={genres}
                        name="genres"
                        placeholder="FPS, Tactical"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <label className="grid gap-1 text-sm">
                      プラットフォーム
                      <input
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue={platforms}
                        name="platforms"
                        placeholder="PC, PlayStation, Xbox"
                      />
                    </label>
                    <div className="flex items-end gap-3">
                      <label className="inline-flex h-10 items-center gap-2 text-sm">
                        <input defaultChecked={game.isActive} name="isActive" type="checkbox" />
                        有効
                      </label>
                      <Button type="submit">保存</Button>
                    </div>
                  </div>
                </form>
                <form action={syncGameFromIgdb} className="flex justify-end">
                  <input name="gameId" type="hidden" value={game.id} />
                  <Button type="submit" variant="outline">
                    IGDB同期
                  </Button>
                </form>
                <form action={mergeGame} className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input name="sourceGameId" type="hidden" value={game.id} />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue=""
                    name="targetGameId"
                    required
                  >
                    <option disabled value="">
                      統合先ゲームを選択
                    </option>
                    {mergeTargets
                      .filter((target) => target.id !== game.id)
                      .map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.name} / {target._count.posts} posts
                        </option>
                      ))}
                  </select>
                  <Button type="submit" variant="outline">
                    統合
                  </Button>
                </form>
              </article>
            );
          })
        ) : (
          <p className="p-4 text-sm text-muted-foreground">ゲームはまだ登録されていません。</p>
        )}
      </div>
    </section>
  );
}
