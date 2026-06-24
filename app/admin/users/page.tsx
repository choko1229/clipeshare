import Link from "next/link";
import { banUser, updateUserAccountLevel, updateUserRole } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const roles = ["USER", "MODERATOR", "ADMIN", "OWNER"] as const;

export default async function AdminUsersPage() {
  const [users, accountLevels] = await Promise.all([
    prisma.user.findMany({
      include: {
        accountLevel: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.accountLevel.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">ユーザー管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">BAN、権限、アカウントレベルをユーザーごとに変更できます。</p>
      </div>
      <div className="divide-y divide-border">
        {users.map((user) => (
          <article className="grid gap-4 p-4 xl:grid-cols-[1fr_520px]" key={user.id}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {user.username ? (
                  <Link className="font-semibold text-primary" href={`/users/${user.username}`}>
                    @{user.username}
                  </Link>
                ) : (
                  <span className="font-semibold">{user.email ?? user.id}</span>
                )}
                <span className="rounded bg-muted px-2 py-1 text-xs">{user.role}</span>
                <span className="rounded bg-muted px-2 py-1 text-xs">{user.accountLevel?.name ?? "default"}</span>
                {user.isBanned ? <span className="rounded bg-destructive px-2 py-1 text-xs">BAN</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{user.displayName ?? user.name ?? user.email ?? "No name"}</p>
              <p className="mt-1 text-xs text-muted-foreground">登録日: {user.createdAt.toLocaleString("ja-JP")}</p>
              {user.banReason ? <p className="mt-2 text-sm text-destructive">{user.banReason}</p> : null}
            </div>

            <div className="grid gap-3">
              <form action={updateUserRole} className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <input name="userId" type="hidden" value={user.id} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={user.role} name="role">
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="権限変更理由" />
                <Button type="submit" variant="outline">
                  権限変更
                </Button>
              </form>

              <form action={updateUserAccountLevel} className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                <input name="userId" type="hidden" value={user.id} />
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={user.accountLevelId ?? ""} name="accountLevelId">
                  <option value="">デフォルト</option>
                  {accountLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="レベル変更理由" />
                <Button type="submit" variant="outline">
                  レベル変更
                </Button>
              </form>

              <form action={banUser} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input name="userId" type="hidden" value={user.id} />
                <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="BAN理由" required />
                <Button disabled={user.isBanned} type="submit" variant="destructive">
                  BAN
                </Button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
