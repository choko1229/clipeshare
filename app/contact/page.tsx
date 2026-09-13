import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { getServerSession } from "next-auth";
import { submitContactMessage } from "@/app/contact/actions";
import { authOptions } from "@/auth";
import { SubmitButton } from "@/components/ui/submit-button";
import { searchParamError } from "@/lib/actions/error-message";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "Clipshareへのお問い合わせ、著作権侵害の申立て、不具合報告はこちらのフォームから受け付けています。",
};

const contactEmail = "chokops4twitter@gmail.com";

const categories = [
  { value: "GENERAL", label: "一般的なお問い合わせ" },
  { value: "COPYRIGHT", label: "著作権侵害の申立て・削除依頼" },
  { value: "PRIVACY", label: "個人情報の開示・訂正・削除の請求" },
  { value: "BUG", label: "不具合の報告" },
  { value: "OTHER", label: "その他" },
];

type ContactPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const [{ success, error }, session] = await Promise.all([searchParams, getServerSession(authOptions)]);
  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true, name: true, email: true },
      })
    : null;
  const errorMessage = searchParamError(error);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">お問い合わせ</h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">
            サービスに関するご質問、著作権侵害の申立て、個人情報の開示・削除請求、不具合の報告などは、以下のフォームから受け付けています。内容を確認のうえ、順次対応いたします。
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail size={16} />
            フォームをご利用いただけない場合は{" "}
            <a className="text-primary hover:underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>{" "}
            まで直接ご連絡ください。
          </p>

          {success ? (
            <div className="mt-8 rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
              お問い合わせを受け付けました。内容を確認のうえ、必要に応じてご連絡いたします。
            </div>
          ) : (
            <form action={submitContactMessage} className="mt-8 space-y-4">
              {errorMessage ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</div>
              ) : null}

              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">ウェブサイト</label>
                <input autoComplete="off" id="website" name="website" tabIndex={-1} type="text" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="category">
                  お問い合わせ種別
                </label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue="GENERAL"
                  id="category"
                  name="category"
                  required
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="name">
                    お名前
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={currentUser?.displayName || currentUser?.name || ""}
                    id="name"
                    maxLength={100}
                    name="name"
                    required
                    type="text"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="email">
                    メールアドレス
                  </label>
                  <input
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    defaultValue={currentUser?.email || ""}
                    id="email"
                    maxLength={200}
                    name="email"
                    required
                    type="email"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="subject">
                  件名
                </label>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  id="subject"
                  maxLength={200}
                  name="subject"
                  required
                  type="text"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="message">
                  お問い合わせ内容
                </label>
                <textarea
                  className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  id="message"
                  maxLength={5000}
                  name="message"
                  required
                />
              </div>

              <SubmitButton className="w-full sm:w-auto" pendingLabel="送信中">
                送信する
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
