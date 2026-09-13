import type { Metadata } from "next";
import { LegalArticle, LegalDocument } from "@/components/legal/legal-document";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clipshareについて",
  description: "Clipshareは、ゲームプレイのクリップ動画やスクリーンショットを投稿・共有できるメディアサイトです。サービスの特徴と運営方針を紹介します。",
};

export default function AboutPage() {
  return (
    <LegalDocument
      lead="Clipshareは、ゲームプレイのクリップ動画やスクリーンショットを投稿・閲覧・共有できるメディアサイトです。印象的なプレイの瞬間や面白いハプニングを、ゲームやタグごとに整理して見つけやすくすることを目指しています。"
      title="Clipshareについて"
    >
      <LegalArticle index="1" title="Clipshareでできること">
        <ul>
          <li>ゲームプレイのクリップ動画やスクリーンショットの投稿・閲覧</li>
          <li>ゲームタイトルやタグごとの投稿一覧、新着・人気・再生数・いいね数などの並び替え</li>
          <li>いいね、コメント、ブックマーク、フォローによるユーザー間の交流</li>
          <li>ライブ配信機能によるリアルタイムのプレイ配信とライブチャット</li>
          <li>ログイン不要で画像・動画の共有用URLを発行できるクイック共有機能</li>
          <li>投稿ページのOGP・oEmbed対応による、SNSやDiscordへの共有時のプレビュー表示</li>
        </ul>
      </LegalArticle>

      <LegalArticle index="2" title="どんな人におすすめか">
        <p>
          自分のゲームプレイの名場面を残しておきたい方、他の人がプレイしている面白いクリップを探したい方、特定のゲームやジャンルのハイライトをまとめて追いたい方に向けたサービスです。ゲームタイトルごとのページやタグ検索を使うと、興味のあるジャンルの投稿を効率よく見つけられます。
        </p>
      </LegalArticle>

      <LegalArticle index="3" title="運営方針">
        <p>
          Clipshareは、投稿・コメント・ライブ配信のすべてに対して通報機能を設けており、管理者が内容を確認したうえでモデレーションを行っています。安心して利用いただけるサービスを目指し、禁止コンテンツの基準や年齢確認によるNSFW表示制御など、具体的な運用方針をコミュニティガイドラインに定めています。
        </p>
      </LegalArticle>

      <LegalArticle index="4" title="運営者・お問い合わせ">
        <p>
          Clipshareは個人によって開発・運営されています。サービスに関するご質問、著作権侵害の申立て、不具合の報告などは、
          <a className="text-primary hover:underline" href="/contact">
            お問い合わせフォーム
          </a>
          または{" "}
          <a className="text-primary hover:underline" href="mailto:info@clipshare.link">
            info@clipshare.link
          </a>{" "}
          までご連絡ください。利用条件は利用規約、個人情報の取り扱いはプライバシーポリシーをご確認ください。
        </p>
      </LegalArticle>
    </LegalDocument>
  );
}
