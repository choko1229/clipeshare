import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { LiveViewerPanel } from "@/components/live/live-viewer-panel";
import { prisma } from "@/lib/db/prisma";
import { canViewLiveStream } from "@/lib/live/visibility";

export const dynamic = "force-dynamic";

type ViewerPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export async function generateMetadata({ params }: ViewerPageProps): Promise<Metadata> {
  const { token } = await params;
  const stream = await prisma.liveStream.findUnique({
    where: { viewToken: token },
    select: { user: { select: { displayName: true, username: true } } },
  });

  const name = stream?.user.displayName ?? stream?.user.username ?? "配信";

  return {
    title: `${name} のライブ配信`,
    robots: { index: false, follow: false },
  };
}

export default async function LiveViewerPage({ params }: ViewerPageProps) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  const stream = await prisma.liveStream.findUnique({
    where: { viewToken: token },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          name: true,
        },
      },
    },
  });

  if (!stream) {
    notFound();
  }

  const access = await canViewLiveStream(stream, session?.user?.id, session?.user?.role);
  const streamerName = stream.user.displayName ?? stream.user.username ?? stream.user.name ?? "配信者";

  if (access !== "allowed") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="aspect-video rounded-md border border-border bg-muted" />
        <p className="mt-6 text-lg font-semibold">
          {access === "login_required"
            ? "この配信を視聴するにはログインしてください。"
            : access === "not_following"
              ? "この配信はフォロワー限定です。"
              : "この配信は視聴できません。"}
        </p>
      </main>
    );
  }

  if (stream.status !== "LIVE") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="grid aspect-video place-items-center rounded-md border border-border bg-muted">
          <p className="text-lg font-semibold text-muted-foreground">現在オフラインです</p>
        </div>
      </main>
    );
  }

  const mediaDomain = process.env.LIVE_MEDIA_DOMAIN ?? "live.clipshare.link";
  const hlsSrc = `https://${mediaDomain}/live/${stream.viewToken}/index.m3u8`;

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <LiveViewerPanel
        hlsSrc={hlsSrc}
        isLoggedIn={Boolean(session?.user?.id)}
        streamerName={streamerName}
        viewToken={stream.viewToken}
      />
    </main>
  );
}
