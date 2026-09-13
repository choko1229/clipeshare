import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("visibility-nsfw")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function VisibilityNsfwHelpPage() {
  return (
    <HelpDocument
      lead="投稿するときは、公開範囲とNSFW（年齢制限が必要な内容かどうか）の2つを選べます。この2つは別々の設定で、組み合わせて使えます。このページでは、それぞれの違いと、NSFW投稿を見るために必要な年齢確認の手順を説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="公開と非公開">
        <p>
          投稿作成画面の「非公開で投稿」にチェックを入れると、その投稿は自分だけが見られる状態になります。チェックを入れなければ公開投稿となり、誰でも閲覧できます。
        </p>
        <p>非公開の投稿は、次のようにサイト内のどこにも表示されません。</p>
        <ul>
          <li>トップページのタイムライン、ゲーム別ページ、タグページ</li>
          <li>検索結果</li>
          <li>他の投稿ページに表示される関連投稿</li>
          <li>プロフィールページの投稿一覧（他の人から見た場合）</li>
        </ul>
        <p>
          自分でURLを開いた場合のみ、投稿ページに「非公開」と表示された状態で閲覧できます。公開設定は投稿の編集画面からいつでも切り替えられるので、まず非公開で投稿して内容を整えてから公開する、という使い方もできます。
        </p>
      </HelpSection>

      <HelpSection index="2" title="NSFWとは">
        <p>
          NSFWは、職場や公共の場で開くのに適さない内容を指します。Clipshareでは、性的な表現を含むものや、強い暴力・流血表現を含むものが該当します。該当する投稿は、投稿作成画面の「NSFWとして投稿」にチェックを入れてください。
        </p>
        <p>
          判断に迷う場合は、NSFWを付けたうえで投稿することをおすすめします。NSFWを付けずに投稿された不適切な内容は、他のユーザーからの通報対象になり、管理者の判断で削除されることがあります。そもそも投稿が禁止されている内容については、
          <Link className="text-primary hover:underline" href="/guidelines">
            コミュニティガイドライン
          </Link>
          に基準を定めています。NSFWを付ければ何でも投稿できるわけではない点にご注意ください。
        </p>
      </HelpSection>

      <HelpSection index="3" title="NSFW投稿の見え方">
        <p>NSFWを付けた投稿は、閲覧する人の状態によって表示が変わります。</p>
        <ul>
          <li>
            <strong>ログインしていない</strong>
            ：内容は表示されず、ログインを促す案内が表示されます。
          </li>
          <li>
            <strong>ログイン済みだが年齢未確認</strong>
            ：年齢確認へ進むよう案内が表示されます。
          </li>
          <li>
            <strong>年齢確認済みで18歳以上</strong>
            ：通常どおり閲覧できます。
          </li>
          <li>
            <strong>18歳未満であることが登録されている</strong>
            ：閲覧できません。
          </li>
        </ul>
        <p>
          また、NSFW投稿はトップページや検索結果の通常表示には含まれず、検索で
          <code>nsfw:</code>
          を指定したときだけ対象になります。SNSやDiscordにURLを貼った場合も、サムネイルや本文は表示されず、専用のプレースホルダー画像に置き換わります。検索エンジンにもインデックスされません。
        </p>
      </HelpSection>

      <HelpSection index="4" title="年齢確認の手順">
        <p>
          NSFW投稿を閲覧するには、ログインしたうえで年齢確認が必要です。年齢確認ページで生年月日を入力すると、18歳以上であることが確認され、以降はNSFW投稿を閲覧できるようになります。
        </p>
        <p>
          <strong>生年月日は一度入力すると変更できません。</strong>
          入力内容をよく確認してから登録してください。誤って登録してしまった場合は、
          <Link className="text-primary hover:underline" href="/contact">
            お問い合わせフォーム
          </Link>
          からご連絡ください。
        </p>
        <p>入力された生年月日の取り扱いについては、プライバシーポリシーに記載しています。</p>
      </HelpSection>

      <HelpSection index="5" title="公開範囲とNSFWの組み合わせ">
        <p>
          2つの設定は独立しているため、「公開かつNSFW」「非公開かつNSFW」のように組み合わせられます。非公開にした場合は自分しか見られないため、NSFWの有無にかかわらず他の人には表示されません。
        </p>
        <p>
          投稿後にどちらの設定も変更できます。公開したあとでNSFWに該当すると気づいた場合は、編集画面から設定を変更してください。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
