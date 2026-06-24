import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HlsPlayer } from "@/components/media/hls-player";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type EmbedClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getEmbeddablePost(publicId: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isNsfw: false,
    },
    include: {
      game: true,
    },
  });
}

export async function generateMetadata({ params }: EmbedClipPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getEmbeddablePost(id);

  if (!post) {
    return {
      title: "Clipeshare embed",
    };
  }

  return {
    title: post.title,
    description: post.description.slice(0, 160),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function EmbedClipPage({ params }: EmbedClipPageProps) {
  const { id } = await params;
  const post = await getEmbeddablePost(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="fixed inset-0 z-50 bg-black text-white">
      <div className="relative h-full w-full">
        {post.type === "CLIP" && post.mediaUrl ? (
          <HlsPlayer poster={post.thumbnailUrl} src={post.mediaUrl} title={post.title} />
        ) : post.mediaUrl ? (
          <Image alt={post.title} className="object-contain" fill priority src={post.mediaUrl} />
        ) : (
          <div className="grid h-full place-items-center p-4 text-center">
            <p className="text-sm text-white/70">Media is not ready.</p>
          </div>
        )}
      </div>
    </main>
  );
}
