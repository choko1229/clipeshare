import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type ClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getPublicPost(publicId: string) {
  return prisma.post.findFirst({
    where: {
      publicId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
    include: {
      game: true,
      tags: {
        include: {
          tag: true,
        },
      },
      user: true,
    },
  });
}

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const post = await getPublicPost(id);
    if (!post) {
      return {
        title: "投稿が見つかりません",
      };
    }

    const title = post.title;
    const description = post.description.slice(0, 160);
    const image = post.isNsfw ? "/images/nsfw-placeholder.svg" : post.thumbnailUrl;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        url: `/c/${post.publicId}`,
        images: [
          {
            url: image,
            width: 1280,
            height: 720,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return {
      title: `Clip ${id}`,
      description: "Clipeshareの投稿詳細ページです。",
    };
  }
}

export default async function ClipDetailPage({ params }: ClipPageProps) {
  const { id } = await params;
  const post = await getPublicPost(id);

  if (!post) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-card">
        {post.mediaUrl ? (
          <Image
            alt={post.title}
            className={post.isNsfw ? "object-contain blur-xl" : "object-contain"}
            fill
            priority
            src={post.mediaUrl}
          />
        ) : null}
        {post.isNsfw ? (
          <div className="absolute inset-0 grid place-items-center bg-background/70">
            <span className="rounded-md bg-card px-4 py-2 text-sm font-semibold">NSFW</span>
          </div>
        ) : null}
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-sm font-medium text-primary">{post.game.name}</p>
          <h1 className="mt-2 text-3xl font-bold">{post.title}</h1>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{post.description}</p>

          {post.tags.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {post.tags.map(({ tag }) => (
                <span className="rounded-md border border-border bg-muted px-3 py-1 text-sm" key={tag.id}>
                  #{tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-md border border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">投稿者</p>
            <p className="mt-1 font-semibold">{post.user.displayName ?? post.user.name ?? post.user.email ?? "Unknown"}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-background p-3">
              <Eye className="mx-auto mb-1" size={18} />
              {Number(post.viewCount)}
            </div>
            <div className="rounded-md bg-background p-3">
              <Heart className="mx-auto mb-1" size={18} />
              {Number(post.likeCount)}
            </div>
            <div className="rounded-md bg-background p-3">
              <MessageCircle className="mx-auto mb-1" size={18} />
              {Number(post.commentCount)}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
