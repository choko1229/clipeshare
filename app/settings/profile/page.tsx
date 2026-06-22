import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { updateProfile } from "@/app/settings/profile/actions";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      displayName: true,
      name: true,
      email: true,
      bio: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">プロフィール編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">公開プロフィールに表示する情報を設定します。</p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form action={updateProfile} className="space-y-5">
          <div>
            <label className="block text-sm font-medium" htmlFor="username">
              ユーザーID
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={user.username ?? ""}
              id="username"
              maxLength={30}
              minLength={3}
              name="username"
              pattern="[a-zA-Z0-9_]+"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="displayName">
              表示名
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={user.displayName ?? user.name ?? user.email ?? ""}
              id="displayName"
              maxLength={60}
              name="displayName"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="bio">
              自己紹介
            </label>
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition focus:ring-2"
              defaultValue={user.bio ?? ""}
              id="bio"
              maxLength={500}
              name="bio"
            />
          </div>

          <Button type="submit">保存</Button>
        </form>
      </section>
    </main>
  );
}
