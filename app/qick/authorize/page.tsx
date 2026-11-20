import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { AuthorizeConsentView, AuthorizeInvalidView } from "@/components/quick-auth/authorize-views";
import { logApi } from "@/lib/api/log";
import { startAuthorization } from "@/lib/api-auth/authorization";
import { authorizePathFromParams, parseAuthorizeParams } from "@/lib/api-auth/authorize-params";
import { prisma } from "@/lib/db/prisma";
import { formatRelativeTimeJa } from "@/lib/format/relative-time";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "アプリの連携",
  robots: {
    index: false,
    follow: false,
  },
};

type QuickAuthorizePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuickAuthorizePage({ searchParams }: QuickAuthorizePageProps) {
  const params = parseAuthorizeParams(await searchParams);

  // redirect_uri を含め不正なら、どこにもリダイレクトせず無効表示
  if (!params) {
    return <AuthorizeInvalidView />;
  }

  const session = await getServerSession(authOptions);
  const authorizePath = authorizePathFromParams(params);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(authorizePath)}`);
  }

  const [settings, user] = await Promise.all([
    getQuickApiSettings(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, displayName: true, name: true, isBanned: true },
    }),
  ]);

  if (!user || user.isBanned || !settings.tokenIssuanceEnabled) {
    logApi("warn", {
      event: "api_auth.authorize_rejected",
      userId: session.user.id,
      reason: !user ? "user_missing" : user.isBanned ? "user_banned" : "token_issuance_disabled",
    });
    return <AuthorizeInvalidView />;
  }

  const result = await startAuthorization(user.id, params);

  if (result.kind === "invalid") {
    logApi("warn", { event: "api_auth.authorize_invalid", userId: user.id, reason: result.reason });
    return <AuthorizeInvalidView />;
  }

  const { authorization, csrfToken } = result;
  const relative = formatRelativeTimeJa(authorization.createdAt);
  const requested = relative === "たった今" ? "たった今リクエスト" : `${relative}にリクエスト`;
  const deviceDetail = [authorization.devicePlatform, requested].filter(Boolean).join(" · ");
  const accountName = user.username ?? user.displayName ?? user.name ?? "";
  const switchAccountHref = `/api/auth/signout?callbackUrl=${encodeURIComponent(`/login?callbackUrl=${encodeURIComponent(authorizePath)}`)}`;

  return (
    <AuthorizeConsentView
      accountName={accountName}
      authorizationId={authorization.id}
      connectionCode={authorization.connectionCode}
      csrfToken={csrfToken}
      deviceDetail={deviceDetail}
      deviceName={authorization.deviceName}
      switchAccountHref={switchAccountHref}
    />
  );
}
