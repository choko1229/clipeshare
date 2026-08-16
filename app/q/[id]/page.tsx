import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { deleteQuickShare } from "@/app/qick/actions";
import { authOptions } from "@/auth";
import { QuickShareViewer } from "@/components/quick-share/quick-share-viewer";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type QuickSharePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function QuickSharePage({ params }: QuickSharePageProps) {
  const { id } = await params;

  const [quickShare, cookieStore, session] = await Promise.all([
    prisma.quickShare.findUnique({ where: { publicId: id } }),
    cookies(),
    getServerSession(authOptions),
  ]);

  const isExpired = !quickShare || quickShare.deletedAt !== null || quickShare.expiresAt <= new Date();

  if (isExpired) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
        <h1 className="text-xl font-bold">有効期限切れです</h1>
        <p className="mt-2 text-sm text-muted-foreground">このメディアは保存期限を過ぎたため削除されました。</p>
      </main>
    );
  }

  const canDelete = cookieStore.get(`qs_del_${id}`)?.value === quickShare.deleteToken;
  const isLoggedIn = Boolean(session?.user?.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${baseUrl}/q/${id}`;
  const expiresAtLabel = quickShare.expiresAt.toLocaleString("ja-JP");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-4 py-10">
      <QuickShareViewer
        canDelete={canDelete}
        deleteAction={deleteQuickShare.bind(null, id)}
        expiresAtLabel={expiresAtLabel}
        isLoggedIn={isLoggedIn}
        kind={quickShare.kind}
        mediaUrl={quickShare.mediaUrl}
        shareUrl={shareUrl}
      />
    </main>
  );
}
