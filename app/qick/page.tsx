import type { Metadata } from "next";
import { createQuickShare } from "@/app/qick/actions";
import { QuickShareUploadForm } from "@/components/quick-share/quick-share-upload-form";
import { searchParamError } from "@/lib/actions/error-message";
import { formatBytes } from "@/lib/uploads/account-limits";
import { getQuickShareSettings } from "@/lib/quick-share/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type QickPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function QickPage({ searchParams }: QickPageProps) {
  const [{ error }, settings] = await Promise.all([searchParams, getQuickShareSettings()]);

  const hint = `画像: 最大${formatBytes(settings.maxImageBytes)} / 動画: 最大${formatBytes(settings.maxVideoBytes)}。${settings.retentionHours}時間後に自動的に削除されます。`;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">画像・動画を即アップロード</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          1ファイル選択するだけで自動アップロードされ、共有用URLが発行されます。
        </p>
      </div>
      <QuickShareUploadForm action={createQuickShare} errorMessage={searchParamError(error)} hint={hint} />
    </main>
  );
}
