import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ClipPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: ClipPageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `Clip ${id}`,
    description: "Clipeshareの投稿詳細ページです。",
    openGraph: {
      title: `Clip ${id}`,
      description: "Clipeshareの投稿詳細ページです。",
      url: `/c/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `Clip ${id}`,
      description: "Clipeshareの投稿詳細ページです。",
    },
  };
}

export default async function ClipDetailPage({ params }: ClipPageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="aspect-video rounded-md border border-border bg-card" />
      <h1 className="mt-5 text-3xl font-bold">Clip {id}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        投稿詳細とOGPは投稿DB接続フェーズで実データに切り替えます。
      </p>
    </main>
  );
}
