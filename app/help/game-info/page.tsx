import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("game-info")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function GameInfoHelpPage() {
  return (
    <HelpDocument
      lead="投稿にはタイトルや説明文のほかに、ゲーム名、ランク帯、Discordサーバー名といった付随情報を付けられます。これらは投稿を分類して探しやすくするための情報で、検索の絞り込みにも使われます。このページでは、それぞれの意味と使い分けを説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="ゲームを紐づけると何が起きるか">
        <p>
          投稿にゲームを紐づけると、そのゲームの専用ページに投稿が集約されます。ゲーム別ページには次の情報がまとまっていて、同じゲームをプレイしている人に見つけてもらいやすくなります。
        </p>
        <ul>
          <li>ゲームの概要、ジャンル、対応プラットフォーム、発売日</li>
          <li>今週のトップ投稿、人気投稿、最近の投稿</li>
          <li>そのゲームでよく使われているタグ</li>
          <li>そのゲームに投稿しているユーザーの一覧</li>
        </ul>
        <p>
          また、投稿ページの下部に表示される「同じゲームの新着クリップ」にも並ぶようになり、投稿同士が相互に辿れるようになります。
        </p>
      </HelpSection>

      <HelpSection index="2" title="ゲーム名の入力と自動推定">
        <p>
          投稿作成画面の「ゲーム名」欄には、入力候補が表示されます。すでにサイト内にあるゲームは候補から選ぶと、表記ゆれなく紐づけられます。
        </p>
        <p>
          この欄を空欄のまま投稿した場合は、本文やタグ、アップロードしたファイル名からゲームが推定されます。ただし推定が常に正しいとは限らないため、確実に紐づけたいときは自分で入力してください。
        </p>
        <p>
          候補に出てこないゲームでも、名前を入力すれば投稿できます。意図しないゲームに紐づいてしまった場合は、投稿の編集画面からゲーム名を修正できます。
        </p>
      </HelpSection>

      <HelpSection index="3" title="ランク帯">
        <p>
          対戦ゲームのクリップでは、どのランク帯での出来事かによって見え方が変わります。ランク帯を入力しておくと、投稿ページの情報欄に表示され、検索で
          <code>rank:</code> を使った絞り込みの対象になります。
        </p>
        <p>
          「ゴールド」「Diamond」「レート2000」のように、そのゲームで使われている呼び方をそのまま入力して構いません。同じ表記を続けて使うと、あとから自分の投稿をランク別に振り返るときにも便利です。
        </p>
      </HelpSection>

      <HelpSection index="4" title="Discordサーバー名">
        <p>
          コミュニティやフレンドと一緒にプレイした場面では、どのDiscordサーバーのメンバーと遊んでいたかを記録できます。入力した内容は投稿ページの情報欄に表示され、検索で
          <code>server:</code> を使って絞り込めます。
        </p>
        <p>
          同じサーバーのメンバーが同じ名前を入力しておくと、そのコミュニティの投稿だけをまとめて見返せるようになります。なお、ここに入力した内容は投稿ページで公開されます。外部に知られたくないサーバー名は入力しないでください。
        </p>
      </HelpSection>

      <HelpSection index="5" title="ゲームごとのカスタム項目と自由メモ">
        <p>
          ゲームによっては、そのゲーム専用の入力項目が用意されていることがあります。これは管理者がゲームごとに設定するもので、項目がある場合は投稿の編集画面に表示されます。入力した内容は投稿ページの情報欄に、項目名とセットで表示されます。
        </p>
        <p>
          決まった項目に当てはまらない情報は、自由メモに書けます。使用した設定やデバイス、一緒にプレイした人の名前など、説明文とは分けて残しておきたい補足に向いています。
        </p>
        <p>
          いずれも入力がない場合は、その欄自体が投稿ページに表示されません。埋められる項目だけ埋めておけば十分です。
        </p>
      </HelpSection>

      <HelpSection index="6" title="入力した情報は検索で使える">
        <p>
          ここで入力した情報は、そのまま検索の絞り込み条件になります。たとえば
          <code>game:&quot;Apex Legends&quot; rank:Diamond</code>
          と検索すると、Apex Legendsに紐づく投稿のうちランク帯にDiamondを含むものだけを表示できます。
        </p>
        <p>
          演算子の一覧と組み合わせ方は
          <Link className="text-primary hover:underline" href="/help/search">
            検索と絞り込みの使い方
          </Link>
          にまとめています。タイトルや説明文の書き方については
          <Link className="text-primary hover:underline" href="/help/writing-posts">
            タイトル・説明文・タグの書き方
          </Link>
          をご覧ください。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
