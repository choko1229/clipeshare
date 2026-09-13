import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";
import { getQuickShareSettings } from "@/lib/quick-share/settings";
import { formatBytes } from "@/lib/uploads/account-limits";

export const dynamic = "force-dynamic";

const page = getHelpPage("quick-share")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default async function QuickShareHelpPage() {
  const settings = await getQuickShareSettings();

  return (
    <HelpDocument
      lead="クイック共有は、ログインなしで画像や動画をアップロードし、共有用のURLをその場で発行できる機能です。一定時間で自動的に削除されるため、チャットに一時的に画像を渡したいときに向いています。このページでは使い方と、通常の投稿との違いを説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="クイック共有とは">
        <p>
          ヘッダーの「クイック共有」から開ける機能です。ファイルを1つ選ぶだけで自動的にアップロードが始まり、共有用のURLが発行されます。アカウント登録もログインも必要ありません。
        </p>
        <p>
          発行されたURLを開くと、アップロードした画像や動画が表示されます。DiscordやチャットアプリにそのURLを貼れば、相手はログインなしで内容を見られます。
        </p>
      </HelpSection>

      <HelpSection index="2" title="使い方">
        <ul>
          <li>
            <strong>1. クイック共有の画面を開く</strong>
            ：ヘッダーの「クイック共有」ボタンから移動します。
          </li>
          <li>
            <strong>2. ファイルを選ぶ</strong>
            ：画像または動画を1つ選びます。選んだ時点で自動的にアップロードが始まります。
          </li>
          <li>
            <strong>3. URLをコピーする</strong>
            ：アップロードが完了すると共有用URLが表示されるので、コピーして貼り付けてください。
          </li>
        </ul>
        <p>
          大きな画像はアップロード前に自動で圧縮され、進み具合が画面に表示されます。動画の場合は、共有用の形式に変換されてから表示できるようになります。
        </p>
      </HelpSection>

      <HelpSection index="3" title="上限と保存期限">
        <p>現在の設定は次のとおりです。</p>
        <ul>
          <li>
            <strong>画像の上限</strong>：1ファイルあたり{formatBytes(settings.maxImageBytes)}まで
          </li>
          <li>
            <strong>動画の上限</strong>：1ファイルあたり{formatBytes(settings.maxVideoBytes)}まで
          </li>
          <li>
            <strong>保存期限</strong>：アップロードから{settings.retentionHours}時間
          </li>
          <li>
            <strong>ログインなしの場合の発行数</strong>：1日あたり{settings.anonymousDailyLimit}件まで
          </li>
        </ul>
        <p>
          保存期限を過ぎたメディアは自動的に削除され、URLを開いても「有効期限切れです」と表示されるようになります。
          <strong>あとから見返したいファイルには使わないでください。</strong>
          長く残しておきたいものは、通常の投稿として公開するか、非公開の投稿として保存することをおすすめします。
        </p>
      </HelpSection>

      <HelpSection index="4" title="発行したURLの管理と削除">
        <p>
          クイック共有の画面には、自分が発行したメディアの一覧が表示されます。一覧のサムネイルからは共有ページを開けるので、あとからURLをコピーし直すこともできます。
        </p>
        <p>
          保存期限より前に消したい場合は、共有ページまたは一覧から削除できます。削除するとURLは無効になり、それ以降は開けなくなります。
        </p>
        <p>
          ログインせずに発行した場合、発行したのが自分であるという情報はブラウザ側に保存されます。そのため、別の端末やブラウザ、シークレットウィンドウからは一覧に表示されず、削除操作もできません。ブラウザのデータを消去した場合も同様です。
        </p>
      </HelpSection>

      <HelpSection index="5" title="ログインするとどう変わるか">
        <p>
          ログインした状態でクイック共有を使うと、発行したメディアがアカウントに紐づきます。別の端末でログインしても同じ一覧が表示され、削除操作もできます。
        </p>
        <p>
          ログインなしで発行したメディアも、同じブラウザでそのままログインすれば、アカウントに紐づけて引き続き管理できます。
        </p>
      </HelpSection>

      <HelpSection index="6" title="通常の投稿との使い分け">
        <p>次のように使い分けると分かりやすくなります。</p>
        <ul>
          <li>
            <strong>クイック共有が向いている場合</strong>
            ：一時的にチャットへ画像を渡したいとき、期限が来たら消えてほしいとき、ログインせずにすぐ共有したいとき。
          </li>
          <li>
            <strong>通常の投稿が向いている場合</strong>
            ：あとから見返したいとき、ゲームやタグで整理したいとき、いいねやコメントをもらいたいとき、検索から見つけてもらいたいとき。
          </li>
        </ul>
        <p>
          クイック共有のページは検索エンジンにインデックスされず、サイト内の一覧や検索結果にも表示されません。URLを知っている人だけが見られる状態になります。ただし、URLを受け取った人が他の場所へ転載することは防げないため、他人に見られて困る内容のアップロードは避けてください。
        </p>
        <p>
          通常の投稿の作り方は
          <Link className="text-primary hover:underline" href="/help/getting-started">
            はじめかた
          </Link>
          をご覧ください。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
