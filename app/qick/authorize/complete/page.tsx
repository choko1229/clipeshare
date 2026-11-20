import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { AuthorizeCompleteView } from "@/components/quick-auth/authorize-views";
import { findRecentApprovedAuthorization } from "@/lib/api-auth/authorization";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "アプリの連携",
  robots: {
    index: false,
    follow: false,
  },
};

/** クライアントのループバックがブラウザを戻す先(任意)。直近に許可した端末を表示する */
export default async function QuickAuthorizeCompletePage() {
  const session = await getServerSession(authOptions);
  const recent = session?.user?.id ? await findRecentApprovedAuthorization(session.user.id) : null;

  return <AuthorizeCompleteView deviceName={recent?.deviceName ?? null} devicePlatform={recent?.devicePlatform ?? null} />;
}
