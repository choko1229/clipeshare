import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { createQuickShare } from "@/app/qick/actions";
import { authOptions } from "@/auth";
import { QuickShareList } from "@/components/quick-share/quick-share-list";
import { QuickShareUploadForm } from "@/components/quick-share/quick-share-upload-form";
import { searchParamError } from "@/lib/actions/error-message";
import { prisma } from "@/lib/db/prisma";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { getStoredUploads } from "@/lib/quick-share/upload-cookie";
import { formatBytes } from "@/lib/uploads/account-limits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type QickPageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
    expired?: string;
    highlight?: string;
  }>;
};

export default async function QickPage({ searchParams }: QickPageProps) {
  const [{ created, error, expired, highlight }, settings, cookieStore, session] = await Promise.all([
    searchParams,
    getQuickShareSettings(),
    cookies(),
    getServerSession(authOptions),
  ]);

  const userId = session?.user?.id ?? null;
  const storedUploads = getStoredUploads(cookieStore);
  const cookieIds = storedUploads.map((upload) => upload.id);

  const orConditions: Array<Record<string, unknown>> = [];
  if (userId) {
    orConditions.push({ userId });
  }
  if (cookieIds.length > 0) {
    orConditions.push({ publicId: { in: cookieIds } });
  }

  const quickShares = orConditions.length
    ? await prisma.quickShare.findMany({
        where: {
          OR: orConditions,
          deletedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const tokenById = new Map(storedUploads.map((upload) => [upload.id, upload.token]));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const listItems = quickShares.map((item) => ({
    canDelete: (userId !== null && item.userId === userId) || tokenById.get(item.publicId) === item.deleteToken,
    expiresAt: item.expiresAt.toISOString(),
    kind: item.kind,
    mediaUrl: item.mediaUrl,
    publicId: item.publicId,
    shareUrl: `${baseUrl}/q/${item.publicId}`,
    status: item.status,
    thumbnailUrl: item.thumbnailUrl,
  }));

  const hint = `画像: 最大${formatBytes(settings.maxImageBytes)} / 動画: 最大${formatBytes(settings.maxVideoBytes)}。${settings.retentionHours}時間後に自動的に削除されます。`;
  const highlightId = created ?? highlight ?? null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">画像・動画を即アップロード</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          1ファイル選択するだけで自動アップロードされ、共有用URLが発行されます。
        </p>
      </div>
      <QuickShareUploadForm action={createQuickShare} errorMessage={searchParamError(error)} hint={hint} />
      {expired ? <p className="mt-4 text-center text-sm text-muted-foreground">指定されたメディアは有効期限切れです。</p> : null}
      <QuickShareList
        highlightId={highlightId}
        isLoggedIn={Boolean(userId)}
        items={listItems}
        showLoginPromptInitially={Boolean(created) && !userId}
      />
    </main>
  );
}
