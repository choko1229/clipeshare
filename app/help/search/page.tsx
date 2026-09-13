import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("search")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

const operators = [
  {
    operator: "game:",
    description: "ゲーム名で絞り込みます。",
    example: "game:Valorant",
  },
  {
    operator: "tag:",
    description: "タグで絞り込みます。先頭の # は付けても付けなくても構いません。",
    example: "tag:ace",
  },
  {
    operator: "from:",
    description: "投稿者のユーザー名で絞り込みます。先頭の @ は省略できます。",
    example: "from:username",
  },
  {
    operator: "type:",
    description: "投稿の種類で絞り込みます。クリップ動画かスクリーンショットかを指定します。",
    example: "type:clip",
  },
  {
    operator: "rank:",
    description: "投稿に登録されたランク帯で絞り込みます。",
    example: "rank:Diamond",
  },
  {
    operator: "server:",
    description: "投稿に登録されたDiscordサーバー名で絞り込みます。",
    example: "server:サーバー名",
  },
  {
    operator: "nsfw:",
    description: "NSFW投稿の扱いを変えます。指定しない場合はNSFW投稿を除外します。",
    example: "nsfw:all",
  },
];

export default function SearchHelpPage() {
  return (
    <HelpDocument
      lead="検索ページでは、キーワードに加えて7種類の検索演算子を使って投稿を絞り込めます。演算子はキーワードと組み合わせたり、複数を並べたりできます。このページでは、それぞれの書き方と、目的の投稿に辿り着くための探し方を説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="キーワードで探す">
        <p>
          ヘッダーの検索窓に言葉を入力すると、その言葉を含む投稿を探せます。検索結果は新着順で表示されます。タイトルや説明文に書かれている言葉が対象になるため、投稿時に説明文を書いておくと、あとから自分でも見つけやすくなります。
        </p>
        <p>
          検索結果の上部には「すべて」「クリップ」「スクリーンショット」の切り替えと、投稿が多いゲームのボタンが並びます。演算子を覚えていなくても、ここから絞り込めます。
        </p>
      </HelpSection>

      <HelpSection index="2" title="検索演算子の一覧">
        <p>
          <code>演算子:値</code>
          の形式で入力すると、その条件で絞り込めます。演算子は大文字と小文字を区別しません。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pr-4 font-semibold">演算子</th>
                <th className="py-3 pr-4 font-semibold">説明</th>
                <th className="py-3 font-semibold">入力例</th>
              </tr>
            </thead>
            <tbody>
              {operators.map((item) => (
                <tr className="border-b border-border/60" key={item.operator}>
                  <td className="py-3 pr-4 align-top">
                    <code>{item.operator}</code>
                  </td>
                  <td className="py-3 pr-4 align-top leading-7">{item.description}</td>
                  <td className="py-3 align-top">
                    <code>{item.example}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HelpSection>

      <HelpSection index="3" title="値の書き方">
        <p>
          <strong>スペースを含む値</strong>
          は、ダブルクォートで囲みます。囲まないと、スペース以降がキーワードとして扱われます。
        </p>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm leading-7">
          {`game:"Apex Legends"`}
        </pre>
        <p>
          <code>type:</code>
          には複数の書き方があります。クリップ動画は <code>clip</code>、<code>video</code>、<code>movie</code>
          のいずれでも指定できます。スクリーンショットは <code>screenshot</code>、<code>ss</code>、<code>image</code>、
          <code>photo</code> のいずれでも指定できます。
        </p>
        <p>
          <code>nsfw:</code> は指定する値で挙動が変わります。
        </p>
        <ul>
          <li>
            <strong>指定しない</strong>：NSFW投稿を除外します（初期状態）。
          </li>
          <li>
            <code>nsfw:only</code>（<code>true</code>、<code>1</code>、<code>yes</code> も同じ）：NSFW投稿だけを表示します。
          </li>
          <li>
            <code>nsfw:all</code>（<code>any</code>、<code>both</code> も同じ）：NSFW投稿を含めて表示します。
          </li>
        </ul>
        <p>NSFW投稿を表示するには、ログインと年齢確認が必要です。</p>
      </HelpSection>

      <HelpSection index="4" title="組み合わせて絞り込む">
        <p>演算子はスペースで区切って複数並べられます。キーワードと混ぜて書くこともできます。</p>
        <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 text-sm leading-7">
          {`game:"Apex Legends" rank:Diamond type:clip
クラッチ from:username
tag:集合写真 game:VRChat`}
        </pre>
        <p>
          1行目は、Apex Legendsのクリップ動画のうちランク帯にDiamondを含むもの。2行目は、指定したユーザーの投稿のうち「クラッチ」を含むもの。3行目は、VRChatに紐づく投稿のうち「集合写真」タグが付いたものを表示します。
        </p>
        <p>
          <code>rank:</code> と <code>server:</code>
          は、投稿時にその情報が入力されている投稿だけが対象になります。入力方法は
          <Link className="text-primary hover:underline" href="/help/game-info">
            ゲーム・ランク・カスタム項目を設定する
          </Link>
          をご覧ください。
        </p>
      </HelpSection>

      <HelpSection index="5" title="一覧ページから辿る">
        <p>検索以外にも、目的の投稿に辿り着く方法があります。</p>
        <ul>
          <li>
            <strong>ゲーム別ページ</strong>
            ：投稿ページやサムネイルに表示されているゲーム名をクリックすると移動します。今週のトップ、人気投稿、最近の投稿、よく使われるタグがまとまっています。
          </li>
          <li>
            <strong>タグページ</strong>
            ：投稿ページのタグをクリックすると、同じタグが付いた投稿の一覧が開きます。
          </li>
          <li>
            <strong>プロフィールページ</strong>
            ：投稿者名をクリックすると、そのユーザーの投稿一覧が開きます。
          </li>
          <li>
            <strong>関連投稿</strong>
            ：投稿ページの下部に、同じゲームの新着投稿と、同じ投稿者の他の投稿が表示されます。
          </li>
        </ul>
      </HelpSection>

      <HelpSection index="6" title="並び替えと、あとで見返す方法">
        <p>
          トップページのタイムラインでは、新着・人気・再生数・いいね・コメント・週間・月間の並び替えを切り替えられます。最近盛り上がっている投稿を見たいときは「週間」、定番の投稿を探したいときは「人気」が便利です。
        </p>
        <p>
          気になった投稿はブックマークに保存しておくと、あとからブックマーク一覧でまとめて見返せます。特定の投稿者を継続して追いたい場合はフォローすると、フォロー中のユーザーの投稿だけを一覧で確認できます。どちらもログインが必要です。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
