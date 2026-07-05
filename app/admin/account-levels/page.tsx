import { createAccountLevel, updateAccountLevel, updateStorageRetentionSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_DELETED_FILE_RETENTION_DAYS, DEFAULT_REPLACED_FILE_RETENTION_DAYS, storageSettingKeys } from "@/lib/media/retention";

export const dynamic = "force-dynamic";

function bytesToMb(bytes: bigint) {
  return (bytes / 1_000_000n).toString();
}

function LimitInput({
  defaultValue,
  label,
  min = 0,
  name,
  required = true,
  type = "number",
}: {
  defaultValue?: number | string | null;
  label: string;
  min?: number;
  name: string;
  required?: boolean;
  type?: "number" | "text" | "color";
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        defaultValue={defaultValue ?? ""}
        min={type === "number" ? min : undefined}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

export default async function AdminAccountLevelsPage() {
  const [accountLevels, storageSettings] = await Promise.all([
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
    prisma.storageSetting.findMany({
      where: {
        key: {
          in: [storageSettingKeys.deletedFileRetentionDays, storageSettingKeys.replacedFileRetentionDays],
        },
      },
    }),
  ]);
  const settingMap = new Map(storageSettings.map((setting) => [setting.key, setting.value]));
  const deletedFileRetentionDays = settingMap.get(storageSettingKeys.deletedFileRetentionDays) ?? String(DEFAULT_DELETED_FILE_RETENTION_DAYS);
  const replacedFileRetentionDays = settingMap.get(storageSettingKeys.replacedFileRetentionDays) ?? String(DEFAULT_REPLACED_FILE_RETENTION_DAYS);

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">ストレージ保持設定</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            削除済みファイルと差し替え済みファイルを、完全削除まで何日保持するかを管理します。
          </p>
        </div>
        <form action={updateStorageRetentionSettings} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-2 text-sm">
            削除済みファイル保持日数
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={deletedFileRetentionDays}
              min="1"
              name="deletedFileRetentionDays"
              required
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm">
            差し替え済みファイル保持日数
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={replacedFileRetentionDays}
              min="1"
              name="replacedFileRetentionDays"
              required
              type="number"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" variant="outline">
              保存
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">アカウントレベル追加</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            投稿制限、表示色、自動昇格条件をDBで管理します。Admin / Nuisance などは手動専用にできます。
          </p>
        </div>
        <form action={createAccountLevel} className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-4">
          <LimitInput label="レベル名" name="name" type="text" />
          <LimitInput defaultValue="#8b949e" label="色" name="levelColor" type="color" />
          <LimitInput defaultValue={180} label="動画秒数" name="maxVideoSeconds" />
          <LimitInput defaultValue={300} label="動画MB" name="maxVideoSizeMb" />
          <LimitInput defaultValue={50} label="画像MB" name="maxImageSizeMb" />
          <LimitInput defaultValue={1} label="画像枚数/投稿" name="maxImagesPerPost" />
          <LimitInput label="日次投稿上限" min={1} name="dailyUploadLimit" required={false} />
          <LimitInput defaultValue={50} label="表示順" name="sortOrder" />
          <LimitInput defaultValue={0} label="昇格: 投稿数" name="minPostCount" />
          <LimitInput defaultValue={0} label="昇格: 登録日数" name="minAccountAgeDays" />
          <LimitInput defaultValue={0} label="昇格: フォロワー数" name="minFollowerCount" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input name="isDefault" type="checkbox" />
              初期値
            </label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input name="isManualOnly" type="checkbox" />
              手動専用
            </label>
            <Button type="submit">追加</Button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">アカウントレベル一覧</h2>
        </div>
        <div className="divide-y divide-border">
          {accountLevels.map((level) => (
            <form action={updateAccountLevel} className="grid gap-3 p-4 lg:grid-cols-2 xl:grid-cols-4" key={level.id}>
              <input name="accountLevelId" type="hidden" value={level.id} />
              <LimitInput defaultValue={level.name} label="レベル名" name="name" type="text" />
              <LimitInput defaultValue={level.levelColor} label="色" name="levelColor" type="color" />
              <LimitInput defaultValue={level.maxVideoSeconds} label="動画秒数" name="maxVideoSeconds" />
              <LimitInput defaultValue={bytesToMb(level.maxVideoSizeBytes)} label="動画MB" name="maxVideoSizeMb" />
              <LimitInput defaultValue={bytesToMb(level.maxImageSizeBytes)} label="画像MB" name="maxImageSizeMb" />
              <LimitInput defaultValue={level.maxImagesPerPost} label="画像枚数/投稿" name="maxImagesPerPost" />
              <LimitInput defaultValue={level.dailyUploadLimit ?? ""} label="日次投稿上限" min={1} name="dailyUploadLimit" required={false} />
              <LimitInput defaultValue={level.sortOrder} label="表示順" name="sortOrder" />
              <LimitInput defaultValue={level.minPostCount} label="昇格: 投稿数" name="minPostCount" />
              <LimitInput defaultValue={level.minAccountAgeDays} label="昇格: 登録日数" name="minAccountAgeDays" />
              <LimitInput defaultValue={level.minFollowerCount} label="昇格: フォロワー数" name="minFollowerCount" />
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <input defaultChecked={level.isDefault} name="isDefault" type="checkbox" />
                  初期値
                </label>
                <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                  <input defaultChecked={level.isManualOnly} name="isManualOnly" type="checkbox" />
                  手動専用
                </label>
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
