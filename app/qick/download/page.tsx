import type { Metadata } from "next";
import { CloudUpload, Glasses, Image as ImageIcon } from "lucide-react";
import { DownloadButtons, ReleaseHistory, TrustSteps } from "@/components/quick-download/download-sections";
import { getDownloadPageData } from "@/lib/quick-client/download-page-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clipshare Quick",
  description: "VRChatで写真を撮ると、Clipshareに自動でアップロードして、共有URLをクリップボードにコピーします。",
};

const steps = [
  { title: "インストール", body: "ダウンロードして起動すると、常駐を始めます。" },
  { title: "Clipshareと連携（任意）", body: "ブラウザで許可すると、バナーなしで制限も緩和されます。" },
  { title: "VRChatで撮影", body: "URLがコピーされます。チャットにそのまま貼り付けられます。" },
];

const features = [
  { icon: CloudUpload, title: "自動アップロード", body: "撮影した写真をそのまま共有URLに。いつでもトレイでON/OFFできます。" },
  { icon: ImageIcon, title: "右クリックで共有", body: "画像も動画も、エクスプローラーから。複数選択なら、URLを改行区切りでまとめてコピーします。" },
  { icon: Glasses, title: "VR内でも安心", body: "アップロードの完了や失敗を、VRの視界にそっとお知らせします。" },
];

export default async function QuickDownloadPage() {
  const data = await getDownloadPageData();
  const os = data.supportedOs;

  const faqs = [
    { question: "写真はどのくらい保存されますか？", answer: `${data.retentionHours}時間で自動的に削除されます。` },
    { question: "誰でも見られますか？", answer: "URLを知っている人だけが見られます。検索やサイト内の一覧には表示されません。" },
    {
      question: "ログインしなくても使えますか？",
      answer: `使えます。未ログインの場合は、画像にバナーが付き、1日${data.anonymousDailyLimit}件までです。`,
    },
    { question: "やめたいときは？", answer: "Windowsの設定からアプリを削除してください。連携は「設定 › 連携アプリ」で解除できます。" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 px-4 pb-14 pt-10">
      <section className="rounded-xl border border-border bg-card px-8 py-12">
        <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full bg-primary/15 px-2 text-xs font-bold text-primary">{os}</span>
        <h1 className="mt-3.5 text-4xl font-extrabold leading-tight">撮るだけで、共有URLに。</h1>
        <p className="mt-3 max-w-[620px] text-base leading-relaxed text-muted-foreground">
          VRChatで写真を撮ると、Clipshareに自動でアップロードして、共有URLをクリップボードにコピーします。エクスプローラーの右クリックからも共有できます。
        </p>
        <DownloadButtons release={data.release} supportedOs={os} />
      </section>

      <h2 className="text-xl font-extrabold leading-snug">はじめかた</h2>
      <div className="flex flex-wrap gap-4">
        {steps.map((step, index) => (
          <div className="flex-[1_1_240px] rounded-md border border-border bg-card p-5" key={step.title}>
            <div className="grid size-7 place-items-center rounded-full bg-primary text-[13px] font-extrabold text-primary-foreground">{index + 1}</div>
            <p className="mt-3 text-[15px] font-extrabold leading-relaxed">{step.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>

      <TrustSteps certFingerprint={data.certFingerprint} />

      <ReleaseHistory history={data.history} />

      <h2 className="text-xl font-extrabold leading-snug">できること</h2>
      <div className="flex flex-wrap gap-4">
        {features.map((feature) => (
          <div className="flex-[1_1_240px] rounded-md border border-border bg-card p-5" key={feature.title}>
            <feature.icon aria-hidden="true" className="text-primary" size={22} strokeWidth={1.8} />
            <p className="mt-2.5 text-[15px] font-extrabold leading-relaxed">{feature.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-extrabold leading-snug">よくある質問</h2>
      <div>
        {faqs.map((faq) => (
          <div className="border-b border-border py-4" key={faq.question}>
            <p className="text-sm font-extrabold leading-relaxed">{faq.question}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{faq.answer}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
