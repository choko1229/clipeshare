import type { Metadata } from "next";
import Link from "next/link";
import { HelpDocument, HelpSection } from "@/components/help/help-document";
import { getHelpPage } from "@/lib/help/pages";

const page = getHelpPage("post-clip")!;

export const metadata: Metadata = {
  title: page.title,
  description: page.summary,
  alternates: {
    canonical: `/help/${page.slug}`,
  },
};

export default function PostClipHelpPage() {
  return (
    <HelpDocument
      lead="クリップ動画は、アップロードしたあとにサーバー側で配信用の形式へ変換してから公開されます。このページでは、対応しているファイル形式、投稿したい部分だけを切り出す方法、変換中や変換失敗時の表示の意味、投稿後に動画を差し替える手順を説明します。"
      slug={page.slug}
      title={page.title}
    >
      <HelpSection index="1" title="対応しているファイル形式">
        <p>次の形式の動画ファイルを投稿できます。</p>
        <ul>
          <li>MP4（.mp4）</li>
          <li>QuickTime（.mov）</li>
          <li>WebM（.webm）</li>
          <li>Matroska（.mkv）</li>
          <li>AVI（.avi）</li>
        </ul>
        <p>
          ゲーム機やキャプチャソフトの標準設定で保存した動画は、ほとんどがMP4かMOVなのでそのまま投稿できます。動画の長さとファイルサイズの上限はアカウントレベルによって変わるため、
          <Link className="text-primary hover:underline" href="/help/account-levels">
            アカウントレベルと投稿上限
          </Link>
          もあわせてご確認ください。
        </p>
      </HelpSection>

      <HelpSection index="2" title="投稿の手順">
        <p>ヘッダーの「投稿」ボタンから投稿作成画面を開き、次の順に操作します。</p>
        <ul>
          <li>
            <strong>1. メディアファイルを選ぶ</strong>
            ：動画ファイルを選ぶと「動画として投稿します。」と表示され、クリップとして扱われます。
          </li>
          <li>
            <strong>2. 切り抜き範囲を決める</strong>
            ：必要に応じて開始秒と終了秒を指定します。詳しくは次の項目で説明します。
          </li>
          <li>
            <strong>3. 本文を書く</strong>
            ：1行目がタイトル、2行目以降が説明文になります。
          </li>
          <li>
            <strong>4. ゲーム名や公開設定を指定する</strong>
            ：非公開で投稿したい場合やNSFWに該当する場合は、チェックを入れます。
          </li>
        </ul>
        <p>
          投稿画面はドラッグ＆ドロップにも対応しています。サイトを開いた状態で動画ファイルを画面上にドロップすると、そのファイルを選択した状態で投稿画面が開きます。
        </p>
      </HelpSection>

      <HelpSection index="3" title="必要な部分だけを切り抜く">
        <p>
          動画ファイルを選ぶと「動画クリッピング」の欄が表示され、その動画の長さが読み取られます。
          <strong>開始秒</strong>と<strong>終了秒</strong>
          を指定すると、その範囲だけが変換され、投稿されます。0.1秒単位で指定でき、指定後は「投稿される長さ」に切り出し後の秒数が表示されます。
        </p>
        <p>
          長い録画から名場面だけを投稿したいときや、動画の長さの上限を超えてしまうときに使ってください。何も指定しなければ、動画全体がそのまま投稿されます。
        </p>
        <p>
          切り抜きはアップロード後にサーバー側で行われるため、元のファイル全体がアップロードされます。通信量を抑えたい場合は、あらかじめ手元の編集ソフトで短くしてから投稿するのがおすすめです。
        </p>
      </HelpSection>

      <HelpSection index="4" title="アップロード後の変換処理">
        <p>
          画像と違い、動画はアップロードが終わってもすぐには公開されません。サーバー側で配信用のHLS形式へ変換する処理が走り、これが完了してから公開状態になります。
        </p>
        <p>
          変換中の投稿ページを開くと「動画を変換中です」と表示されます。しばらく待ってからページを再読み込みすると、再生できる状態に変わります。変換にかかる時間は動画の長さと画質によって変わり、短いクリップであれば数十秒から数分程度が目安です。
        </p>
        <p>
          変換が完了していない投稿や、後述する変換に失敗した投稿は、検索エンジンにインデックスされない設定になっています。中身のないページが検索結果に出てしまうのを防ぐためです。
        </p>
      </HelpSection>

      <HelpSection index="5" title="変換に失敗したときは">
        <p>
          投稿ページに「動画変換に失敗しました」と表示された場合、その動画は再生できません。次の点を確認してから、投稿し直してください。
        </p>
        <ul>
          <li>対応形式（MP4・MOV・WebM・MKV・AVI）のファイルか</li>
          <li>ファイルサイズと長さがアカウントレベルの上限を超えていないか</li>
          <li>録画途中で強制終了するなどして、ファイルが壊れていないか</li>
          <li>切り抜きの開始秒と終了秒が、動画の長さの範囲内になっているか</li>
        </ul>
        <p>
          別の端末やソフトで再生できないファイルは、変換にも失敗します。その場合は、再生できる形式に変換してから投稿してください。何度試しても失敗する場合は、
          <Link className="text-primary hover:underline" href="/contact">
            お問い合わせフォーム
          </Link>
          から、投稿のURLとファイルの形式をお知らせください。
        </p>
      </HelpSection>

      <HelpSection index="6" title="投稿後に動画を差し替える">
        <p>
          自分の投稿ページにある「投稿を編集」から、動画ファイルを差し替えられます。差し替えると変換処理が最初からやり直しになるため、投稿は一時的に「変換中」の状態へ戻ります。
        </p>
        <p>
          変換処理が進行している間は、続けて差し替えることはできません。前の変換が終わってから操作してください。差し替え前の動画ファイルは公開されなくなり、一定期間後にサーバーから削除されます。
        </p>
        <p>
          タイトルや説明文、タグ、ゲーム名なども同じ編集画面から変更できます。投稿したあとで説明文を書き足すこともできるので、まず投稿してから内容を整えても構いません。
        </p>
      </HelpSection>
    </HelpDocument>
  );
}
