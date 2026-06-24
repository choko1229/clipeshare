import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { updateProfile } from "@/app/settings/profile/actions";

const linkTypes = [
  { value: "x", label: "X" },
  { value: "discord", label: "Discord" },
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "website", label: "Website" },
];

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      links: {
        orderBy: {
          sortOrder: "asc",
        },
        take: 5,
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const linkRows = Array.from({ length: 5 }, (_, index) => user.links[index] ?? null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">プロフィール編集</h1>
        <p className="mt-2 text-sm text-muted-foreground">公開プロフィールに表示する情報を設定します。</p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        <form action={updateProfile} className="space-y-5">
          <div>
            <label className="block text-sm font-medium" htmlFor="avatar">
              アイコン
            </label>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              id="avatar"
              name="avatar"
              type="file"
            />
            <p className="mt-2 text-xs text-muted-foreground">jpg / png / webp、2MBまで。</p>
          </div>

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

          <div>
            <h2 className="text-sm font-medium">SNSリンク</h2>
            <div className="mt-2 space-y-3">
              {linkRows.map((link, index) => (
                <div className="grid gap-2 sm:grid-cols-[130px_1fr]" key={link?.id ?? index}>
                  <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={link?.type ?? "website"} name="linkType">
                    {linkTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={link?.url ?? ""}
                    maxLength={500}
                    name="linkUrl"
                    placeholder="https://..."
                    type="url"
                  />
                  <input
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:col-span-2"
                    defaultValue={link?.label ?? ""}
                    maxLength={80}
                    name="linkLabel"
                    placeholder="表示名 任意"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit">保存</Button>
        </form>
      </section>
    </main>
  );
}
