import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { prisma } from "@/lib/db/prisma";
import { getHelpPage } from "@/lib/help/pages";
import { formatBytes } from "@/lib/uploads/account-limits";

export const dynamic = "force-dynamic";

const page = getHelpPage("account-levels")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

function formatPromotionRule(level: {
  isDefault: boolean;
  minAccountAgeDays: number;
  minFollowerCount: number;
  minPostCount: number;
}) {
  if (level.isDefault) {
    return "登録直後の初期レベル";
  }

  const conditions: string[] = [];
  if (level.minPostCount > 0) {
    conditions.push(`投稿${level.minPostCount}件以上`);
  }
  if (level.minAccountAgeDays > 0) {
    conditions.push(`登録から${level.minAccountAgeDays}日以上`);
  }
  if (level.minFollowerCount > 0) {
    conditions.push(`フォロワー${level.minFollowerCount}人以上`);
  }

  return conditions.length > 0 ? conditions.join(" / ") : "条件なし";
}

export default async function AccountLevelsHelpPage() {
  // 運営が個別に付与するレベル(管理用・制限用)は利用者が到達できないため公開しない。
  const levels = await prisma.accountLevel.findMany({
    where: {
      isManualOnly: false,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <HelpDocument
      lead="1回の投稿でアップロードできる動画の長さやファイルサイズ、画像の枚数、1日に投稿できる件数は、アカウントレベルごとに決まっています。レベルは利用状況に応じて自動的に上がります。このページでは、現在設定されている上限と昇格条件を確認できます。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="アカウントレベルとは">
        <p>
          アカウントレベルは、投稿できるメディアの上限をまとめた区分です。すべてのユーザーは登録直後に初期レベルから始まり、投稿数や登録からの経過日数などの条件を満たすと、自動的に上のレベルへ切り替わります。
        </p>
        <p>
          レベルが上がると、より長い動画やサイズの大きいファイル、より多くの画像を1つの投稿に含められるようになります。レベルが下がることはありません。
        </p>
      </HelpSection>

      <HelpSection index="2" title="現在のレベルと上限">
        {levels.length > 0 ? (
          <>
            <p>現在サイトに設定されているレベルと上限は次のとおりです。</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-4 font-semibold">レベル</th>
                    <th className="py-3 pr-4 font-semibold">動画の長さ</th>
                    <th className="py-3 pr-4 font-semibold">動画サイズ</th>
                    <th className="py-3 pr-4 font-semibold">画像サイズ</th>
                    <th className="py-3 pr-4 font-semibold">画像枚数</th>
                    <th className="py-3 pr-4 font-semibold">1日の投稿数</th>
                    <th className="py-3 font-semibold">到達条件</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level) => (
                    <tr className="border-b border-border/60" key={level.id}>
                      <td className="py-3 pr-4">
                        <span className="font-semibold" style={{ color: level.levelColor }}>
                          {level.name}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{level.maxVideoSeconds}秒</td>
                      <td className="py-3 pr-4">{formatBytes(Number(level.maxVideoSizeBytes))}</td>
                      <td className="py-3 pr-4">{formatBytes(Number(level.maxImageSizeBytes))}</td>
                      <td className="py-3 pr-4">{level.maxImagesPerPost}枚</td>
                      <td className="py-3 pr-4">
                        {level.dailyUploadLimit === null ? "無制限" : `${level.dailyUploadLimit}件`}
                      </td>
                      <td className="py-3">{formatPromotionRule(level)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              この表はサイトの設定を直接読み込んで表示しているため、上限が変更された場合は自動的に反映されます。なお、上記のほかに運営が個別に付与するレベルがあり、これらは条件を満たしても自動では切り替わりません。
            </p>
          </>
        ) : (
          <p>
            現在、レベルの設定情報を読み込めませんでした。自分に適用されている上限は、投稿作成画面の上部に表示されるので、そちらをご確認ください。
          </p>
        )}
      </HelpSection>

      <HelpSection index="3" title="自分のレベルを確認する">
        <p>
          投稿作成画面を開くと、上部に現在のレベル名と、そのレベルで許可されている上限が表示されます。動画の長さ、動画と画像のファイルサイズ、1投稿あたりの画像枚数、1日の投稿数がまとめて確認できます。
        </p>
        <p>レベルの判定は投稿作成画面を開いたときに更新されるため、条件を満たしていれば、その時点で新しいレベルが反映されます。</p>
      </HelpSection>

      <HelpSection index="4" title="上限を超えたときの表示">
        <p>上限を超えるファイルを投稿しようとすると、投稿は保存されずエラーメッセージが表示されます。よくあるケースと対処方法は次のとおりです。</p>
        <ul>
          <li>
            <strong>動画が長すぎる</strong>
            ：投稿画面の動画クリッピングで開始秒と終了秒を指定し、見どころだけを切り出してください。手順は
            <Link className="text-primary hover:underline" href="/help/post-clip">
              クリップ動画を投稿する
            </Link>
            で説明しています。
          </li>
          <li>
            <strong>動画のファイルサイズが大きすぎる</strong>
            ：録画時の画質やビットレートを下げて録り直すか、編集ソフトで書き出し直してください。
          </li>
          <li>
            <strong>画像のファイルサイズが大きすぎる</strong>
            ：アップロード前に自動で圧縮されますが、それでも超える場合は解像度を下げるかJPEGで保存し直してください。
          </li>
          <li>
            <strong>1日の投稿上限に達した</strong>
            ：「本日の投稿上限に達しています。」と表示されます。日付が変わると再び投稿できます。
          </li>
        </ul>
      </HelpSection>

      <HelpSection index="5" title="レベルが上がらないときは">
        <p>
          条件を満たしているはずなのにレベルが変わらない場合は、一度投稿作成画面を開き直してください。レベルの判定はそのタイミングで行われます。
        </p>
        <p>
          それでもレベルが反映されない場合は、
          <Link className="text-primary hover:underline" href="/contact">
            お問い合わせフォーム
          </Link>
          からユーザー名を添えてご連絡ください。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
