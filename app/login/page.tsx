import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { LoginActions } from "@/components/auth/login-actions";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-md place-items-center px-4 py-10">
      <section className="w-full rounded-md border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">ログイン</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            投稿、いいね、コメント、ブックマーク、フォローにはログインが必要です。
          </p>
        </div>

        <LoginActions />
      </section>
    </main>
  );
}
