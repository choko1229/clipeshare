import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("writing-posts")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function WritingPostsHelpPage() {
  return (
    <HelpDocument
      lead="Clipshareの投稿作成画面には、タイトル欄と説明文欄が別々にあるわけではなく、1つの本文欄にまとめて入力します。1行目がタイトル、2行目以降が説明文として保存される仕組みです。このページでは、その書き方と、投稿を見つけてもらいやすくするコツを説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="本文欄の仕組み">
        <p>投稿作成画面の「本文」欄に入力した内容は、次のように分解されて保存されます。</p>
        <ul>
          <li>
            <strong>1行目</strong>
            ：タイトルになります。投稿ページの見出しや、一覧のサムネイルの下に表示されます。
          </li>
          <li>
            <strong>2行目以降</strong>
            ：説明文になります。投稿ページのタイトルの下に表示されます。
          </li>
          <li>
            <strong>本文中の #タグ</strong>
            ：タグとして保存されます。最大10個までです。
          </li>
        </ul>
        <p>入力例は次のようになります。</p>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm leading-7">
          {`ラスト1秒での逆転クラッチ
残り1秒、味方が全員やられた状態から3人抜きできた場面です。
音だけで位置を判断して、裏取りルートから回り込みました。
#クラッチ #エース`}
        </pre>
        <p>
          この場合、「ラスト1秒での逆転クラッチ」がタイトル、その下の2行が説明文、「クラッチ」「エース」がタグとして保存されます。本文全体で4200文字まで入力できます。
        </p>
      </HelpSection>

      <HelpSection index="2" title="タイトルの付け方">
        <p>
          タイトルは、一覧画面で最初に目に入る部分です。「草」「やばい」のような一言だけでも投稿はできますが、それだけでは一覧に並んだときに他の投稿と区別がつかず、内容も伝わりません。何が起きた場面なのかが分かる言葉を入れると、クリックされやすくなります。
        </p>
        <ul>
          <li>内容が伝わりにくい例：「草」「神プレイ」「見て」</li>
          <li>伝わりやすい例：「残り1秒で逆転クラッチ」「初めてのソロ3人抜き」「味方のミスで全滅した瞬間」</li>
        </ul>
        <p>
          同じタイトルの投稿をいくつも作ると、見る側にとっても自分にとっても区別がつかなくなります。連続した場面を投稿するときは「その1」「その2」のように番号を付けるより、それぞれの場面を表す言葉を入れたほうが探しやすくなります。
        </p>
      </HelpSection>

      <HelpSection index="3" title="説明文に書くとよいこと">
        <p>
          説明文は任意ですが、書いておくと投稿の価値が大きく変わります。動画や画像だけでは伝わらない前後の文脈を補えるうえ、検索やSNSからこの投稿に辿り着く人が増えます。次のような内容がよく書かれます。
        </p>
        <ul>
          <li>その場面に至るまでの状況（残り時間、人数差、ラウンド数など）</li>
          <li>自分が何を狙って、どう操作したか</li>
          <li>使用したキャラクター、武器、装備、構成</li>
          <li>一緒にプレイしていた人や、配信・イベントの情報</li>
          <li>見どころの秒数（「0:12あたりから」など）</li>
          <li>うまくいかなかった点や、反省していること</li>
        </ul>
        <p>
          数行でも十分です。短くても、その投稿にしかない情報が書かれていれば、あとから自分で見返したときにも役立ちます。
        </p>
      </HelpSection>

      <HelpSection index="4" title="タグの付け方">
        <p>
          本文の中に半角の <code>#</code> に続けて言葉を書くと、タグとして保存されます。1投稿につき最大10個までです。タグはそれぞれタグページを持っていて、同じタグが付いた投稿を一覧で見られます。
        </p>
        <p>
          タグには、ゲーム名そのものよりも、ゲーム名だけでは表せない切り口を入れると効果的です。ゲーム名は別の欄で指定するため、タグで重ねて指定する必要はありません。
        </p>
        <ul>
          <li>プレイ内容：<code>#クラッチ</code> <code>#エース</code> <code>#ファインプレー</code></li>
          <li>雰囲気：<code>#ハプニング</code> <code>#バグ</code> <code>#笑える</code></li>
          <li>撮影対象：<code>#風景</code> <code>#集合写真</code> <code>#アバター</code></li>
          <li>使用キャラクターや武器の名前</li>
        </ul>
        <p>
          すでによく使われているタグを選ぶと、そのタグページ経由で見てもらえる可能性が高まります。ゲーム別ページの「よく使われるタグ」欄で、そのゲームでどんなタグが使われているかを確認できます。
        </p>
      </HelpSection>

      <HelpSection index="5" title="投稿したあとでも修正できる">
        <p>
          タイトルも説明文もタグも、投稿後に編集画面から変更できます。まず投稿しておいて、あとから説明文を書き足しても構いません。
        </p>
        <p>
          ゲームやランク帯などの付随情報を追加すると、投稿がさらに探しやすくなります。詳しくは
          <Link className="text-primary hover:underline" href="/help/game-info">
            ゲーム・ランク・カスタム項目を設定する
          </Link>
          をご覧ください。書いた内容がどのように検索されるかは
          <Link className="text-primary hover:underline" href="/help/search">
            検索と絞り込みの使い方
          </Link>
          で説明しています。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
