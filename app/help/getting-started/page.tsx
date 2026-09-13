import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("getting-started")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function GettingStartedHelpPage() {
  return (
    <HelpDocument
      lead="Clipshareは、ゲームのクリップ動画やスクリーンショットを投稿して共有できるサイトです。閲覧だけならログインは不要ですが、投稿や交流にはアカウントが必要です。このページでは、アカウントを作って最初の投稿を公開するまでの流れを説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="ログインなしでできること">
        <p>
          アカウントを作らなくても、トップページのタイムライン、ゲーム別ページ、タグページ、検索など、公開されている投稿の閲覧はすべて利用できます。画像や動画の共有用URLをその場で発行する
          <Link className="text-primary hover:underline" href="/help/quick-share">
            クイック共有
          </Link>
          も、ログインなしで使えます。
        </p>
        <p>一方で、次の操作にはログインが必要です。</p>
        <ul>
          <li>クリップ動画やスクリーンショットの投稿</li>
          <li>いいね、コメント、返信</li>
          <li>ブックマークによる保存</li>
          <li>他のユーザーのフォロー</li>
          <li>投稿やコメントの通報</li>
          <li>NSFW投稿の閲覧（あわせて年齢確認が必要です）</li>
        </ul>
      </HelpSection>

      <HelpSection index="2" title="3つのログイン方法">
        <p>
          <Link className="text-primary hover:underline" href="/login">
            ログインページ
          </Link>
          では、次の3つの方法から選べます。いずれの方法でもパスワードの設定は不要です。
        </p>
        <ul>
          <li>
            <strong>Discordでログイン</strong>
            ：Discordアカウントで認証します。普段Discordでクリップを共有している方におすすめです。
          </li>
          <li>
            <strong>Xでログイン</strong>
            ：Xアカウントで認証します。
          </li>
          <li>
            <strong>メールリンク</strong>
            ：メールアドレスを入力すると、ログイン用のリンクが記載されたメールが届きます。メール内のリンクを開くとログインが完了します。
          </li>
        </ul>
        <p>
          メールリンクが届かない場合は、迷惑メールフォルダをご確認ください。それでも届かないときは
          <Link className="text-primary hover:underline" href="/contact">
            お問い合わせフォーム
          </Link>
          からご連絡ください。
        </p>
      </HelpSection>

      <HelpSection index="3" title="プロフィールを設定する">
        <p>
          ログイン後、ヘッダー右上のアイコンから
          <strong>プロフィール設定</strong>
          を開くと、次の項目を編集できます。最初に表示名とユーザー名だけでも設定しておくと、投稿したときに誰の投稿かが分かりやすくなります。
        </p>
        <ul>
          <li>
            <strong>表示名</strong>
            ：投稿やコメントに表示される名前です。日本語も使えます。
          </li>
          <li>
            <strong>ユーザー名</strong>
            ：プロフィールページのURL（<code>/users/ユーザー名</code>）に使われます。検索で
            <code>from:ユーザー名</code>
            と指定するときにも使います。
          </li>
          <li>
            <strong>アイコン画像</strong>
            ：投稿一覧やコメント欄に表示されます。
          </li>
          <li>
            <strong>自己紹介・外部リンク</strong>
            ：YouTubeやX、GitHubなどのURLを登録すると、プロフィールページにまとめて表示されます。
          </li>
        </ul>
        <p>
          画面の配色は、ヘッダーのテーマ切り替えボタンからライト／ダーク／端末の設定に合わせる、の3つを選べます。ログインしている場合、選んだテーマはアカウントに保存され、別の端末でも同じ表示になります。
        </p>
      </HelpSection>

      <HelpSection index="4" title="最初の投稿を公開する">
        <p>ヘッダーの「投稿」ボタンから投稿作成画面を開きます。基本的な流れは次のとおりです。</p>
        <ul>
          <li>
            <strong>1. ファイルを選ぶ</strong>
            ：動画か画像かはファイルから自動で判定されます。動画なら
            <Link className="text-primary hover:underline" href="/help/post-clip">
              クリップ動画の投稿
            </Link>
            、画像なら
            <Link className="text-primary hover:underline" href="/help/post-screenshot">
              スクリーンショットの投稿
            </Link>
            を参照してください。
          </li>
          <li>
            <strong>2. 本文を書く</strong>
            ：1行目がタイトル、2行目以降が説明文になります。詳しくは
            <Link className="text-primary hover:underline" href="/help/writing-posts">
              タイトル・説明文・タグの書き方
            </Link>
            をご覧ください。
          </li>
          <li>
            <strong>3. ゲーム名を入れる</strong>
            ：空欄でも本文やファイル名から推定されますが、自分で指定したほうが確実です。
          </li>
          <li>
            <strong>4. 公開設定を確認する</strong>
            ：非公開にしたい場合やNSFWに該当する場合は、チェックを入れてから投稿します。
          </li>
        </ul>
        <p>
          画像はアップロード後すぐに公開されます。動画は変換処理が終わってから公開されるため、投稿直後は「動画を変換中です」と表示されます。
        </p>
      </HelpSection>

      <HelpSection index="5" title="次に読むとよいページ">
        <p>
          投稿の上限が気になる場合は
          <Link className="text-primary hover:underline" href="/help/account-levels">
            アカウントレベルと投稿上限
          </Link>
          、投稿をSNSで共有したい場合は
          <Link className="text-primary hover:underline" href="/help/sharing">
            投稿を共有する
          </Link>
          が参考になります。投稿してよい内容の基準については
          <Link className="text-primary hover:underline" href="/guidelines">
            コミュニティガイドライン
          </Link>
          をご確認ください。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
