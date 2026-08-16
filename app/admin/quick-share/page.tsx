import { updateQuickShareSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { getQuickShareSettings } from "@/lib/quick-share/settings";

export const dynamic = "force-dynamic";

export default async function AdminQuickSharePage() {
  const settings = await getQuickShareSettings();

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">クイック共有(/qick)設定</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            未ログインでも使える画像/動画の一時URL発行ツールの上限値を設定します。保存すると次回アクセスから即座に反映されます(デプロイ不要)。
          </p>
        </div>
        <form action={updateQuickShareSettings} className="grid gap-4 p-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">画像サイズ上限(バイト)</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.maxImageBytes}
              min={1}
              name="maxImageBytes"
              required
              type="number"
            />
            <span className="text-xs text-muted-foreground">例: 20000000 で約20MB。</span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">動画サイズ上限(バイト)</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.maxVideoBytes}
              min={1}
              name="maxVideoBytes"
              required
              type="number"
            />
            <span className="text-xs text-muted-foreground">例: 200000000 で約200MB。動画は変換せずそのまま配信されます。</span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">保存時間(時間)</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.retentionHours}
              max={168}
              min={1}
              name="retentionHours"
              required
              type="number"
            />
            <span className="text-xs text-muted-foreground">アップロードから自動削除されるまでの時間です(デフォルト24時間)。</span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">未ログインユーザーの1日あたりアップロード上限</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.anonymousDailyLimit}
              min={1}
              name="anonymousDailyLimit"
              required
              type="number"
            />
            <span className="text-xs text-muted-foreground">
              ログイン済みユーザーはアカウントレベルの日次投稿上限がそのまま適用されます。
            </span>
          </label>

          <div>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
