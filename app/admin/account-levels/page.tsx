import { createAccountLevel, updateAccountLevel, updateStorageRetentionSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_DELETED_FILE_RETENTION_DAYS, DEFAULT_REPLACED_FILE_RETENTION_DAYS, storageSettingKeys } from "@/lib/media/retention";

export const dynamic = "force-dynamic";

function bytesToMb(bytes: bigint) {
  return (bytes / 1_000_000n).toString();
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
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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
          <p className="mt-1 text-sm text-muted-foreground">元動画は変換後30日固定です。削除済み/差し替え済みファイルの保持日数はここで変更できます。</p>
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
          <p className="mt-1 text-sm text-muted-foreground">動画時間、動画サイズ、画像サイズ、1日の投稿数上限をDBで管理します。</p>
        </div>
        <form action={createAccountLevel} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_150px_150px_120px_auto]">
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="name" placeholder="level name" required />
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="maxVideoSeconds" placeholder="動画秒数" required type="number" min="1" />
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="maxVideoSizeMb" placeholder="動画MB" required type="number" min="1" />
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="maxImageSizeMb" placeholder="画像MB" required type="number" min="1" />
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="dailyUploadLimit" placeholder="日次上限" type="number" min="1" />
          <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input name="isDefault" type="checkbox" />
            初期値
          </label>
          <Button type="submit">追加</Button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">アカウントレベル一覧</h2>
        </div>
        <div className="divide-y divide-border">
          {accountLevels.map((level) => (
            <form action={updateAccountLevel} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_150px_150px_150px_150px_120px_100px_auto]" key={level.id}>
              <input name="accountLevelId" type="hidden" value={level.id} />
              <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={level.name} name="name" required />
              <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={level.maxVideoSeconds} name="maxVideoSeconds" required type="number" min="1" />
              <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={bytesToMb(level.maxVideoSizeBytes)} name="maxVideoSizeMb" required type="number" min="1" />
              <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={bytesToMb(level.maxImageSizeBytes)} name="maxImageSizeMb" required type="number" min="1" />
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={level.dailyUploadLimit ?? ""}
                name="dailyUploadLimit"
                type="number"
                min="1"
              />
              <label className="flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                <input defaultChecked={level.isDefault} name="isDefault" type="checkbox" />
                初期値
              </label>
              <p className="flex h-10 items-center text-sm text-muted-foreground">{level._count.users}人</p>
              <Button type="submit" variant="outline">
                更新
              </Button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
