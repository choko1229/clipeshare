import { Info } from "lucide-react";
import { updateQuickShareSettings } from "@/app/admin/actions";
import { updateAccountLevelQuickShareLimits } from "@/app/admin/quick-share-actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { getQuickShareSettings } from "@/lib/quick-share/settings";

export const dynamic = "force-dynamic";

function bytesToMb(bytes: number | bigint) {
  return typeof bytes === "bigint" ? (bytes / 1_000_000n).toString() : String(Math.round(bytes / 1_000_000));
}

function Field({
  defaultValue,
  hint,
  label,
  min,
  max,
  name,
  readOnly = false,
  required = true,
  type = "number",
}: {
  defaultValue: string | number;
  hint?: string;
  label: string;
  min?: number;
  max?: number;
  name?: string;
  readOnly?: boolean;
  required?: boolean;
  type?: "number" | "text";
}) {
  return (
    <label className="grid content-start gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className={
          readOnly
            ? "h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
            : "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        }
        defaultValue={defaultValue}
        max={max}
        min={min}
        name={name}
        readOnly={readOnly}
        required={!readOnly && required}
        type={type}
      />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export default async function AdminQuickSharePage() {
  const [settings, accountLevels] = await Promise.all([
    getQuickShareSettings(),
    prisma.accountLevel.findMany({
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">管理 › クイック共有</h2>
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm">
        <Info aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" size={16} />
        <p>クイック共有の上限は、投稿用の上限とは別に設定します。0 を入れると無制限になります。ツール経由のアップロードにも同じ上限が使われます。</p>
      </div>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold">クイック共有の設定</h3>
          <p className="mt-1 text-sm text-muted-foreground">サイト全体の初期値です。未ログインの利用と、レベル別の設定がないときに使います。</p>
        </div>
        <form action={updateQuickShareSettings} className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field defaultValue={bytesToMb(settings.maxImageBytes)} label="画像の上限（MB）" max={1_000_000} min={1} name="maxImageMb" />
          <Field defaultValue={bytesToMb(settings.maxVideoBytes)} label="動画の上限（MB）" max={1_000_000} min={1} name="maxVideoMb" />
          <Field defaultValue={settings.retentionHours} label="保存時間（時間）" max={168} min={1} name="retentionHours" />
          <Field defaultValue={settings.anonymousDailyLimit} label="未ログインの1日あたり件数" min={1} name="anonymousDailyLimit" />
          <div>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold">アカウントレベル一覧</h3>
        </div>
        <div className="divide-y divide-border">
          {accountLevels.map((level) => (
            <form action={updateAccountLevelQuickShareLimits} className="grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-8" key={level.id}>
              <input name="accountLevelId" type="hidden" value={level.id} />
              <Field defaultValue={level.name} label="レベル名" readOnly type="text" />
              <Field defaultValue={bytesToMb(level.maxImageSizeBytes)} label="画像MB（投稿）" readOnly />
              <Field defaultValue={bytesToMb(level.maxVideoSizeBytes)} label="動画MB（投稿）" readOnly />
              <Field defaultValue={level.dailyUploadLimit ?? "未設定"} label="日次投稿上限" readOnly type="text" />
              <Field
                defaultValue={level.quickShareImageMaxBytes === null ? "" : bytesToMb(level.quickShareImageMaxBytes)}
                hint="0 = 無制限"
                label="クイック共有 画像MB"
                max={1_000_000}
                min={0}
                name="quickShareImageMaxMb"
                required={false}
              />
              <Field
                defaultValue={level.quickShareVideoMaxBytes === null ? "" : bytesToMb(level.quickShareVideoMaxBytes)}
                hint="0 = 無制限"
                label="クイック共有 動画MB"
                max={1_000_000}
                min={0}
                name="quickShareVideoMaxMb"
                required={false}
              />
              <Field defaultValue={level.sortOrder} label="表示順" readOnly />
              <div className="flex items-end gap-3">
                <p className="flex h-10 items-center text-sm text-muted-foreground">{level._count.users}人</p>
                <Button type="submit" variant="outline">
                  更新
                </Button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
