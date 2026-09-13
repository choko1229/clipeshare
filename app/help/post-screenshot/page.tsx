import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("post-screenshot")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function PostScreenshotHelpPage() {
  return (
    <HelpDocument
      lead="スクリーンショットは変換処理を待つ必要がなく、アップロードが終わるとすぐに公開されます。このページでは、対応している画像形式、複数枚をまとめて投稿する方法、アップロード前の自動圧縮の挙動、投稿後の表示のされ方を説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="対応している画像形式">
        <p>次の形式の画像ファイルを投稿できます。</p>
        <ul>
          <li>JPEG（.jpg / .jpeg）</li>
          <li>PNG（.png）</li>
          <li>WebP（.webp）</li>
        </ul>
        <p>
          ゲーム機やPCのスクリーンショット機能で保存した画像は、通常JPEGかPNGなのでそのまま投稿できます。1枚あたりのファイルサイズと、1投稿に含められる枚数の上限はアカウントレベルによって変わります。詳しくは
          <Link className="text-primary hover:underline" href="/help/account-levels">
            アカウントレベルと投稿上限
          </Link>
          をご確認ください。
        </p>
      </HelpSection>

      <HelpSection index="2" title="複数枚をまとめて投稿する">
        <p>
          メディアファイルの選択画面では、複数の画像を同時に選べます。まとめて選んだ画像は1つの投稿になり、閲覧時は左右に切り替えられるカルーセル形式で表示されます。
        </p>
        <p>
          同じ場面の連続したシーンや、before／after、集合写真の複数カットなど、セットで見せたい画像は1投稿にまとめると伝わりやすくなります。逆に、関連のない画像を1つの投稿に詰め込むと、タイトルや説明文が書きにくくなるため、内容ごとに投稿を分けたほうが見つけてもらいやすくなります。
        </p>
        <p>
          並び順は選択したときの順番で保存されます。順番を変えたい場合は、投稿の編集画面から画像を選び直してください。
        </p>
      </HelpSection>

      <HelpSection index="3" title="アップロード前の自動圧縮">
        <p>
          高解像度のスクリーンショットは、アップロードの前にブラウザ側で自動的に縮小・圧縮されます。これにより、アップロードにかかる時間と通信量を抑えています。圧縮の進み具合は、投稿ボタンの周辺に進捗として表示されます。
        </p>
        <p>
          そのため、手元のファイルが上限をわずかに超えている場合でも、圧縮後のサイズが上限内に収まれば投稿できます。それでも上限を超える場合はエラーが表示されるので、画像編集ソフトで解像度を下げるか、JPEGとして保存し直してから再度お試しください。
        </p>
      </HelpSection>

      <HelpSection index="4" title="投稿後の見え方">
        <p>
          投稿するとすぐに公開され、トップページのタイムラインやゲーム別ページの一覧に表示されます。一覧のサムネイルには、複数枚の投稿であることが分かるように枚数が表示されます。
        </p>
        <p>
          投稿ページでは、画像の下にタイトルと説明文、タグ、投稿者情報、コメント欄が並びます。SNSやDiscordにURLを貼ったときは、1枚目の画像がプレビューとして表示されます。共有時の見え方については
          <Link className="text-primary hover:underline" href="/help/sharing">
            投稿を共有する
          </Link>
          で詳しく説明しています。
        </p>
      </HelpSection>

      <HelpSection index="5" title="投稿後に画像を差し替える">
        <p>
          自分の投稿ページにある「投稿を編集」から、画像を選び直せます。差し替えると、その投稿の画像はすべて新しく選んだものに置き換わります。1枚だけ追加したい場合も、追加後の全枚数をまとめて選び直す必要があります。
        </p>
        <p>
          差し替え前の画像は公開されなくなり、一定期間後にサーバーから削除されます。タイトルや説明文、タグ、ゲーム名も同じ編集画面から変更できます。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
