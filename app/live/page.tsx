import type { Metadata } from "next";
import { CopyField } from "@/components/live/copy-field";
import { LiveDashboardPanel } from "@/components/live/live-dashboard-panel";
import { Button } from "@/components/ui/button";
import { requireActiveUser } from "@/lib/auth/active-user";
import { canUseFixedStreamKey } from "@/lib/live/access";
import { getOrCreateLiveStream } from "@/lib/live/stream";
import { rtmpIngestUrl, vrchatMpegTsUrl, vrchatRtspUrl, webViewUrl } from "@/lib/live/urls";
import { forceStopStream, regenerateStreamKey, regenerateViewToken, setCustomStreamKey, updateVisibility } from "@/app/live/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ライブ配信",
  robots: { index: false, follow: false },
};

type LivePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const visibilityLabels = {
  PUBLIC: "公開",
  FOLLOWERS_ONLY: "フォロワー限定",
  PRIVATE: "非公開",
} as const;

export default async function LivePage({ searchParams }: LivePageProps) {
  const { error } = await searchParams;
  const user = await requireActiveUser();
  const stream = await getOrCreateLiveStream(user.id);
  const canFixedKey = await canUseFixedStreamKey(user.id);
  const mediaDomain = process.env.LIVE_MEDIA_DOMAIN ?? "live.clipshare.link";
  const hlsSrc = `https://${mediaDomain}/live/${stream.viewToken}/index.m3u8`;

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">ライブ配信</h1>
        {stream.status === "LIVE" ? (
          <form action={forceStopStream}>
            <Button type="submit" variant="destructive">
              配信を今すぐ終了する
            </Button>
          </form>
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(360px,4fr)]">
        <div className="min-w-0">
          <LiveDashboardPanel hlsSrc={hlsSrc} viewToken={stream.viewToken} />
        </div>

        <div className="space-y-4">
          <section className="rounded-md border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">OBS配信設定</h2>
            <p className="mb-1 text-xs text-muted-foreground">ストリームサーバー</p>
            <CopyField value={rtmpIngestUrl()} />
            <p className="mb-1 mt-3 text-xs text-muted-foreground">ストリームキー</p>
            <CopyField maskable value={stream.streamKey} />
            <div className="mt-3 flex gap-2">
              <form action={regenerateStreamKey}>
                <Button type="submit" variant="outline">
                  キーを再発行
                </Button>
              </form>
            </div>
            {canFixedKey ? (
              <form action={setCustomStreamKey} className="mt-3 flex gap-2">
                <input
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-xs font-mono outline-none ring-ring transition focus:ring-2"
                  maxLength={32}
                  minLength={6}
                  name="streamKey"
                  pattern="[a-zA-Z0-9_-]{6,32}"
                  placeholder="固定IDを入力(半角英数字・6〜32文字)"
                />
                <Button type="submit" variant="outline">
                  固定IDに切り替え
                </Button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">trusted以上のアカウントは固定IDに切り替えられます。</p>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">視聴リンク</h2>
            <p className="mb-1 text-xs text-muted-foreground">Web視聴</p>
            <CopyField value={webViewUrl(stream.viewToken)} />

            <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">VRChat</p>
            <p className="mb-1 mt-2 text-xs text-muted-foreground">RTSP(PC版)</p>
            <CopyField value={vrchatRtspUrl(stream.viewToken)} />
            <p className="mb-1 mt-3 text-xs text-muted-foreground">MPEG-TS(Quest等)</p>
            <CopyField value={vrchatMpegTsUrl(stream.viewToken)} />

            <form action={updateVisibility} className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">公開範囲</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-ring transition focus:ring-2"
                defaultValue={stream.visibility}
                name="visibility"
              >
                {Object.entries(visibilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button className="w-full" type="submit" variant="outline">
                公開範囲を更新
              </Button>
            </form>

            {stream.visibility !== "PUBLIC" ? (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                「{visibilityLabels[stream.visibility]}」設定でも、VRChat用URLは知っている人であれば視聴できます。
              </p>
            ) : null}

            <form action={regenerateViewToken} className="mt-3">
              <Button className="w-full" type="submit" variant="outline">
                視聴リンクを再発行
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
