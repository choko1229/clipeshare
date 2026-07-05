# Clipeshare 実装状況チェック

最終更新: 2026-07-05

`docs/overall-design.md` のMVP要件と、現在の実装状態を比較したチェックリストです。

凡例:

- `[x]` 完了: コード上で主要機能が実装済み
- `[~]` 一部完了: 基本実装はあるが、仕様の一部または本番確認が不足
- `[ ]` 未実装: 仕様に対して未着手、または実装が見当たらない
- `[verify]` 要本番確認: 実装はあるが、VPS/外部サービスでの実動作確認が必要

## 全体サマリー

| 項目 | 状態 | メモ |
| --- | --- | --- |
| Next.js基盤 | [x] | App Router / TypeScript / Tailwind CSS / Prisma |
| 認証 | [~][verify] | Discord OAuth、メールリンクログイン実装済み。本番OAuth/SMTPの実動作確認が必要 |
| 投稿 | [~] | 動画/画像/複数画像投稿、本文1行目タイトル化、タグ抽出、ゲーム名推定あり |
| 動画処理 | [~][verify] | FFmpeg worker、HLS、共有用MP4、サムネイル生成あり。本番worker常時起動確認が必要 |
| タイムライン | [x] | 新着、人気、再生数、いいね、コメント数、週間、月間 |
| 検索 | [x] | MVP対象の keyword / game: / tag: / from: / type: 対応 |
| コミュニティ | [x] | いいね、コメント、ブックマーク、フォロー |
| プロフィール | [~] | 基本表示、SNSアイコン、年齢確認、アカウントレベル表示あり。外部リンクのリッチ埋め込みは限定的 |
| 共有 | [~][verify] | OGP/Twitter Card、Discord動画メタ、X用MP4ダウンロードあり。外部サービス上の見え方は本番確認が必要 |
| 管理画面 | [x] | 投稿、コメント、通報、タグ、ゲーム、ユーザー、管理者、監査ログ、アカウントレベル |
| 通報/モデレーション | [~] | 通報、NGワード、自動通報、BAN、NSFW管理、規約/ガイドラインあり。運用基準の詳細化余地あり |
| NSFW | [x] | NSFWフラグ、未ログイン非表示、年齢確認、ぼかし表示、管理者変更 |
| PWA | [~][verify] | manifestあり。インストール、アイコン、モバイル挙動は本番確認が必要 |
| デプロイ | [~][verify] | GitHub Actions、migration、seed、build、restart対応。本番デプロイ成功報告あり |

## 1. サービス基盤

### 完了

- [x] Next.js App Router
- [x] TypeScript
- [x] Tailwind CSS
- [x] Prisma + MySQL
- [x] Auth.js / NextAuth
- [x] nanoidによる公開ID
- [x] `/c/{ID}` 投稿URL
- [x] PWA manifest
- [x] 本番向け `next build --webpack`

### 要本番確認

- [verify] `https://clipshare.link` での全ページ表示
- [verify] SSL、Nginx、systemd、workerの安定稼働
- [verify] GitHub Actionsによる自動デプロイ継続

## 2. 認証

### 完了

- [x] Discord OAuthログイン
- [x] メールリンクログイン
- [x] DBセッション
- [x] BAN済みユーザーの操作制限
- [x] USER / MODERATOR / ADMIN / OWNER ロール

### 要本番確認

- [verify] Discord Developer PortalのRedirect URI
- [verify] SMTPでメールリンクが届くこと
- [verify] 本番Cookie / `AUTH_URL` / `NEXTAUTH_URL`

## 3. 投稿

### 完了

- [x] 動画投稿
- [x] 画像投稿
- [x] 複数画像投稿
- [x] 動画は1本のみ
- [x] 画像はアカウントレベルの `maxImagesPerPost` まで
- [x] メディア必須
- [x] 本文1行目をタイトル、2行目以降を説明として保存
- [x] 本文内 `#タグ` 抽出
- [x] ゲーム名が空欄の場合、本文/タグ/ファイル名から推定
- [x] 公開/非公開
- [x] NSFWフラグ
- [x] ランク帯、Discordサーバー名、カスタム項目
- [x] 投稿編集
- [x] 動画差し替え
- [x] 動画サムネイル手動変更
- [x] 画像WebP変換
- [x] 画像カルーセル表示
- [x] 既存単体画像投稿との互換表示

### 一部完了

- [~] 投稿削除の管理機能はあるが、投稿者自身の削除UI/削除後ファイル移動は強化余地あり
- [~] 動画差し替え後の古いファイル保持/削除は設計と一部処理あり。完全なファイルライフサイクルは次フェーズ候補

### 要本番確認

- [verify] 大きい動画アップロード
- [verify] 4K画像アップロード
- [verify] 複数画像投稿
- [verify] アカウントレベル別制限
- [verify] 日次投稿制限

## 4. アカウントレベル

### 完了

- [x] DB管理
- [x] 管理画面で編集可能
- [x] プロフィールにレベル表示
- [x] 自分のプロフィールで現在制限、残り投稿数、次レベル条件を表示
- [x] Visitor 初期レベル
- [x] NewUser / User / KnowUser / TrustedUser 自動昇格
- [x] Admin / Nuisance 手動設定
- [x] TrustedUser はAdmin系ユーザーからのフォロー必須
- [x] Nuisance期限設定
- [x] Nuisance期限切れ後はVisitorへ戻し、進捗日数をリセット

### 現在のレベル仕様

| レベル | 色 | 動画 | 画像 | 枚数 | 日次投稿 | 条件 |
| --- | --- | --- | --- | --- | --- | --- |
| Visitor | 灰色 | 30秒 / 60MB | 3MB | 1枚 | 5回 | 初期 |
| NewUser | 水色 | 1分 / 120MB | 15MB | 4枚 | 10回 | 投稿15件+5日、またはフォロワー1人、またはメール認証 |
| User | 緑 | 3分 / 500MB | 30MB | 8枚 | 15回 | 投稿30件+7日、またはフォロワー5人 |
| KnowUser | オレンジ | 5分 / 750MB | 60MB | 16枚 | 20回 | 投稿100件+20日、またはフォロワー15人 |
| TrustedUser | 紫 | 7分 / 1000MB | 120MB | 32枚 | 40回 | 投稿200件+30日、またはフォロワー15人、かつAdminフォロー |
| Admin | 黄色 | 実質上限なし | 実質上限なし | 100枚 | 無制限 | 管理画面で設定 |
| Nuisance | 朱色 | 不可 | 3MB | 1枚 | 3回 | 管理画面で期限付き設定 |

## 5. 動画処理

### 完了

- [x] アップロードジョブ
- [x] FFmpeg worker
- [x] HLS出力
- [x] 動画サムネイル生成
- [x] Discord/X共有用MP4生成
- [x] 共有用MP4は `H.264 / AAC / faststart`
- [x] `/media` 静的配信

### 要本番確認

- [verify] workerが常時起動していること
- [verify] HLS再生
- [verify] 共有用MP4の生成
- [verify] Discordで動画プレビュー
- [verify] X用MP4ダウンロード

## 6. タイムライン

### 完了

- [x] トップページはランキング専用ではなくタイムライン
- [x] 新着順
- [x] 人気順
- [x] 再生数順
- [x] いいね順
- [x] コメント数順
- [x] 週間
- [x] 月間
- [x] NSFW非表示が初期値

### 一部完了

- [~] 週間/月間は期間内投稿を人気指標で並べる実装。厳密な独自ランキングスコアは未実装

## 7. 検索

### 完了

- [x] キーワード検索
- [x] `game:`
- [x] `tag:`
- [x] `from:`
- [x] `type:clip`
- [x] `type:screenshot`

### 未実装

- [ ] `nsfw:`
- [ ] `rank:`
- [ ] `server:`
- [ ] MySQL FULLTEXT / Meilisearch / Typesenseなどの検索専用基盤

## 8. コミュニティ

### 完了

- [x] いいね
- [x] コメント
- [x] 自分のコメント削除
- [x] ブックマーク
- [x] ブックマーク一覧
- [x] フォロー
- [x] フォロー中フィード

### 要確認

- [verify] カウント増減の整合性
- [verify] 連打時の挙動

## 9. プロフィール

### 完了

- [x] ユーザーアイコン表示
- [x] アイコンURL変更
- [x] 自己紹介
- [x] 投稿数
- [x] 総いいね数
- [x] よく投稿するゲーム
- [x] SNSリンク
- [x] Discord / X / YouTube / Misskey のサービスアイコン表示
- [x] 投稿一覧
- [x] フォロー/フォロワー数
- [x] 年齢確認済みバッジ
- [x] アカウントレベル表示

### 一部完了

- [~] DiscordやXなどの外部リンクはサービスアイコン付きリンク表示。リンク先コンテンツのリッチ埋め込みは未実装

## 10. 共有

### 完了

- [x] URLコピー
- [x] X共有URL
- [x] X投稿文コピー
- [x] X用MP4ダウンロード
- [x] Discord用URLコピー
- [x] 埋め込みコード
- [x] 投稿詳細のOGP
- [x] Twitter Card
- [x] Discord向け `og:video`
- [x] NSFW時のOGP制御
- [x] 共有プレビュー診断スクリプト

### 要本番確認

- [verify] Discordに貼ったときのサムネイル/タイトル/説明
- [verify] Discord内動画再生ボタン
- [verify] Xでのカード表示
- [verify] X用MP4を手動添付した投稿の見た目

### 保留

- [ ] X APIによる動画付き自動投稿

理由: X Developer登録、OAuth、投稿権限、料金確認が必要。

## 11. 管理画面

### 完了

- [x] 管理ダッシュボード
- [x] 投稿管理
- [x] 投稿削除
- [x] 投稿非公開化
- [x] ユーザーBAN
- [x] コメント削除
- [x] 通報確認
- [x] 通報ステータス変更
- [x] 通報から投稿非公開/コメント削除/BAN
- [x] タグ管理
- [x] ゲーム名管理
- [x] ゲーム統合
- [x] IGDB同期
- [x] 管理者追加
- [x] 管理者操作ログ
- [x] BAN理由
- [x] ユーザーのアカウントレベル変更
- [x] Nuisance期限設定
- [x] アップロード制限変更

### 要確認

- [verify] OWNER / ADMIN / MODERATORごとの表示制御
- [verify] 操作ログが各管理操作で期待通り残ること

## 12. 通報・モデレーション

### 完了

- [x] 投稿通報
- [x] コメント通報
- [x] 通報一覧
- [x] 通報ステータス
- [x] NGワード/正規表現ルール
- [x] block / report アクション
- [x] 自動通報
- [x] 管理者による投稿非公開
- [x] 管理者によるBAN
- [x] 管理者によるNSFW指定/解除
- [x] 利用規約ページ
- [x] プライバシーポリシーページ
- [x] ガイドラインページ

### 一部完了

- [~] 犯罪系禁止などの基準はガイドライン化済み。より詳細な管理者向け判断基準は追加余地あり
- [~] 初期NGワードはseed済み。運用しながら追加が必要

## 13. NSFW

### 完了

- [x] 投稿にNSFWフラグ
- [x] 未ログインユーザーにはNSFW非表示
- [x] ログインユーザー向け表示制限
- [x] 生年月日による18歳以上確認
- [x] 年齢確認状態の保存
- [x] ぼかし表示
- [x] 表示ボタン
- [x] タイムラインではNSFW非表示
- [x] 管理者がNSFW指定/解除

### 要確認

- [verify] 年齢確認フローが本番UIで分かりやすいこと
- [verify] NSFW投稿のOGPが意図通り制限されること

## 14. ゲーム情報

### 完了

- [x] ゲームDB
- [x] ゲーム詳細ページ
- [x] 投稿時のゲーム自動作成
- [x] ゲーム名推定
- [x] 管理画面でゲーム編集
- [x] ゲーム統合
- [x] IGDB IDまたは名前検索による同期
- [x] cover / hero / summary / genres / platforms / release date 保存

### 一部完了

- [~] Steam App ID / RAWG slugは保存欄あり

### 未実装 / 保留

- [ ] Steamからの自動取得
- [ ] RAWGからの自動取得
- [ ] YouTubeのゲームまとめ的な外部情報集約

## 15. PWA / スマホ対応

### 完了

- [x] Web App Manifest
- [x] Service Worker登録
- [x] オフライン時のフォールバックページ
- [x] レスポンシブレイアウト
- [x] スマホ幅の投稿/一覧/詳細/管理画面の基本対応

### 一部完了

- [~] Service Workerは静的アセットと通常ページの最低限キャッシュ。API、認証、メディアは安全のためキャッシュ対象外

### 要本番確認

- [verify] ホーム画面追加
- [verify] アイコン表示
- [verify] iOS / Androidでの主要画面表示

## 16. デプロイ / 運用

### 完了

- [x] Ubuntu 24.04向けインストールスクリプト
- [x] deploy-server script
- [x] GitHub Actions SSHデプロイ
- [x] migration自動実行
- [x] seed自動実行
- [x] Nginx想定
- [x] systemd想定
- [x] FFmpeg前提
- [x] cleanup-media script

### 要本番確認

- [verify] app service起動
- [verify] worker service起動
- [verify] Nginx設定
- [verify] SSL更新
- [verify] アップロード容量上限
- [verify] ストレージ残量監視
- [verify] cleanup-media の定期実行

## 優先して残っている作業

1. 本番反映確認
   - フェーズ7の migration / seed / build / restart がGitHub Actionsで通ること
   - 複数画像投稿、Nuisance期限、Visitor初期化を本番で確認

2. ファイル削除・差し替え管理の完成
   - 投稿削除時に関連ファイルを保持期間付きで移動/削除予約
   - 動画差し替え時の旧HLS/旧MP4/旧サムネイル/旧元動画の保持管理
   - `cleanup-media` のcronまたはsystemd timer運用

3. 本番実機チェック
   - Discordログイン
   - メールリンクログイン
   - 動画投稿からHLS変換
   - 複数画像投稿
   - Discord/X共有プレビュー
   - スマホ表示
   - PWA

4. 検索演算子の残り
   - `nsfw:`
   - `rank:`
   - `server:`

5. 外部ゲーム情報の拡張
   - Steam / RAWG自動取得
   - YouTube風のゲームまとめ情報集約

6. 管理者向け運用ドキュメント強化
   - 禁止コンテンツ判断基準
   - 通報対応フロー
   - Nuisance適用基準
   - BAN基準
