import { createModerationRule, toggleModerationRule } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const ruleTypeLabels: Record<string, string> = {
  ng_word: "NGワード",
  blocked_url: "ブロックURL",
  blocked_pattern: "正規表現",
};

const actionLabels: Record<string, string> = {
  block: "ブロック",
  report: "自動通報",
};

export default async function AdminModerationPage() {
  const rules = await prisma.moderationRule.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">モデレーションルール追加</h2>
          <p className="mt-1 text-sm text-muted-foreground">投稿本文、投稿編集、コメント本文に適用されます。</p>
        </div>
        <form action={createModerationRule} className="grid gap-3 p-4 lg:grid-cols-[180px_180px_1fr_auto]">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="type" required>
            <option value="ng_word">NGワード</option>
            <option value="blocked_url">ブロックURL</option>
            <option value="blocked_pattern">正規表現</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="action" required>
            <option value="block">ブロック</option>
            <option value="report">自動通報</option>
          </select>
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            maxLength={191}
            name="pattern"
            placeholder="検出する文字列、URL、正規表現"
            required
          />
          <Button type="submit">追加</Button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">登録済みルール</h2>
        </div>
        <div className="divide-y divide-border">
          {rules.length > 0 ? (
            rules.map((rule) => (
              <article className="grid gap-4 p-4 lg:grid-cols-[1fr_180px]" key={rule.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs">{ruleTypeLabels[rule.type] ?? rule.type}</span>
                    <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs">{actionLabels[rule.action] ?? rule.action}</span>
                    <span className={rule.isActive ? "rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground" : "rounded-md bg-muted px-2 py-1 text-xs"}>
                      {rule.isActive ? "有効" : "無効"}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-sm">{rule.pattern}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{rule.createdAt.toLocaleString("ja-JP")}</p>
                </div>
                <form action={toggleModerationRule} className="grid content-start gap-2">
                  <input name="ruleId" type="hidden" value={rule.id} />
                  <input name="isActive" type="hidden" value={rule.isActive ? "false" : "true"} />
                  <Button type="submit" variant={rule.isActive ? "outline" : "secondary"}>
                    {rule.isActive ? "無効化" : "有効化"}
                  </Button>
                </form>
              </article>
            ))
          ) : (
            <p className="p-4 text-sm text-muted-foreground">モデレーションルールはまだありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
