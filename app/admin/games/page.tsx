import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, HelpCircle, Search, Trash2, XCircle } from "lucide-react";
import { createGameField, deleteGameField, mergeGame, syncGameFromIgdb, syncGameFromRawg, syncGameFromSteam, updateGameMetadata } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { searchSteamGames } from "@/lib/games/steam";

const gameFieldInputTypeLabels: Record<string, string> = {
  TEXT: "テキスト",
  NUMBER: "数値",
  SELECT: "選択式",
};

export const dynamic = "force-dynamic";

type AdminGamesPageProps = {
  searchParams: Promise<{
    steamSearchGameId?: string;
  }>;
};

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dateInputValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function hasIgdbCredentials() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

function hasRawgCredentials() {
  return Boolean(process.env.RAWG_API_KEY);
}

function ServiceStatus({ ready, readyText, missingText }: { ready: boolean; readyText: string; missingText: string }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        ready ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive",
      ].join(" ")}
    >
      {ready ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      {ready ? readyText : missingText}
    </div>
  );
}

function syncModeLabel(game: { igdbId: number | null; steamAppId: number | null; rawgSlug: string | null }) {
  const modes = [
    game.igdbId ? `IGDB #${game.igdbId}` : "IGDB: 名前検索",
    game.steamAppId ? `Steam ${game.steamAppId}` : "Steam: 候補検索",
    game.rawgSlug ? `RAWG ${game.rawgSlug}` : "RAWG: 名前検索",
  ];
  return modes.join(" / ");
}

export default async function AdminGamesPage({ searchParams }: AdminGamesPageProps) {
  const { steamSearchGameId } = await searchParams;
  const igdbReady = hasIgdbCredentials();
  const rawgReady = hasRawgCredentials();
  const games = await prisma.game.findMany({
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
      fields: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
    take: 100,
  });
  const mergeTargets = games.filter((game) => game.isActive);
  const steamSearchGame = games.find((game) => game.id === steamSearchGameId);
  const steamCandidates = steamSearchGame ? await searchSteamGames(steamSearchGame.name).catch(() => []) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">ゲーム管理</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              投稿で使われたゲーム名を整理し、IGDB / Steam / RAWGから概要・画像・ジャンル・プラットフォームを補完できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ServiceStatus missingText="IGDB未設定" ready={igdbReady} readyText="IGDB設定済み" />
            <ServiceStatus missingText="Steam利用不可" ready readyText="Steam利用可" />
            <ServiceStatus missingText="RAWG未設定" ready={rawgReady} readyText="RAWG設定済み" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground lg:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">同期の探し方</p>
            <p className="mt-1">IGDB/RAWGはIDまたはslug優先、SteamはApp ID優先です。Steam App IDが不明な場合は候補検索できます。</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">同期で上書きされる項目</p>
            <p className="mt-1">手動入力済みの概要・画像・公式URL・ジャンル等は維持し、空欄を優先して補完します。</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-medium text-foreground">設定が必要な環境変数</p>
            <p className="mt-1">
              IGDBは <code>IGDB_CLIENT_ID</code> / <code>IGDB_CLIENT_SECRET</code>、RAWGは <code>RAWG_API_KEY</code> が必要です。
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
                <article className="grid gap-4 p-4 xl:grid-cols-[300px_1fr]" key={game.id}>
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
                        {syncModeLabel(game)}
                      </p>
                      {game.igdbId ? <p>IGDB ID: {game.igdbId}</p> : null}
                      {game.steamAppId ? <p>Steam App ID: {game.steamAppId}</p> : null}
                      {game.rawgId ? <p>RAWG ID: {game.rawgId}</p> : null}
                      {game.rawgSlug ? <p>RAWG slug: {game.rawgSlug}</p> : null}
                      <p>全体同期: {game.lastSyncedAt ? game.lastSyncedAt.toLocaleString("ja-JP") : "未同期"}</p>
                      <p>Steam同期: {game.lastSteamSyncedAt ? game.lastSteamSyncedAt.toLocaleString("ja-JP") : "未同期"}</p>
                      <p>RAWG同期: {game.lastRawgSyncedAt ? game.lastRawgSyncedAt.toLocaleString("ja-JP") : "未同期"}</p>
                    </div>

                    <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <HelpCircle size={14} />
                        同期前の確認
                      </p>
                      <p className="mt-1">同名ゲームが複数ある場合は、外部IDを手入力するかSteam候補から正しいものを選んで同期してください。</p>
                    </div>
                  </aside>

                  <div className="space-y-3">
                    <form action={updateGameMetadata} className="grid gap-3">
                      <input name="gameId" type="hidden" value={game.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                          名前
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={game.name} maxLength={120} name="name" required />
                        </label>
                        <label className="grid gap-1 text-sm">
                          発売日
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={dateInputValue(game.releaseDate)} name="releaseDate" type="date" />
                        </label>
                      </div>

                      <label className="grid gap-1 text-sm">
                        概要
                        <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={game.summary ?? ""} maxLength={5000} name="summary" />
                      </label>

                      <div className="grid gap-3 md:grid-cols-2">
                        <TextUrlInput label="カバー画像URL" name="coverUrl" value={game.coverUrl} />
                        <TextUrlInput label="ヒーロー画像URL" name="heroUrl" value={game.heroUrl} />
                        <TextUrlInput label="公式URL" name="officialUrl" value={game.officialUrl} />
                        <label className="grid gap-1 text-sm">
                          RAWG slug
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={game.rawgSlug ?? ""} maxLength={120} name="rawgSlug" />
                        </label>
                        <TextUrlInput label="Steamヘッダー画像URL" name="steamHeaderUrl" value={game.steamHeaderUrl} />
                        <TextUrlInput label="Steamカプセル画像URL" name="steamCapsuleUrl" value={game.steamCapsuleUrl} />
                        <TextUrlInput label="RAWG背景画像URL" name="rawgBackgroundUrl" value={game.rawgBackgroundUrl} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                        <NumberInput label="IGDB ID" name="igdbId" value={game.igdbId} />
                        <NumberInput label="Steam App ID" name="steamAppId" value={game.steamAppId} />
                        <NumberInput label="RAWG ID" name="rawgId" value={game.rawgId} />
                        <NumberInput label="Metacritic" name="metacriticScore" value={game.metacriticScore} />
                        <label className="grid gap-1 text-sm">
                          ジャンル
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={genres} name="genres" placeholder="FPS, Tactical" />
                        </label>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <label className="grid gap-1 text-sm">
                          プラットフォーム
                          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={platforms} name="platforms" placeholder="PC, PlayStation, Xbox" />
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

                    <SyncPanel
                      action={syncGameFromIgdb}
                      buttonText={igdbReady ? "IGDBから同期" : "IGDB設定が必要"}
                      description={
                        game.igdbId
                          ? `IGDB ID #${game.igdbId} の情報で空欄を補完します。`
                          : `「${game.name}」でIGDBを検索し、最初に一致したゲーム情報で空欄を補完します。`
                      }
                      disabled={!igdbReady}
                      gameId={game.id}
                      title="IGDB同期"
                    />

                    <div className="grid gap-3 rounded-md border border-border bg-background p-3 lg:grid-cols-[1fr_auto]">
                      <div className="text-sm">
                        <p className="font-medium">Steam同期</p>
                        <p className="mt-1 text-muted-foreground">Steam App IDがある場合はそのIDで同期します。不明な場合はゲーム名から候補を検索できます。</p>
                      </div>
                      <div className="flex flex-wrap items-end justify-end gap-2">
                        <form action={syncGameFromSteam} className="flex items-end gap-2">
                          <input name="gameId" type="hidden" value={game.id} />
                          <input className="h-10 w-32 rounded-md border border-input bg-background px-3 text-sm" defaultValue={game.steamAppId ?? ""} min={1} name="steamAppId" placeholder="App ID" type="number" />
                          <Button type="submit" variant="outline">
                            Steamから同期
                          </Button>
                        </form>
                        <Button asChild variant="outline">
                          <Link href={`/admin/games?steamSearchGameId=${game.id}`}>候補検索</Link>
                        </Button>
                      </div>
                    </div>

                    {steamSearchGameId === game.id ? (
                      <div className="rounded-md border border-border bg-background p-3">
                        <p className="text-sm font-medium">Steam候補</p>
                        {steamCandidates.length > 0 ? (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {steamCandidates.map((candidate) => (
                              <form action={syncGameFromSteam} className="flex items-center gap-3 rounded-md border border-border p-2" key={candidate.appId}>
                                <input name="gameId" type="hidden" value={game.id} />
                                <input name="steamAppId" type="hidden" value={candidate.appId} />
                                <div className="relative h-10 w-20 overflow-hidden rounded bg-muted">
                                  {candidate.imageUrl ? <Image alt="" className="object-cover" fill sizes="80px" src={candidate.imageUrl} /> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{candidate.name}</p>
                                  <p className="text-xs text-muted-foreground">App ID: {candidate.appId}</p>
                                </div>
                                <Button type="submit" variant="outline">
                                  同期
                                </Button>
                              </form>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">候補が見つかりませんでした。</p>
                        )}
                      </div>
                    ) : null}

                    <SyncPanel
                      action={syncGameFromRawg}
                      buttonText={rawgReady ? "RAWGから同期" : "RAWG設定が必要"}
                      description={game.rawgSlug ? `RAWG slug「${game.rawgSlug}」で空欄を補完します。` : `「${game.name}」でRAWGを検索し、最初の候補で空欄を補完します。`}
                      disabled={!rawgReady}
                      gameId={game.id}
                      title="RAWG同期"
                    />

                    <form action={mergeGame} className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[1fr_auto]">
                      <input name="sourceGameId" type="hidden" value={game.id} />
                      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue="" name="targetGameId" required>
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

                    <GameFieldPanel fields={game.fields} gameId={game.id} />
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

function GameFieldPanel({
  fields,
  gameId,
}: {
  fields: { id: string; key: string; label: string; inputType: string; options: unknown }[];
  gameId: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-sm font-medium">カスタム項目</p>
      <p className="mt-1 text-xs text-muted-foreground">
        このゲームの投稿編集画面に表示される項目です。値は投稿の customFields に保存されます。
      </p>

      {fields.length > 0 ? (
        <div className="mt-3 space-y-2">
          {fields.map((field) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm" key={field.id}>
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {field.label} <span className="text-xs text-muted-foreground">({gameFieldInputTypeLabels[field.inputType] ?? field.inputType})</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  key: {field.key}
                  {Array.isArray(field.options) && field.options.length > 0 ? ` / 選択肢: ${field.options.join(", ")}` : ""}
                </p>
              </div>
              <form action={deleteGameField}>
                <input name="gameFieldId" type="hidden" value={field.id} />
                <Button className="size-8 shrink-0 px-0 text-destructive hover:bg-destructive/10" type="submit" variant="ghost">
                  <Trash2 size={16} />
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">まだ項目がありません。</p>
      )}

      <form action={createGameField} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto_1fr_auto]">
        <input name="gameId" type="hidden" value={gameId} />
        <input className="h-9 rounded-md border border-input bg-background px-2 text-xs" maxLength={60} name="key" placeholder="key (rank_tier)" required />
        <input className="h-9 rounded-md border border-input bg-background px-2 text-xs" maxLength={60} name="label" placeholder="表示名(ランク)" required />
        <select className="h-9 rounded-md border border-input bg-background px-2 text-xs" defaultValue="TEXT" name="inputType">
          <option value="TEXT">テキスト</option>
          <option value="NUMBER">数値</option>
          <option value="SELECT">選択式</option>
        </select>
        <input className="h-9 rounded-md border border-input bg-background px-2 text-xs" name="options" placeholder="選択肢(選択式のみ、カンマ区切り)" />
        <Button className="h-9" type="submit" variant="outline">
          追加
        </Button>
      </form>
    </div>
  );
}

function TextUrlInput({ label, name, value }: { label: string; name: string; value: string | null }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={value ?? ""} name={name} type="url" />
    </label>
  );
}

function NumberInput({ label, name, value }: { label: string; name: string; value: number | null }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={value ?? ""} min={1} name={name} type="number" />
    </label>
  );
}

function SyncPanel({
  action,
  buttonText,
  description,
  disabled,
  gameId,
  title,
}: {
  action: (formData: FormData) => void | Promise<void>;
  buttonText: string;
  description: string;
  disabled: boolean;
  gameId: string;
  title: string;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 lg:grid-cols-[1fr_auto]">
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      <form action={action} className="flex items-end justify-end">
        <input name="gameId" type="hidden" value={gameId} />
        <Button disabled={disabled} type="submit" variant="outline">
          {buttonText}
        </Button>
      </form>
    </div>
  );
}
