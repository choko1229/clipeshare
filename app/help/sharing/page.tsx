import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("sharing")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function SharingHelpPage() {
  return (
    <HelpDocument
      lead="投稿ページには共有パネルがあり、URLのコピーからSNSへの投稿、外部サイトへの埋め込みまで、用途に応じた形式で共有できます。このページでは、各ボタンの使い分けと、DiscordやXに貼ったときの見え方を説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="共有パネルの使い分け">
        <p>
          投稿ページの共有パネル（パソコンでは右側、スマートフォンでは投稿の下）には、次のボタンが並びます。
        </p>
        <ul>
          <li>
            <strong>URLコピー</strong>
            ：投稿ページのURLをコピーします。どこに貼る場合でも基本はこれで十分です。
          </li>
          <li>
            <strong>Xで共有</strong>
            ：Xの投稿画面を開き、タイトルとURLが入力された状態にします。
          </li>
          <li>
            <strong>X投稿文コピー</strong>
            ：タイトルとURLを改行で繋いだテキストをコピーします。文章を自分で整えてから投稿したいときに使います。
          </li>
          <li>
            <strong>Discord用URLコピー</strong>
            ：Discordに貼る用のURLをコピーします。貼り付けるとプレビュー付きで表示されます。
          </li>
          <li>
            <strong>埋め込みコードコピー</strong>
            ：自分のブログやサイトに貼り付けるためのHTMLをコピーします。
          </li>
          <li>
            <strong>X用MP4ダウンロード</strong>
            ：クリップ動画の投稿でのみ表示されます。動画ファイルをそのまま保存できます。
          </li>
        </ul>
      </HelpSection>

      <HelpSection index="2" title="Discordに貼ったときの見え方">
        <p>
          投稿のURLをDiscordのチャットに貼ると、タイトル、説明文、サムネイル画像を含むプレビューが自動的に表示されます。クリップ動画の投稿では、Discord上でそのまま再生できる形式で表示されます。
        </p>
        <p>
          プレビューに表示されるのはタイトルと説明文の冒頭部分です。説明文を書いておくと、リンクを貼っただけで内容が伝わるようになります。
        </p>
        <p>
          プレビューが表示されない場合、Discord側が以前の情報を保持していることがあります。投稿のタイトルを変更した直後などは、反映までに時間がかかる場合があります。
        </p>
      </HelpSection>

      <HelpSection index="3" title="Xに貼ったときの見え方">
        <p>
          Xに投稿のURLを貼ると、スクリーンショットの投稿では大きな画像付きのカード、クリップ動画の投稿ではプレイヤー付きのカードとして表示されます。
        </p>
        <p>
          X上で動画を確実に再生させたい場合や、カードではなく動画そのものとして投稿したい場合は、
          <strong>X用MP4ダウンロード</strong>
          から動画ファイルを保存し、Xの投稿画面にファイルとして添付する方法もあります。この場合はURLのプレビューではなく、通常の動画投稿として扱われます。投稿文にClipshareのURLを併記しておくと、元の投稿にも辿ってもらえます。
        </p>
      </HelpSection>

      <HelpSection index="4" title="外部サイトに埋め込む">
        <p>
          <strong>埋め込みコードコピー</strong>
          を押すと、次のような <code>iframe</code> のHTMLがコピーされます。これを自分のブログやサイトのHTMLに貼り付けると、そのページ上で投稿を再生できます。
        </p>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm leading-7">
          {`<iframe src="https://clipshare.link/embed/c/xxxxxxxx" title="投稿のタイトル" width="640" height="360" loading="lazy" allowfullscreen></iframe>`}
        </pre>
        <p>
          幅と高さは貼り付け先に合わせて変更できます。共有パネルの下部にある入力欄にも同じコードが表示されているので、そこから直接コピーすることもできます。
        </p>
        <p>
          また、投稿ページはoEmbedに対応しています。oEmbedに対応したサービスやCMSであれば、投稿のURLを貼り付けるだけで自動的に埋め込み表示に変換されます。
        </p>
      </HelpSection>

      <HelpSection index="5" title="共有できない投稿">
        <p>
          非公開に設定した投稿は、URLを共有しても他の人は閲覧できません。共有する前に、投稿が公開状態になっているかを確認してください。
        </p>
        <p>
          NSFWを付けた投稿は、URLを貼ってもプレビューに内容が表示されず、閲覧にはログインと年齢確認が必要です。詳しくは
          <Link className="text-primary hover:underline" href="/help/visibility-nsfw">
            公開設定・NSFW・年齢確認
          </Link>
          をご覧ください。
        </p>
        <p>
          変換中のクリップ動画は、変換が終わるまで再生できません。共有は変換完了後に行ってください。変換の流れは
          <Link className="text-primary hover:underline" href="/help/post-clip">
            クリップ動画を投稿する
          </Link>
          で説明しています。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
