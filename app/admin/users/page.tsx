import Link from "next/link";
import { banUser } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">ユーザー管理</h2>
      </div>
      <div className="divide-y divide-border">
        {users.map((user) => (
          <article className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]" key={user.id}>
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
                {user.isBanned ? <span className="rounded bg-destructive px-2 py-1 text-xs">BAN</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{user.displayName ?? user.name ?? user.email ?? "No name"}</p>
              {user.banReason ? <p className="mt-2 text-sm text-destructive">{user.banReason}</p> : null}
            </div>
            <form action={banUser} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input name="userId" type="hidden" value={user.id} />
              <input className="h-10 rounded-md border border-input bg-background px-3 text-sm" name="reason" placeholder="BAN理由" required />
              <Button disabled={user.isBanned} type="submit" variant="destructive">
                BAN
              </Button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
