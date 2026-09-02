import { updateContactMessageStatus } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const categoryLabels: Record<string, string> = {
  GENERAL: "一般",
  COPYRIGHT: "著作権侵害の申立て",
  PRIVACY: "個人情報の請求",
  BUG: "不具合報告",
  OTHER: "その他",
};

export default async function AdminContactPage() {
  const messages = await prisma.contactMessage.findMany({
    include: {
      handledByAdmin: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">お問い合わせ管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">お問い合わせフォームから送信された内容を確認し、対応状況を更新できます。</p>
      </div>
      <div className="divide-y divide-border">
        {messages.length > 0 ? (
          messages.map((message) => (
            <article className="space-y-4 p-4" key={message.id}>
              <div className="grid gap-3 text-sm lg:grid-cols-[160px_1fr_180px]">
                <div>
                  <p className="font-semibold">{categoryLabels[message.category] ?? message.category}</p>
                  <p className="text-muted-foreground">{message.status}</p>
                </div>
                <div>
                  <p className="font-semibold">{message.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{message.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    送信者: {message.name} ({message.email})
                  </p>
                  {message.handledByAdmin ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      対応者: {message.handledByAdmin.username ?? message.handledByAdmin.email ?? message.handledByAdmin.id}
                    </p>
                  ) : null}
                  {message.adminNote ? <p className="mt-1 text-xs text-muted-foreground">メモ: {message.adminNote}</p> : null}
                </div>
                <p className="text-right text-xs text-muted-foreground">{message.createdAt.toLocaleString("ja-JP")}</p>
              </div>

              <form action={updateContactMessageStatus} className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
                <input name="contactMessageId" type="hidden" value={message.id} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={message.status} name="status">
                  <option value="OPEN">OPEN</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="adminNote" placeholder="対応メモ" />
                <Button type="submit">ステータス更新</Button>
              </form>
            </article>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">お問い合わせはありません。</p>
        )}
      </div>
    </section>
  );
}
