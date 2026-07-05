import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { BadgeCheck } from "lucide-react";
import { authOptions } from "@/auth";
import { verifyAge } from "@/app/settings/age/actions";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { canRetryAgeVerification, isAdultBirthDate, nextAgeRetryAt } from "@/lib/users/age";

type AgeSettingsPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function AgeSettingsPage({ searchParams }: AgeSettingsPageProps) {
  const session = await getServerSession(authOptions);
  const { status } = await searchParams;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      birthDate: true,
      ageVerifiedAt: true,
      ageVerificationFailedAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const isAdult = user.birthDate ? isAdultBirthDate(user.birthDate) : false;
  const verified = Boolean(user.ageVerifiedAt) || isAdult;
  const canRetry = canRetryAgeVerification(user.ageVerificationFailedAt);
  const retryAt = user.ageVerificationFailedAt ? nextAgeRetryAt(user.ageVerificationFailedAt) : null;

  if (isAdult && !user.ageVerifiedAt) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ageVerifiedAt: new Date(),
        ageVerificationFailedAt: null,
      },
    });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">年齢確認</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          NSFW投稿の表示には18歳以上であることの確認が必要です。生年月日は年齢判定のために保存されますが、プロフィールには表示しません。
        </p>
      </div>

      <section className="rounded-md border border-border bg-card p-5">
        {verified ? (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-4">
            <div className="flex items-center gap-2 font-semibold text-primary">
              <BadgeCheck size={20} />
              18歳以上確認済み
            </div>
            <p className="mt-2 text-sm text-muted-foreground">NSFW投稿を表示できます。</p>
          </div>
        ) : null}

        {status === "underage" ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            18歳未満のため、NSFW投稿は表示できません。
          </p>
        ) : null}

        {status === "retry_later" && retryAt ? (
          <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
            再入力は {retryAt.toLocaleDateString("ja-JP")} 以降に可能です。
          </p>
        ) : null}

        {!verified ? (
          <form action={verifyAge} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium" htmlFor="birthDate">
                生年月日
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                disabled={!canRetry}
                id="birthDate"
                name="birthDate"
                required
                type="date"
              />
            </div>
            <Button disabled={!canRetry} type="submit">
              年齢確認する
            </Button>
          </form>
        ) : null}

        <Button asChild className="mt-5" variant="outline">
          <Link href="/settings/profile">プロフィール設定へ戻る</Link>
        </Button>
      </section>
    </main>
  );
}
