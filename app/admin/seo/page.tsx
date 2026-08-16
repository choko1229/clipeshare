import { updateSeoSettings } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { getSeoSettings } from "@/lib/seo/settings";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  const settings = await getSeoSettings();

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">SEO / 計測設定</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Google Search Console・Bing Webmaster Toolsのサイト所有権確認コードと、Google Analytics 4の測定IDを設定します。
            保存すると次回アクセスから即座にサイト全体へ反映されます(デプロイ不要)。
          </p>
        </div>
        <form action={updateSeoSettings} className="grid gap-4 p-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Google Search Console 確認コード</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.googleSiteVerification ?? ""}
              name="googleSiteVerification"
              placeholder="例: abcdEFGH12345..."
              type="text"
            />
            <span className="text-xs text-muted-foreground">
              Search Consoleで「HTMLタグ」による所有権確認を選択した際に表示される、content=&quot;...&quot;の値だけを貼り付けてください。
            </span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Bing Webmaster Tools 確認コード</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.bingSiteVerification ?? ""}
              name="bingSiteVerification"
              placeholder="例: 1234ABCD..."
              type="text"
            />
            <span className="text-xs text-muted-foreground">Bing Webmaster Toolsの「メタタグ」確認方法で表示されるcontentの値です。</span>
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Google Analytics 4 測定ID</span>
            <input
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue={settings.gaMeasurementId ?? ""}
              name="gaMeasurementId"
              placeholder="例: G-XXXXXXXXXX"
              type="text"
            />
            <span className="text-xs text-muted-foreground">未設定の場合、GA4の計測タグはページに出力されません。</span>
          </label>

          <div>
            <Button type="submit">保存</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
