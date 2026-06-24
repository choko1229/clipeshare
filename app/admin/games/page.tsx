import Link from "next/link";
import { CheckCircle2, HelpCircle, Search, XCircle } from "lucide-react";
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

function hasIgdbCredentials() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

function syncModeLabel(igdbId: number | null) {
  return igdbId ? `IGDB ID #${igdbId} で同期` : "ゲーム名でIGDB検索";
}

export default async function AdminGamesPage() {
  const igdbReady = hasIgdbCredentials();
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
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">ゲーム管理</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              投稿で使われたゲーム名を整理し、IGDBから概要・画像・ジャンル・プラットフォームを同期できます。
            </p>
          </div>
          <div
            className={[
              "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
              igdbReady ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive",
            ].join(" ")}
          >
            {igdbReady ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {igdbReady ? "IGDB設定済み" : "IGDB未設定"}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground lg:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">同期の探し方</p>
            <p className="mt-1">IGDB IDが入っている場合はID指定で同期します。未入力の場合はゲーム名で検索します。</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">同期で上書きされる項目</p>
            <p className="mt-1">名前、概要、カバー、ヒーロー画像、公式URL、ジャンル、プラットフォーム、発売日、IGDB IDです。</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">設定が必要な環境変数</p>
            <p className="mt-1">
              <code>IGDB_CLIENT_ID</code> と <code>IGDB_CLIENT_SECRET</code> を本番環境に設定してください。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="divide-y divide-border">
          {games.length > 0 ? (
            games.map((game) => {
              const genres = jsonStringArray(game.genres).join(", ");
              const platforms = jsonStringArray(game.platforms).join(", ");

              return (
                <article className="grid gap-4 p-4 xl:grid-cols-[280px_1fr]" key={game.id}>
                  <aside>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="font-semibold text-primary" href={`/games/${game.slug}`}>
                        {game.name}
                      </Link>
                      <span className="rounded bg-muted px-2 py-1 text-xs">{game._count.posts} posts</span>
                      {!game.isActive ? <span className="rounded bg-destructive px-2 py-1 text-xs">inactive</span> : null}
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">/{game.slug}</p>

                    <div className="mt-3 space-y-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <Search size={14} />
                        {syncModeLabel(game.igdbId)}
                      </p>
                      {game.igdbId ? <p>IGDB ID: {game.igdbId}</p> : <p>IGDB ID未入力。同期時は現在の名前で検索します。</p>}
                      {game.steamAppId ? <p>Steam App ID: {game.steamAppId}</p> : null}
                      {game.rawgSlug ? <p>RAWG slug: {game.rawgSlug}</p> : null}
                      <p>最終同期: {game.lastSyncedAt ? game.lastSyncedAt.toLocaleString("ja-JP") : "未同期"}</p>
                    </div>

                    <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <HelpCircle size={14} />
                        同期前の確認
                      </p>
                      <p className="mt-1">同名ゲームが複数ある場合は、先にIGDB IDを手入力して保存してから同期すると誤同期を避けやすいです。</p>
                    </div>
                  </aside>

                  <div className="space-y-3">
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
                          公式URL
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

                    <div className="grid gap-3 rounded-md border border-border bg-background p-3 lg:grid-cols-[1fr_auto]">
                      <div className="text-sm">
                        <p className="font-medium">IGDB同期</p>
                        <p className="mt-1 text-muted-foreground">
                          {game.igdbId
                            ? `IGDB ID #${game.igdbId} の情報で上書きします。`
                            : `「${game.name}」でIGDBを検索し、最初に一致したゲーム情報で上書きします。`}
                        </p>
                      </div>
                      <form action={syncGameFromIgdb} className="flex items-end justify-end">
                        <input name="gameId" type="hidden" value={game.id} />
                        <Button disabled={!igdbReady} type="submit" variant="outline">
                          {igdbReady ? "IGDBから同期" : "IGDB設定が必要"}
                        </Button>
                      </form>
                    </div>

                    <form action={mergeGame} className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[1fr_auto]">
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
                  </div>
                </article>
              );
            })
          ) : (
            <p className="p-4 text-sm text-muted-foreground">ゲームはまだ登録されていません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
