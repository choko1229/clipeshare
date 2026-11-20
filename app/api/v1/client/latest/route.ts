import { ApiError } from "@/lib/api/errors";
import { apiJson, apiRoute } from "@/lib/api/handler";
import { getQuickApiSettings } from "@/lib/quick-share/api-settings";
import { getLatestClientRelease } from "@/lib/quick-client/releases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** クライアントの更新確認用。GitHub Releases の最新をサーバー側でキャッシュして返す(認証不要) */
export const GET = apiRoute("/api/v1/client/latest", async (_request, context) => {
  const [release, settings] = await Promise.all([getLatestClientRelease(), getQuickApiSettings()]);

  if (!release) {
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "更新情報を取得できませんでした。", reason: "release_unavailable" });
  }

  return apiJson(
    {
      version: release.version,
      publishedAt: release.publishedAt,
      notes: release.notes,
      minSupportedVersion: settings.clientMinSupportedVersion,
      assets: release.assets,
    },
    200,
    context,
  );
});
