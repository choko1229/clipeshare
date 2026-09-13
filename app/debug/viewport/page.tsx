import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { ViewportDiagnostics } from "@/components/pwa/viewport-diagnostics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "表示診断",
  robots: {
    index: false,
    follow: false,
  },
};

const STAFF_ROLES = ["MODERATOR", "ADMIN", "OWNER"];

export default async function ViewportDebugPage() {
  const session = await getServerSession(authOptions);

  // 運営向けの調査用ページなので、存在自体を一般の利用者に見せない。
  if (!session?.user?.role || !STAFF_ROLES.includes(session.user.role)) {
    notFound();
  }

  return (
    <main className="px-4 py-6">
      <h1 className="text-2xl font-bold">表示診断</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        この画面のスクリーンショットを送ってください。PWAの表示幅やセーフエリアが正しく認識されているかを確認します。
      </p>
      <ViewportDiagnostics />
    </main>
  );
}
