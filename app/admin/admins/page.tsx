import Link from "next/link";
import { promoteAdmin, updateUserRole } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const adminRoles = ["MODERATOR", "ADMIN", "OWNER"] as const;

export default async function AdminAdminsPage() {
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: ["MODERATOR", "ADMIN", "OWNER"],
      },
    },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">管理者追加</h2>
          <p className="mt-1 text-sm text-muted-foreground">メールアドレスまたはユーザー名から、管理権限を付与します。</p>
        </div>
        <form action={promoteAdmin} className="grid gap-3 p-4 lg:grid-cols-[1fr_180px_1fr_auto]">
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="identifier" placeholder="email@example.com または username" required />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue="MODERATOR" name="role">
            {adminRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="追加理由" />
          <Button type="submit">追加</Button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold">現在の管理者</h2>
        </div>
        <div className="divide-y divide-border">
          {admins.map((admin) => (
            <article className="grid gap-3 p-4 lg:grid-cols-[1fr_420px]" key={admin.id}>
              <div>
                {admin.username ? (
                  <Link className="font-semibold text-primary" href={`/users/${admin.username}`}>
                    @{admin.username}
                  </Link>
                ) : (
                  <p className="font-semibold">{admin.email ?? admin.id}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">{admin.displayName ?? admin.name ?? admin.email ?? "No name"}</p>
              </div>
              <form action={updateUserRole} className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <input name="userId" type="hidden" value={admin.id} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={admin.role} name="role">
                  <option value="USER">USER</option>
                  {adminRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="変更理由" />
                <Button type="submit" variant="outline">
                  更新
                </Button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
