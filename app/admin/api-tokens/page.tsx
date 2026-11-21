import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { deleteClientAssetChecksum, registerClientAssetChecksum, revokeApiTokenByAdmin, updateQuickApiSettings } from "@/app/admin/quick-share-actions";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";
import { formatRelativeTimeJa } from "@/lib/format/relative-time";
import { getClientReleaseStatuses } from "@/lib/quick-client/releases";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";

export const dynamic = "force-dynamic";

const revokeReasonLabels = {
  USER: "本人",
  SELF: "アプリ",
  ADMIN: "管理者",
  CODE_REUSE: "コード再使用",
} as const;

type AdminApiTokensPageProps = {
  searchParams: Promise<{
    q?: string;
    active?: string;
  }>;
};

export default async function AdminApiTokensPage({ searchParams }: AdminApiTokensPageProps) {
  await requireAdmin();
  const { q, active } = await searchParams;
  const query = typeof q === "string" ? q.trim().replace(/^@/, "").slice(0, 80) : "";
  const activeOnly = active === "1";

  const where: Prisma.ApiTokenWhereInput = {
    ...(activeOnly ? { revokedAt: null } : {}),
    ...(query ? { user: { username: { contains: query } } } : {}),
  };

  const [tokens, settings] = await Promise.all([
    prisma.apiToken.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      // トークン値・ハッシュは取得しない
      select: {
        id: true,
        name: true,
        prefix: true,
        platform: true,
        clientVersion: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        revokedReason: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    }),
    getQuickApiSettings(),
  ]);
  const [releaseStatus, manualChecksums] = await Promise.all([
    getClientReleaseStatuses(),
    prisma.quickClientAssetChecksum.findMany({
      where: { repo: settings.clientGithubRepo },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const now = new Date();

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">連携トークン</h2>
        </div>
        <form className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]" method="get">
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            defaultValue={query}
            name="q"
            placeholder="ユーザー名で絞り込み"
          />
          <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input defaultChecked={activeOnly} name="active" type="checkbox" value="1" />
            有効のみ
          </label>
          <Button type="submit" variant="outline">
            検索
          </Button>
        </form>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">ユーザー</th>
                <th className="px-4 py-2 font-medium">端末名</th>
                <th className="px-4 py-2 font-medium">先頭文字</th>
                <th className="px-4 py-2 font-medium">作成</th>
                <th className="px-4 py-2 font-medium">最終使用</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className="px-4 py-3">
                    {token.user.username ? (
                      <Link className="font-semibold text-primary" href={`/users/${token.user.username}`}>
                        @{token.user.username}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{token.user.id}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="break-all">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[token.platform, token.clientVersion ? `v${token.clientVersion}` : null].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{token.prefix}</td>
                  <td className="px-4 py-3 text-muted-foreground">{token.createdAt.toLocaleDateString("ja-JP")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{token.lastUsedAt ? formatRelativeTimeJa(token.lastUsedAt, now) : "—"}</td>
                  <td className="px-4 py-3">
                    {token.revokedAt ? (
                      <span className="text-muted-foreground">
                        失効済み{token.revokedReason ? `（${revokeReasonLabels[token.revokedReason]}）` : ""}
                      </span>
                    ) : (
                      <span className="font-semibold text-primary">有効</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {token.revokedAt ? (
                      "—"
                    ) : (
                      <form action={revokeApiTokenByAdmin} className="flex justify-end gap-2">
                        <input name="tokenId" type="hidden" value={token.id} />
                        <input className="h-9 w-40 rounded-md border border-input bg-background px-2 text-xs" name="reason" placeholder="理由" />
                        <Button className="h-9" type="submit" variant="destructive">
                          失効
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">配布ファイルの SHA-256</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            配信中: {releaseStatus.servedVersion ? `v${releaseStatus.servedVersion}` : "なし"}（{releaseStatus.repo}）
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">リリース</th>
                <th className="px-4 py-2 font-medium">ファイル</th>
                <th className="px-4 py-2 font-medium">取得元</th>
                <th className="px-4 py-2 font-medium">SHA-256</th>
                <th className="px-4 py-2 font-medium">判定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {releaseStatus.statuses.flatMap((release) =>
                (release.assets.length > 0 ? release.assets : [null]).map((asset, index) => (
                  <tr key={`${release.tag}-${asset?.name ?? "none"}`}>
                    <td className="px-4 py-2">{index === 0 ? release.tag : ""}</td>
                    <td className="px-4 py-2 break-all">{asset?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{asset?.source ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{asset?.sha256 ? `${asset.sha256.slice(0, 16)}…` : "—"}</td>
                    <td className="px-4 py-2">
                      {index === 0 ? (
                        release.servable ? (
                          <span className="font-semibold text-primary">配信可</span>
                        ) : (
                          <span className="text-destructive">配信不可（{release.reason}）</span>
                        )
                      ) : null}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <form action={registerClientAssetChecksum} className="grid gap-3 border-t border-border p-4 md:grid-cols-[160px_1fr_2fr_auto]">
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="tag" placeholder="タグ（例 v1.2.3）" required />
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="assetName" placeholder="ファイル名" required />
          <input className="h-10 rounded-md border border-input bg-background px-3 font-mono text-xs" name="sha256" placeholder="SHA-256（64桁）" required />
          <Button type="submit" variant="outline">
            登録
          </Button>
        </form>
        {manualChecksums.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {manualChecksums.map((entry) => (
              <form action={deleteClientAssetChecksum} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm" key={entry.id}>
                <input name="checksumId" type="hidden" value={entry.id} />
                <span>{entry.tag}</span>
                <span className="break-all">{entry.assetName}</span>
                <span className="font-mono text-xs text-muted-foreground">{entry.sha256.slice(0, 16)}…</span>
                <span className="text-xs text-muted-foreground">手動 · {entry.createdAt.toLocaleDateString("ja-JP")}</span>
                <Button className="ml-auto h-8" type="submit" variant="ghost">
                  削除
                </Button>
              </form>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">Clipshare Quick 連携の設定</h2>
        </div>
        <form action={updateQuickApiSettings} className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex h-10 items-center gap-2 self-end rounded-md border border-border px-3 text-sm">
            <input defaultChecked={settings.tokenIssuanceEnabled} name="tokenIssuanceEnabled" type="checkbox" />
            新しい連携を受け付ける
          </label>
          <SettingInput defaultValue={settings.tokenRateLimitPerMinute} label="レート制限: トークン（回/分）" name="tokenRateLimitPerMinute" />
          <SettingInput defaultValue={settings.anonymousRateLimitPerMinute} label="レート制限: 未ログイン（回/分）" name="anonymousRateLimitPerMinute" />
          <SettingInput defaultValue={settings.authFailureLimitPer10Minutes} label="認証失敗の上限（回/10分）" name="authFailureLimitPer10Minutes" />
          <SettingInput defaultValue={settings.clientGithubRepo} label="配布元 GitHub リポジトリ" name="clientGithubRepo" type="text" />
          <SettingInput defaultValue={settings.clientMinSupportedVersion ?? ""} label="最小対応バージョン" name="clientMinSupportedVersion" required={false} type="text" />
          <SettingInput defaultValue={settings.clientReleaseCacheSeconds} label="リリース情報のキャッシュ（秒）" min={60} name="clientReleaseCacheSeconds" />
          <SettingInput defaultValue={settings.clientSupportedOs} label="対応OS" name="clientSupportedOs" type="text" />
          <SettingInput
            defaultValue={settings.clientCertFingerprint ?? ""}
            label="署名証明書のフィンガープリント（SHA-256）"
            name="clientCertFingerprint"
            placeholder="AB:CD:EF:…:89"
            required={false}
            type="text"
          />
          <div>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SettingInput({
  defaultValue,
  label,
  min = 0,
  name,
  placeholder,
  required = true,
  type = "number",
}: {
  defaultValue: string | number;
  label: string;
  min?: number;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: "number" | "text";
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        defaultValue={defaultValue}
        min={type === "number" ? min : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}
