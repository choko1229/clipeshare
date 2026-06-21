import Link from "next/link";
import { Camera, Clapperboard, Heart, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const sortTabs = ["新着", "人気", "再生数", "いいね", "コメント", "週間", "月間"];

const mockPosts = [
  {
    title: "1v4 clutch on sunset",
    game: "Valorant",
    type: "CLIP",
    accent: "from-emerald-400 to-cyan-400",
  },
  {
    title: "夜明けのスクリーンショット",
    game: "Final Fantasy XIV",
    type: "SCREENSHOT",
    accent: "from-fuchsia-400 to-rose-400",
  },
  {
    title: "ranked final zone",
    game: "Apex Legends",
    type: "CLIP",
    accent: "from-amber-300 to-lime-300",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">ゲームクリップのタイムライン</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                クリップ動画とスクリーンショットを投稿、検索、共有できるメディア中心のフィードです。
              </p>
            </div>
            <Button asChild>
              <Link href="/posts/new">投稿する</Link>
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {sortTabs.map((tab, index) => (
              <button
                className={[
                  "h-10 shrink-0 rounded-md border px-4 text-sm font-medium transition",
                  index === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground",
                ].join(" ")}
                key={tab}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockPosts.map((post) => (
              <article className="overflow-hidden rounded-md border border-border bg-card" key={post.title}>
                <div className={`aspect-video bg-gradient-to-br ${post.accent} p-3`}>
                  <div className="flex h-full items-start justify-between">
                    <span className="rounded bg-black/40 px-2 py-1 text-xs font-bold text-white">{post.type}</span>
                    {post.type === "CLIP" ? (
                      <Clapperboard className="text-black/50" size={28} />
                    ) : (
                      <Camera className="text-black/50" size={28} />
                    )}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-primary">{post.game}</p>
                    <h2 className="mt-1 line-clamp-2 text-base font-semibold">{post.title}</h2>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Heart size={16} /> 0
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={16} /> 0
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search size={18} />
              検索演算子
            </div>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p><code>game:Valorant</code></p>
              <p><code>tag:ace</code></p>
              <p><code>from:username</code></p>
              <p><code>type:clip</code></p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">MVP進行中</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              現在は基盤構築フェーズです。次に認証、DB、投稿機能を順番に実装します。
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
