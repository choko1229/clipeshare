# ゲーマー向けクリップ / スクリーンショット共有サイト 全体設計書

## 1. サービス概要

本サービスは、ゲームを中心としたクリップ動画・スクリーンショットを投稿、閲覧、共有できる一般公開型のメディア共有サイトです。Instagramのように投稿にはメディアを必須とし、タイムライン上で視覚的にコンテンツを発見できる体験を重視します。

サイト名は未定です。仕様、ターゲット、デザイン方針、ドメイン候補が固まった後に決定します。

主な特徴:

- ゲームクリップ動画とスクリーンショット画像を中心にした投稿サイト
- 未ログインでも閲覧可能
- 投稿、いいね、コメント、ブックマーク、フォローはログイン必須
- Discord OAuthとメールログインに対応
- Discordサーバー限定ではなく一般公開
- Discord、XなどでURL共有した際のOGP / Twitter Card表示を重視
- スマホ対応、PWA対応
- 管理画面、通報、BAN、NSFW制御をMVPから実装

現時点の決定事項:

- 投稿詳細URLは `/c/{ID}` とする
- 公開投稿IDは `nanoid` を使う
- メールログインはメールリンクログイン方式とする
- NSFW投稿は未ログインユーザーには非表示にする
- ログインユーザーには自己申告による表示許可を用意し、初期状態はぼかし表示 + 表示ボタンにする
- NSFWでも犯罪系コンテンツは禁止する
- 画像投稿は4K画質でも問題ない上限を初期値にする
- 元動画は一定期間保存し、期間経過後に削除する
- 削除済みファイル保持期間はDBで管理し、初期値は45日とする

想定する体験:

- ユーザーはゲーム名、タグ、投稿者、投稿タイプでクリップを探せる
- クリップ詳細ページをDiscordやXに貼ると、タイトル、説明、サムネイルが埋め込み表示される
- 投稿者はプロフィール上で自分の投稿、総いいね数、よく投稿するゲーム、SNSリンクを見せられる
- 管理者は不適切投稿、通報、BAN、タグ、ゲーム名、アップロード制限を管理できる

## 2. 要件定義

### 2.1 サービス要件

- 一般公開サイトとして運用する
- 特定Discordサーバー参加者限定にはしない
- 投稿にはメディアを必須とする
- 投稿対象はゲーム中心だが、ゲーム関連の雑談動画や周辺コンテンツも許可する
- ランキング専用ページは作らず、トップページはタイムラインにする
- タイムライン上で新着、人気、再生数、いいね、コメント数、週間、月間の並び替えを提供する
- DiscordやXへURL共有した際に、サムネイル、タイトル、説明が表示されるようにする

### 2.2 ユーザー要件

- 未ログインユーザーは投稿一覧、投稿詳細、プロフィールを閲覧できる
- ログインユーザーは投稿、いいね、コメント、ブックマーク、フォロー、通報ができる
- 管理者は投稿、コメント、ユーザー、通報、タグ、ゲーム名、アカウントレベル、アップロード制限を管理できる

### 2.3 投稿要件

投稿できるメディア:

- クリップ動画
- スクリーンショット画像

投稿時の必須項目:

- タイトル
- 説明文
- ゲーム名
- サムネイル
- メディアファイル

投稿時の任意項目:

- 公開 / 非公開
- ランク帯
- Discordサーバー名
- タグ
- NSFWフラグ
- その他カスタム項目

初期公開設定:

- 公開

投稿後に編集できる項目:

- タイトル
- 説明文
- タグ
- ゲーム名
- サムネイル
- 動画差し替え
- 公開 / 非公開
- NSFWフラグ
- ランク帯
- Discordサーバー名

### 2.4 動画要件

- 一般的な動画形式を許可する
- アップロード後にFFmpegで変換する
- 再生方式はHLSを基本とする
- 初期最大動画時間は3分
- 最大動画サイズ、最大動画時間はアカウントレベルごとに変更可能にする
- 制限値はコード固定にせず、DBまたは管理画面から変更できる設計にする
- サムネイルは動画から自動生成し、ユーザーによる手動変更も可能にする

想定入力形式:

- mp4
- mov
- webm
- mkv
- avi

内部配信形式:

- HLS: `.m3u8` + `.ts` または `.m4s`
- サムネイル: webp または jpg
- 画像投稿: webp変換を推奨

### 2.5 認証要件

対応ログイン:

- Discordログイン
- メールアドレスログイン

認証方針:

- Auth.jsを使用する
- Discord OAuthは本人確認と初期アイコン取得に使う
- 特定Discordサーバー参加チェックは行わない
- メールログインはSMTPを使ったメールリンク方式、またはメール + パスワード方式を検討する

MVP推奨:

- Discord OAuth
- メールリンクログイン

メールリンク方式にすると、パスワードリセット、パスワードハッシュ、パスワード強度管理をMVPで抱えずに済むため、初期実装の安全性が高いです。

## 3. 機能一覧

### 3.1 閲覧機能

- トップタイムライン
- 投稿詳細
- 動画再生
- スクリーンショット表示
- プロフィール閲覧
- タグ別一覧
- ゲーム別一覧
- 検索結果一覧
- NSFW表示制御

### 3.2 投稿機能

- 動画投稿
- スクリーンショット投稿
- タイトル入力
- 説明文入力
- ゲーム名入力 / 選択
- タグ入力
- サムネイル自動生成
- サムネイル手動変更
- 公開 / 非公開設定
- ランク帯設定
- Discordサーバー名設定
- NSFWフラグ設定
- 投稿編集
- 動画差し替え
- 投稿削除

### 3.3 コミュニティ機能

- いいね
- コメント
- ブックマーク
- フォロー
- フォロワー一覧
- フォロー中一覧
- ユーザー別投稿一覧

### 3.4 検索機能

通常検索:

- タイトル
- 説明文
- ゲーム名
- タグ
- 投稿者名

検索演算子:

- `from:username`
- `game:Valorant`
- `tag:ace`
- `type:clip`
- `type:screenshot`
- `nsfw:false`
- `rank:diamond`
- `server:example`

MVP対象:

- キーワード検索
- `game:`
- `tag:`
- `from:`
- `type:`

### 3.5 共有機能

- URLコピー
- X共有
- Discord共有
- 埋め込みコード生成
- OGPメタタグ
- Twitter Cardメタタグ

### 3.6 管理機能

- 投稿削除
- 投稿非公開化
- ユーザーBAN
- コメント削除
- 通報確認
- タグ管理
- ゲーム名管理
- 管理者追加
- 管理者操作ログ
- BAN理由管理
- 通報対応ステータス管理
- ユーザーのアカウントレベル変更
- アップロード制限変更
- 管理者によるNSFW指定 / 解除

### 3.7 モデレーション機能

- 通報
- NGワード検出
- 不適切投稿対策
- NSFW表示制御
- 年齢確認
- BAN
- 投稿非公開化
- コメント削除

### 3.8 PWA機能

- Web App Manifest
- Service Worker
- ホーム画面追加
- アイコン設定
- テーマカラー設定
- オフライン時の最低限の表示
- スマホ向けレイアウト

## 4. 画面一覧

### 4.1 公開画面

| 画面 | URL案 | 概要 |
| --- | --- | --- |
| トップタイムライン | `/` | メディア中心のタイムライン |
| 投稿詳細 | `/posts/[id]` または `/clip/[slug]` | OGP対象の詳細ページ |
| 検索結果 | `/search?q=...` | キーワードと演算子検索 |
| ゲーム別一覧 | `/games/[slug]` | ゲームごとの投稿一覧 |
| タグ別一覧 | `/tags/[slug]` | タグごとの投稿一覧 |
| プロフィール | `/users/[username]` | 投稿者プロフィール |
| ログイン | `/login` | Discord / メールログイン |
| 利用規約 | `/terms` | 投稿ルール、禁止事項 |
| プライバシーポリシー | `/privacy` | 個人情報、Cookie等 |

### 4.2 ログイン必須画面

| 画面 | URL案 | 概要 |
| --- | --- | --- |
| 投稿作成 | `/posts/new` | 動画 / 画像投稿 |
| 投稿編集 | `/posts/[id]/edit` | 投稿内容、動画差し替え |
| ブックマーク | `/bookmarks` | 保存済み投稿 |
| 通知 | `/notifications` | コメント、いいね、フォロー通知 |
| プロフィール編集 | `/settings/profile` | アイコン、自己紹介、SNSリンク |
| アカウント設定 | `/settings/account` | メール、連携ログイン |
| 年齢確認 | `/settings/age-verification` | NSFW表示許可に必要 |

### 4.3 管理画面

| 画面 | URL案 | 概要 |
| --- | --- | --- |
| 管理ダッシュボード | `/admin` | 通報、投稿、ユーザーの概要 |
| 投稿管理 | `/admin/posts` | 投稿検索、削除、非公開化 |
| コメント管理 | `/admin/comments` | コメント削除、確認 |
| 通報管理 | `/admin/reports` | 通報対応ステータス管理 |
| ユーザー管理 | `/admin/users` | BAN、レベル変更 |
| タグ管理 | `/admin/tags` | タグ作成、統合、非表示 |
| ゲーム名管理 | `/admin/games` | ゲーム名作成、統合、正規化 |
| 管理者管理 | `/admin/admins` | 管理者追加、権限変更 |
| アップロード制限 | `/admin/upload-limits` | アカウントレベル別制限 |
| 操作ログ | `/admin/audit-logs` | 管理者操作ログ |

## 5. ユーザーロール設計

### 5.1 ロール

| ロール | 概要 |
| --- | --- |
| Guest | 未ログイン閲覧者 |
| User | 通常ログインユーザー |
| Moderator | 通報、投稿、コメント対応ができるモデレーター |
| Admin | 管理画面全体を操作できる管理者 |
| Owner | 管理者追加、システム設定変更ができる最高権限 |

### 5.2 権限

| 操作 | Guest | User | Moderator | Admin | Owner |
| --- | --- | --- | --- | --- | --- |
| 投稿閲覧 | 可 | 可 | 可 | 可 | 可 |
| NSFW閲覧 | 不可 | 年齢確認後可 | 可 | 可 | 可 |
| 投稿作成 | 不可 | 可 | 可 | 可 | 可 |
| いいね | 不可 | 可 | 可 | 可 | 可 |
| コメント | 不可 | 可 | 可 | 可 | 可 |
| ブックマーク | 不可 | 可 | 可 | 可 | 可 |
| フォロー | 不可 | 可 | 可 | 可 | 可 |
| 通報 | 不可 | 可 | 可 | 可 | 可 |
| 投稿非公開化 | 不可 | 自分のみ | 可 | 可 | 可 |
| コメント削除 | 不可 | 自分のみ | 可 | 可 | 可 |
| ユーザーBAN | 不可 | 不可 | 不可 | 可 | 可 |
| 管理者追加 | 不可 | 不可 | 不可 | 不可 | 可 |
| アップロード制限変更 | 不可 | 不可 | 不可 | 可 | 可 |

### 5.3 アカウントレベル

ロールとは別に、アップロード制限用のアカウントレベルを持たせます。

| レベル | 用途 | 初期制限例 |
| --- | --- | --- |
| default | 通常ユーザー | 動画3分 / 動画300MB / 画像50MB |
| trusted | 信頼済みユーザー | 動画5分 / 動画700MB / 画像75MB |
| creator | 投稿量が多いユーザー | 動画10分 / 動画1.5GB / 画像100MB |
| restricted | 制限中ユーザー | 動画1分 / 動画100MB / 画像20MB |

実際の制限値はDBで管理し、管理画面から変更できるようにします。
画像は4KスクリーンショットのPNG投稿も想定し、初期通常ユーザー上限は50MBを目安にします。保存時は配信用にwebpへ変換し、必要に応じて元画像の保持期間を設定します。

## 6. 投稿・動画処理フロー

### 6.1 動画投稿フロー

1. ユーザーが投稿作成画面で動画を選択する
2. クライアント側でファイルサイズ、拡張子、MIME Typeを事前検証する
3. サーバー側でログイン状態、BAN状態、アカウントレベル、アップロード制限を検証する
4. 元動画をローカルストレージの一時領域に保存する
5. 投稿レコードを `processing` 状態で作成する
6. バックグラウンドジョブに動画変換タスクを登録する
7. FFmpegでHLSへ変換する
8. FFmpegでサムネイルを自動生成する
9. メタデータを取得する
10. 変換成功後、投稿を `published` または `private` 状態に更新する
11. 失敗時は `failed` 状態にし、エラー内容を管理画面で確認できるようにする

### 6.2 スクリーンショット投稿フロー

1. ユーザーが投稿作成画面で画像を選択する
2. クライアント側でファイルサイズ、拡張子、MIME Typeを事前検証する
3. サーバー側でログイン状態、BAN状態、アカウントレベル、アップロード制限を検証する
4. 元画像を保存する
5. 画像をwebpなど配信用形式に変換する
6. サムネイルを生成する
7. 投稿レコードを `published` または `private` 状態で作成する

### 6.3 動画差し替えフロー

1. 投稿者が投稿編集画面で新しい動画をアップロードする
2. 対象投稿の所有者であることを確認する
3. 既存動画をすぐ削除せず、新動画を `processing` として変換する
4. 変換成功後に配信対象を新動画へ切り替える
5. 古い動画ファイルは一定期間後に削除する
6. 変換失敗時は既存動画を維持する

### 6.4 ファイル配置案

ローカル保存の初期構成:

```txt
storage/
  uploads/
    originals/
      videos/
      images/
    processed/
      hls/
        post-id/
          master.m3u8
          segment-0001.ts
      images/
    thumbnails/
      post-id.webp
  temp/
  deleted/
```

Next.jsの公開配信では、直接 `public/` にアップロードし続ける構成は避けます。アップロードファイルはアプリ管理下の `storage/` に置き、認可が不要な公開メディアだけを静的配信対象にします。Nginxで `/media/` を `storage/uploads/processed/` に割り当てる構成を推奨します。

## 7. DB設計案

DBはMySQL / MariaDBを想定します。ORMはPrismaを第一候補にします。

### 7.1 主要テーブル

#### users

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint / cuid | ユーザーID |
| username | varchar | 表示ID、URLに使用 |
| display_name | varchar | 表示名 |
| email | varchar nullable | メールアドレス |
| email_verified_at | datetime nullable | メール確認日時 |
| avatar_url | varchar nullable | アイコンURL |
| bio | text nullable | 自己紹介 |
| role | enum | user / moderator / admin / owner |
| account_level_id | FK | アップロード制限用レベル |
| is_banned | boolean | BAN状態 |
| ban_reason | text nullable | BAN理由 |
| banned_at | datetime nullable | BAN日時 |
| age_verified_at | datetime nullable | 年齢確認日時 |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |

#### accounts

Auth.js用の外部アカウント連携テーブルです。Discord OAuthなどを保存します。

#### sessions

Auth.js用のセッションテーブルです。

#### verification_tokens

Auth.jsのメールログイン用トークンテーブルです。

#### user_links

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| user_id | FK | ユーザー |
| type | varchar | x / discord / youtube / twitch / website |
| label | varchar nullable | 表示名 |
| url | varchar | URL |
| sort_order | int | 表示順 |

#### games

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| name | varchar | ゲーム名 |
| slug | varchar | URL用slug |
| aliases | json nullable | 別名 |
| is_active | boolean | 使用可否 |
| created_at | datetime | 作成日時 |

#### tags

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| name | varchar | タグ名 |
| slug | varchar | URL用slug |
| is_active | boolean | 使用可否 |
| created_at | datetime | 作成日時 |

#### posts

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint / cuid | 投稿ID |
| user_id | FK | 投稿者 |
| game_id | FK | ゲーム |
| type | enum | clip / screenshot |
| title | varchar | タイトル |
| description | text | 説明文 |
| status | enum | processing / published / private / hidden / failed / deleted |
| visibility | enum | public / private |
| thumbnail_url | varchar | サムネイルURL |
| media_url | varchar nullable | 画像またはHLS master URL |
| original_file_path | varchar nullable | 元ファイルパス |
| hls_path | varchar nullable | HLS保存先 |
| duration_seconds | int nullable | 動画時間 |
| file_size_bytes | bigint nullable | 元ファイルサイズ |
| width | int nullable | 幅 |
| height | int nullable | 高さ |
| rank_name | varchar nullable | ランク帯 |
| discord_server_name | varchar nullable | Discordサーバー名 |
| custom_fields | json nullable | カスタム項目 |
| is_nsfw | boolean | NSFWフラグ |
| nsfw_set_by_admin_id | FK nullable | 管理者指定者 |
| view_count | bigint | 再生 / 表示数 |
| like_count | bigint | いいね数 |
| comment_count | bigint | コメント数 |
| bookmark_count | bigint | ブックマーク数 |
| published_at | datetime nullable | 公開日時 |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |

#### post_tags

| カラム | 型 | 概要 |
| --- | --- | --- |
| post_id | FK | 投稿 |
| tag_id | FK | タグ |

#### comments

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| post_id | FK | 投稿 |
| user_id | FK | 投稿者 |
| body | text | コメント本文 |
| status | enum | published / hidden / deleted |
| deleted_by_admin_id | FK nullable | 管理者削除者 |
| created_at | datetime | 作成日時 |

#### likes

| カラム | 型 | 概要 |
| --- | --- | --- |
| user_id | FK | ユーザー |
| post_id | FK | 投稿 |
| created_at | datetime | 作成日時 |

`user_id + post_id` にユニーク制約を付けます。

#### bookmarks

| カラム | 型 | 概要 |
| --- | --- | --- |
| user_id | FK | ユーザー |
| post_id | FK | 投稿 |
| created_at | datetime | 作成日時 |

#### follows

| カラム | 型 | 概要 |
| --- | --- | --- |
| follower_id | FK | フォローする側 |
| following_id | FK | フォローされる側 |
| created_at | datetime | 作成日時 |

#### reports

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| reporter_id | FK | 通報者 |
| target_type | enum | post / comment / user |
| target_id | varchar | 対象ID |
| reason | enum | spam / harassment / nsfw_missing / illegal / other |
| detail | text nullable | 詳細 |
| status | enum | open / reviewing / action_taken / rejected / closed |
| handled_by_admin_id | FK nullable | 対応者 |
| handled_at | datetime nullable | 対応日時 |
| created_at | datetime | 作成日時 |

#### admin_audit_logs

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| admin_id | FK | 操作者 |
| action | varchar | 操作種別 |
| target_type | varchar | 対象種別 |
| target_id | varchar | 対象ID |
| before_data | json nullable | 変更前 |
| after_data | json nullable | 変更後 |
| reason | text nullable | 理由 |
| ip_address | varchar nullable | IP |
| user_agent | text nullable | User-Agent |
| created_at | datetime | 作成日時 |

#### account_levels

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| name | varchar | レベル名 |
| max_video_seconds | int | 最大動画秒数 |
| max_video_size_bytes | bigint | 最大動画サイズ |
| max_image_size_bytes | bigint | 最大画像サイズ |
| daily_upload_limit | int nullable | 1日投稿上限 |
| is_default | boolean | 初期レベル |
| created_at | datetime | 作成日時 |
| updated_at | datetime | 更新日時 |

#### upload_jobs

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| post_id | FK | 投稿 |
| status | enum | queued / processing / completed / failed |
| input_path | varchar | 入力ファイル |
| output_path | varchar nullable | 出力先 |
| error_message | text nullable | エラー |
| started_at | datetime nullable | 開始日時 |
| finished_at | datetime nullable | 終了日時 |
| created_at | datetime | 作成日時 |

#### moderation_rules

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| type | enum | ng_word / blocked_url / blocked_pattern |
| pattern | varchar | 検出文字列または正規表現 |
| action | enum | warn / hold / reject / hide |
| is_active | boolean | 有効状態 |
| created_at | datetime | 作成日時 |

#### storage_settings

| カラム | 型 | 概要 |
| --- | --- | --- |
| id | bigint | ID |
| key | varchar | 設定キー |
| value | varchar | 設定値 |
| description | text nullable | 説明 |
| updated_by_admin_id | FK nullable | 更新した管理者 |
| updated_at | datetime | 更新日時 |

初期設定例:

| key | value | 概要 |
| --- | --- | --- |
| `original_video_retention_days` | `45` | HLS変換後の元動画保持日数 |
| `deleted_file_retention_days` | `45` | 削除済みファイル保持日数 |
| `original_image_retention_days` | `45` | 元画像保持日数 |

元動画はHLS変換後も一定期間だけ保持し、期間経過後に削除します。削除済みファイル保持期間はDBで管理し、初期値は45日とします。

### 7.2 インデックス方針

重要インデックス:

- `posts(status, visibility, published_at)`
- `posts(game_id, published_at)`
- `posts(user_id, published_at)`
- `posts(type, published_at)`
- `posts(is_nsfw, published_at)`
- `posts(like_count, published_at)`
- `posts(view_count, published_at)`
- `posts(comment_count, published_at)`
- `tags(slug)`
- `games(slug)`
- `users(username)`
- `likes(user_id, post_id)`
- `bookmarks(user_id, post_id)`
- `follows(follower_id, following_id)`

検索はMVPではMySQLのLIKE検索とタグ / ゲーム / 投稿者フィルタで開始し、投稿数が増えた段階でMySQL FULLTEXT、Meilisearch、Typesenseなどを検討します。

## 8. API設計案

Next.js App RouterのRoute Handler、Server Actions、React Server Componentsを組み合わせます。外部公開APIではなく、Webアプリ内部APIとして設計します。

### 8.1 認証

| メソッド | パス | 概要 |
| --- | --- | --- |
| GET/POST | `/api/auth/*` | Auth.js |

### 8.2 投稿

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| GET | `/api/posts` | 任意 | タイムライン取得 |
| POST | `/api/posts` | 必須 | 投稿作成 |
| GET | `/api/posts/[id]` | 任意 | 投稿詳細取得 |
| PATCH | `/api/posts/[id]` | 投稿者 / 管理者 | 投稿編集 |
| DELETE | `/api/posts/[id]` | 投稿者 / 管理者 | 投稿削除 |
| POST | `/api/posts/[id]/replace-media` | 投稿者 | 動画差し替え |
| POST | `/api/posts/[id]/thumbnail` | 投稿者 | サムネイル変更 |

### 8.3 コミュニティ

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| POST | `/api/posts/[id]/like` | 必須 | いいね |
| DELETE | `/api/posts/[id]/like` | 必須 | いいね解除 |
| POST | `/api/posts/[id]/bookmark` | 必須 | ブックマーク |
| DELETE | `/api/posts/[id]/bookmark` | 必須 | ブックマーク解除 |
| GET | `/api/posts/[id]/comments` | 任意 | コメント一覧 |
| POST | `/api/posts/[id]/comments` | 必須 | コメント作成 |
| DELETE | `/api/comments/[id]` | 投稿者 / 管理者 | コメント削除 |
| POST | `/api/users/[id]/follow` | 必須 | フォロー |
| DELETE | `/api/users/[id]/follow` | 必須 | フォロー解除 |

### 8.4 検索

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| GET | `/api/search?q=...` | 任意 | 総合検索 |
| GET | `/api/tags` | 任意 | タグ候補 |
| GET | `/api/games` | 任意 | ゲーム候補 |

検索クエリ解析例:

```txt
valorant ace from:player1 game:Valorant tag:ace type:clip
```

解析結果:

- keyword: `valorant ace`
- from: `player1`
- game: `Valorant`
- tag: `ace`
- type: `clip`

### 8.5 通報

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| POST | `/api/reports` | 必須 | 通報作成 |
| GET | `/api/admin/reports` | 管理者 | 通報一覧 |
| PATCH | `/api/admin/reports/[id]` | 管理者 | 通報ステータス更新 |

### 8.6 管理

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| GET | `/api/admin/posts` | 管理者 | 投稿管理一覧 |
| PATCH | `/api/admin/posts/[id]` | 管理者 | 非公開化、NSFW変更 |
| DELETE | `/api/admin/posts/[id]` | 管理者 | 投稿削除 |
| GET | `/api/admin/users` | 管理者 | ユーザー管理一覧 |
| PATCH | `/api/admin/users/[id]` | 管理者 | BAN、レベル変更 |
| GET | `/api/admin/tags` | 管理者 | タグ管理 |
| POST | `/api/admin/tags` | 管理者 | タグ作成 |
| PATCH | `/api/admin/tags/[id]` | 管理者 | タグ更新 |
| GET | `/api/admin/games` | 管理者 | ゲーム名管理 |
| POST | `/api/admin/games` | 管理者 | ゲーム名作成 |
| PATCH | `/api/admin/games/[id]` | 管理者 | ゲーム名更新 |
| GET | `/api/admin/audit-logs` | 管理者 | 操作ログ |
| GET | `/api/admin/upload-limits` | 管理者 | 制限一覧 |
| PATCH | `/api/admin/upload-limits/[id]` | 管理者 | 制限変更 |

### 8.7 OGP / 埋め込み

| メソッド | パス | 認証 | 概要 |
| --- | --- | --- | --- |
| GET | `/posts/[id]` | 任意 | OGP付き投稿詳細HTML |
| GET | `/api/oembed?url=...` | 任意 | 埋め込み情報 |

投稿詳細ページではApp Routerの`generateMetadata`を使い、投稿ごとにOGPとTwitter Cardを生成します。

OGP例:

```html
<meta property="og:type" content="article">
<meta property="og:title" content="投稿タイトル">
<meta property="og:description" content="投稿説明文">
<meta property="og:image" content="https://example.com/media/thumbnails/post-id.webp">
<meta property="og:url" content="https://example.com/posts/post-id">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="投稿タイトル">
<meta name="twitter:description" content="投稿説明文">
<meta name="twitter:image" content="https://example.com/media/thumbnails/post-id.webp">
```

非公開、削除、年齢制限対象の扱い:

- 非公開投稿はOGPを出さない
- 削除済み投稿は404または410
- NSFW投稿は露骨なサムネイルをOGPに使わず、NSFW用プレースホルダー画像を返す

## 9. ディレクトリ構成案

```txt
clipeshare/
  app/
    (public)/
      page.tsx
      posts/
        [id]/
          page.tsx
      search/
        page.tsx
      users/
        [username]/
          page.tsx
      games/
        [slug]/
          page.tsx
      tags/
        [slug]/
          page.tsx
    (auth)/
      login/
        page.tsx
    (app)/
      posts/
        new/
          page.tsx
        [id]/
          edit/
            page.tsx
      bookmarks/
        page.tsx
      settings/
        profile/
          page.tsx
        account/
          page.tsx
        age-verification/
          page.tsx
    admin/
      page.tsx
      posts/
        page.tsx
      comments/
        page.tsx
      reports/
        page.tsx
      users/
        page.tsx
      tags/
        page.tsx
      games/
        page.tsx
      admins/
        page.tsx
      upload-limits/
        page.tsx
      audit-logs/
        page.tsx
    api/
      auth/
        [...nextauth]/
          route.ts
      posts/
        route.ts
        [id]/
          route.ts
          like/
            route.ts
          bookmark/
            route.ts
          comments/
            route.ts
          replace-media/
            route.ts
          thumbnail/
            route.ts
      search/
        route.ts
      reports/
        route.ts
      admin/
        posts/
          route.ts
        users/
          route.ts
        reports/
          route.ts
  components/
    ui/
    layout/
    media/
    posts/
    comments/
    profile/
    admin/
    forms/
  lib/
    auth/
      config.ts
      permissions.ts
    db/
      prisma.ts
    media/
      storage.ts
      ffmpeg.ts
      hls.ts
      thumbnails.ts
      validation.ts
    search/
      parse-query.ts
      search-posts.ts
    moderation/
      ng-word.ts
      reports.ts
      nsfw.ts
    ogp/
      metadata.ts
    jobs/
      queue.ts
      video-worker.ts
    utils/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  public/
    icons/
    manifest.webmanifest
    images/
      ogp-default.webp
      nsfw-placeholder.webp
  storage/
    uploads/
    temp/
  scripts/
    worker.ts
    cleanup-temp.ts
  docs/
    overall-design.md
    deployment-checklist.md
    moderation-policy.md
  tests/
    unit/
    integration/
    e2e/
  package.json
  next.config.ts
  tailwind.config.ts
  tsconfig.json
```

## 10. 技術選定理由

### 10.1 第一候補: Next.js App Router + TypeScript

採用理由:

- 投稿詳細ページごとのOGP / Twitter Card生成と相性が良い
- React Server Componentsにより、一覧や詳細の初期表示を高速化しやすい
- App Routerでページ、API、メタデータを同一プロジェクト内に整理できる
- TypeScriptにより投稿、権限、検索条件、管理操作の型安全性を確保しやすい
- shadcn/uiとTailwind CSSでダークテーマの管理画面と投稿UIを効率よく構築できる

注意点:

- VPSでNode.jsプロセスを常時起動できる必要がある
- FTPのみのレンタルサーバーでは運用が難しい
- FFmpegの実行とバックグラウンドジョブが必要
- HLSファイルの静的配信設定が必要

### 10.2 UI: Tailwind CSS + shadcn/ui

採用理由:

- ダークテーマを前提にしたUI構築がしやすい
- 投稿カード、モーダル、フォーム、テーブル、管理画面部品を揃えやすい
- Radix UIベースのアクセシビリティを活かせる
- スマホ対応のレスポンシブ実装と相性が良い

デザイン方針:

- ゲーマー向けの暗色ベース
- メディアが主役
- 余白は取りつつ、PCでは情報密度を確保
- スマホでは縦スクロールのメディアフィードを重視
- 投稿カードは動画 / 画像サムネイルを大きく表示
- 管理画面は実用性重視で、テーブル、フィルタ、ステータスバッジを中心にする

### 10.3 DB: MySQL / MariaDB

採用理由:

- VPSや一般的なサーバーで利用しやすい
- WordPressが動く環境ならDBが用意されている可能性が高い
- Prismaとの相性が良い
- 初期規模では十分な検索、集計、リレーション管理が可能

### 10.4 ORM: Prisma

採用理由:

- TypeScriptとの型連携が強い
- Auth.js Adapterが利用しやすい
- マイグレーション管理がしやすい
- 複雑な管理画面や投稿権限でも型安全に扱える

注意点:

- サーバー環境によってはPrisma Clientの生成、Node.jsバージョン、バイナリ互換性を確認する必要がある
- 高度な検索や集計では生SQLを併用する可能性がある

### 10.5 認証: Auth.js

採用理由:

- Discord OAuthに対応しやすい
- メールログインに対応できる
- Prisma Adapterを使える
- Next.js App Routerと統合しやすい

### 10.6 動画処理: FFmpeg + HLS

採用理由:

- 一般的な動画形式の変換に強い
- HLSに変換することでブラウザ再生とスマホ再生に対応しやすい
- サムネイル生成、メタデータ取得、解像度変換が可能

初期方針:

- まずは単一画質HLS
- 将来的に複数画質HLSへ拡張
- 変換ジョブはWebリクエスト内で同期実行せず、バックグラウンドで処理する

### 10.7 保存: 初期はローカル保存

採用理由:

- DockerやCloudflareを使わない前提で始めやすい
- VPS上のディスクに保存できる
- Nginxなどで静的配信しやすい

注意点:

- サーバー容量の監視が必須
- バックアップ方針が必要
- 将来的にS3互換ストレージなどへ移行できる抽象化を入れる

### 10.8 代替案: Laravel + MySQL

Next.jsを常時起動できないサーバー、SSHがないサーバー、Node.js運用が難しいサーバーではLaravel構成を代替案にします。

| 項目 | Next.js構成 | Laravel構成 |
| --- | --- | --- |
| 必要環境 | Node.js常時起動、SSH推奨 | PHP、Composer、Webサーバー |
| FTPのみ運用 | 難しい | 比較的可能 |
| OGP生成 | 得意 | 可能 |
| PWA | 得意 | 可能 |
| 動画処理 | FFmpegジョブが必要 | FFmpegジョブが必要 |
| HLS配信 | Nginx静的配信で対応 | Nginx / Apache静的配信で対応 |
| UI開発 | Reactで高度に作りやすい | Blade + Livewire / Inertiaで対応 |
| 認証 | Auth.js | Laravel Breeze / Socialite |
| Discord OAuth | Auth.js Provider | Laravel Socialite |
| メールログイン | Auth.js Email Provider | Laravel標準機能 |
| 管理画面 | 自作 | Filamentが使える |
| 開発速度 | フロント主導なら速い | 管理画面込みなら速い |

判断基準:

- Node.jsを常時起動でき、SSHがあり、FFmpegを実行できるならNext.js構成を採用
- FTP中心でPHPしか安定運用できないならLaravel構成を検討
- 管理画面を短期間で強く作りたい場合はLaravel + Filamentも有力
- メディア中心のモダンなUIとOGP制御を重視するならNext.jsを優先

### 10.9 KAGOYAレンタルサーバー前提の代替案

KAGOYAレンタルサーバーでNode.js常時起動やFFmpeg常駐処理が難しい場合は、以下の順で代替案を検討します。

#### 案A: KAGOYA CLOUD VPS + Next.js

推奨度: 高

Next.js App Router、Auth.js、Prisma、FFmpeg、HLS、バックグラウンドワーカーを当初設計のまま実装する構成です。VPSであればサーバー管理権限を使って必要な実行環境を構築できるため、本サービスの要件に最も合います。

向いている条件:

- Node.jsを常時起動できる
- SSHでデプロイできる
- FFmpegをインストールできる
- pm2またはsystemdでWebアプリとワーカーを管理できる
- HLSファイルをNginxなどで静的配信できる

#### 案B: KAGOYAレンタルサーバー + Laravel + MySQL

推奨度: 中

KAGOYAレンタルサーバー上でPHP/MySQL中心に構築する案です。管理画面はLaravel + Filamentを使うと短期間で作りやすくなります。Discord OAuthはLaravel Socialite、メールログインはLaravel標準のメール送信機能で実装します。

注意点:

- FFmpegを実行できるか確認が必要
- cronで動画変換ジョブを回せるか確認が必要
- 長時間の動画変換をWebリクエスト内で実行しない設計が必要
- Node.js前提のNext.js UIではなく、Blade / Livewire / Inertiaなどへ寄せる必要がある

#### 案C: KAGOYAレンタルサーバー + Laravel + 外部動画処理

推奨度: 中

Web本体はKAGOYAレンタルサーバー上のLaravelで動かし、動画変換だけ別のVPSや処理用サーバーへ逃がす案です。KAGOYAレンタルサーバーでFFmpegや長時間ジョブが難しい場合の現実的な逃げ道です。

構成例:

- Web本体: KAGOYAレンタルサーバー + Laravel + MySQL
- 動画処理: 小さなVPS上のFFmpegワーカー
- ファイル同期: SFTP、rsync、またはジョブAPI

注意点:

- 構成が複雑になる
- ファイル転送失敗時のリトライ設計が必要
- Web側と動画処理側の状態同期が必要

#### 案D: KAGOYAレンタルサーバー + 画像投稿先行

推奨度: 低から中

初期リリースをスクリーンショット共有中心にして、動画投稿はサーバー移行後またはVPS追加後に実装する案です。サービス検証は早いですが、クリップ共有サイトとしての価値は弱くなります。

向いている条件:

- まずデザイン、ログイン、投稿、OGP、プロフィール、管理画面を検証したい
- 動画処理環境がまだ確保できていない
- 初期費用を抑えたい

判断:

- クリップ動画をMVP必須にするなら案Aを推奨
- 既存のKAGOYAレンタルサーバーを必ず使うなら案Bまたは案C
- 環境不明のまま進めるなら、まずPhase 0でKAGOYAの実行可否を確認する

### 10.10 SSL構成

KAGOYA CLOUD VPSで運用するため、SSLは既存設定済み前提ではなく、VPS上でセットアップします。

採用構成:

- Nginx
- Certbot
- Let's Encrypt

方針:

- HTTPはHTTPSへリダイレクトする
- 投稿詳細URLはHTTPSを正式URLにする
- OGP画像URLはHTTPSの絶対URLにする
- HLS配信URLもHTTPSにする
- 証明書更新はCertbotの自動更新を使う
- 更新確認として `certbot renew --dry-run` を実行する

### 10.11 GitHub自動デプロイ

GitHubのmainブランチへpushされた内容を、KAGOYA CLOUD VPSへ自動反映できる構成にします。

採用構成:

- GitHub Actions
- SSH
- systemd
- `scripts/deploy-server.sh`

デプロイの流れ:

1. GitHubのmainブランチへpushする
2. GitHub Actionsが起動する
3. GitHub ActionsがVPSのdeployユーザーへSSH接続する
4. VPS上で `git fetch` と `git reset --hard origin/main` を実行する
5. `npm ci` を実行する
6. Prisma migrationを適用する
7. `npm run build` を実行する
8. systemdでWebアプリとworkerを再起動する

GitHub Secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_PRIVATE_KEY`

注意:

- GitHubから自動反映するには、VPS側にdeployユーザー、SSH鍵、GitHubへアクセスできるdeploy keyまたはHTTPS clone設定が必要
- `.env.production` はGitHubに置かず、VPS上の `/var/www/clipeshare/shared/.env.production` に置く
- DB migrationは自動実行するため、破壊的migrationを入れる場合は事前確認が必要
- アプリコードが未完成の段階ではsystemd serviceの起動に失敗するため、初回デプロイはアプリ基盤作成後に行う

## 11. 実行環境要件

### 11.1 必須チェック項目

| チェック項目 | 必須度 | 確認内容 | Next.js採用判断 |
| --- | --- | --- | --- |
| Node.jsを常時起動できるか | 必須 | `node` プロセスを常駐できるか | 不可ならNext.js運用は困難 |
| SSHアクセスがあるか | 強く推奨 | npm install、build、pm2設定ができるか | ない場合は運用難度が高い |
| FFmpegを実行できるか | 必須 | `ffmpeg` コマンドが使えるか | 不可なら動画投稿は成立しにくい |
| pm2 / systemd / cronなどでバックグラウンド処理を動かせるか | 必須 | Webアプリ、動画変換ワーカー、定期削除を動かせるか | 不可なら動画変換が不安定 |
| メールログイン用SMTPを使えるか | 必須 | SMTPホスト、ポート、認証情報があるか | 不可ならメールログイン不可 |
| アップロード可能な最大ファイルサイズ | 必須 | Webサーバー、Node.js、プロキシ、PHP制限を確認 | 低すぎる場合は動画投稿不可 |
| サーバー容量 | 必須 | 元動画、HLS、サムネイルを保存できる容量 | 少ない場合は制限を厳しくする |
| HLSファイルを静的配信できるか | 必須 | `.m3u8` とセグメントを正しいMIMEで配信できるか | 不可なら動画再生に問題 |

### 11.2 推奨サーバー要件

MVP初期の目安:

- Node.js 20 LTS以上
- MySQL 8 または MariaDB 10.6以上
- FFmpeg 6系以上
- メモリ 2GB以上
- ストレージ 100GB以上
- SSHアクセス
- NginxまたはApacheの設定変更権限
- pm2またはsystemdが利用可能
- cronが利用可能
- SMTP利用可能

### 11.3 Webサーバー設定で確認すること

- 最大アップロードサイズ
- リクエストタイムアウト
- 静的ファイル配信パス
- HLSのMIME Type
- HTTPS設定
- gzip / brotli
- Range Request対応

HLSのMIME Type例:

```txt
.m3u8  application/vnd.apple.mpegurl
.ts    video/mp2t
.m4s   video/iso.segment
.mp4   video/mp4
.webp  image/webp
```

### 11.4 バックグラウンド処理

必要な常駐 / 定期処理:

- Next.jsアプリ本体
- 動画変換ワーカー
- 失敗ジョブの再試行
- 一時ファイル削除
- 削除済みメディアの遅延削除
- 集計キャッシュ更新

pm2を使う場合のプロセス例:

```txt
clipeshare-web
clipeshare-worker
clipeshare-cleanup
```

### 11.5 FTPのみの場合の注意

FTPしか使えない場合、Next.jsの本番運用はかなり難しくなります。特に以下が問題になります。

- `npm install` と `next build` の実行
- Node.jsプロセスの常時起動
- FFmpegの実行
- ワーカーの常駐
- ログ確認
- デプロイ時の権限調整

この場合はLaravel + MySQL構成を現実的な代替案として検討します。

## 12. MVP開発フェーズ分け

### Phase 0: 環境確認

目的:

- Next.js構成が実行可能か判断する

実施内容:

- Node.js常時起動可否確認
- SSH確認
- FFmpeg確認
- DB確認
- SMTP確認
- アップロード上限確認
- HLS静的配信確認

完了条件:

- Next.jsで進めるか、Laravelへ切り替えるか判断できる

### Phase 1: 基盤構築

実施内容:

- Next.js App Routerセットアップ
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- MySQL接続
- Auth.js
- Discordログイン
- メールログイン
- 基本レイアウト
- ダークテーマ
- PWA基本設定

完了条件:

- ログイン、ログアウト、DB接続、PWA manifestが動く

### Phase 2: 投稿基盤

実施内容:

- 投稿DB
- ゲーム名DB
- タグDB
- 動画アップロード
- 画像アップロード
- アップロード制限
- 投稿作成画面
- 投稿詳細画面
- クリップ一覧
- サムネイル生成

完了条件:

- 動画 / スクリーンショットを投稿し、一覧と詳細で閲覧できる

### Phase 3: 動画処理

実施内容:

- FFmpeg変換
- HLS生成
- サムネイル自動生成
- 変換ジョブ
- 失敗時ステータス
- 動画差し替え

完了条件:

- アップロード動画がHLSで再生できる

### Phase 4: コミュニティ機能

実施内容:

- いいね
- コメント
- ブックマーク
- フォロー
- プロフィール
- 投稿数
- 総いいね数
- よく投稿するゲーム
- SNSリンク

完了条件:

- ログインユーザーが投稿へ反応でき、プロフィールに反映される

### Phase 5: 検索とタイムライン

実施内容:

- タイムライン並び替え
- 新着順
- 人気順
- 再生数順
- いいね順
- コメント数順
- 週間
- 月間
- キーワード検索
- `game:`
- `tag:`
- `from:`
- `type:`

完了条件:

- MVP範囲の検索演算子と並び替えが動く

### Phase 6: 共有とOGP

実施内容:

- 投稿詳細メタデータ
- OGP
- Twitter Card
- URLコピー
- X共有
- Discord共有
- 埋め込みコード
- NSFW時のOGP制御

完了条件:

- DiscordやXでURLを共有したときに適切なカード表示になる

### Phase 7: 管理画面とモデレーション

実施内容:

- 管理ダッシュボード
- 投稿管理
- コメント管理
- 通報管理
- ユーザーBAN
- BAN理由
- 通報対応ステータス
- タグ管理
- ゲーム名管理
- 管理者追加
- 管理者操作ログ
- アカウントレベル変更
- アップロード制限変更
- NGワード
- NSFW指定 / 解除

完了条件:

- 不適切投稿への最低限の運用対応ができる

### Phase 8: スマホ最適化とリリース準備

実施内容:

- スマホUI調整
- PWA確認
- 投稿フォームのスマホ対応
- 管理画面の最低限レスポンシブ対応
- エラーページ
- 利用規約
- プライバシーポリシー
- セキュリティ確認
- バックアップ手順

完了条件:

- 一般公開できる最低限の安定性と運用手順がある

## 13. Codexで実装する順番

Codexで実装する場合は、動く単位を小さく区切り、各段階で起動確認と最低限の動作確認を行います。

### 13.1 推奨順

1. リポジトリ初期化とNext.js基盤作成
2. Tailwind CSS + shadcn/ui導入
3. Prisma + MySQL接続
4. Auth.js + Discordログイン
5. Auth.js + メールログイン
6. 基本レイアウト、ダークテーマ、ナビゲーション
7. ユーザーモデル、プロフィール編集
8. ゲーム名、タグのDBと管理用シード
9. 投稿モデル作成
10. 画像投稿を先に実装
11. 投稿一覧、投稿詳細
12. OGP / Twitter Card生成
13. 動画アップロードの保存処理
14. FFmpegでサムネイル生成
15. FFmpegでHLS変換
16. 変換ジョブとステータス管理
17. いいね
18. コメント
19. ブックマーク
20. フォロー
21. プロフィール集計
22. 検索クエリパーサー
23. 検索画面
24. タイムライン並び替え
25. 通報
26. 管理画面の土台
27. 投稿管理
28. コメント管理
29. 通報管理
30. ユーザーBAN
31. 管理者操作ログ
32. アカウントレベルとアップロード制限管理
33. NSFW表示制御
34. NGワード
35. PWA対応
36. スマホUI調整
37. 本番デプロイ手順書作成
38. 本番環境チェック

### 13.2 実装上の優先判断

最初は動画より画像投稿を先に通します。理由は、認証、投稿、一覧、詳細、OGP、プロフィール、管理画面の基本動線を動画変換に依存せず検証できるためです。

次に動画の保存、サムネイル生成、HLS変換を段階的に追加します。動画処理は環境依存が強いため、Web投稿機能と切り離して検証できる構成にします。

管理画面と通報はMVP必須のため、後回しにしすぎない方針にします。一般公開サイトでは、投稿機能だけ先に公開すると運用リスクが高くなります。

## 14. 未確定事項

### 14.1 サービス名

- 未定
- 仕様とデザイン方針が固まった後に決定する

### 14.2 URL設計

決定:

- `/c/{ID}`

投稿詳細ページは `/c/{ID}` を正式URLにします。DiscordやXで共有しやすく、短く、クリップ共有サイトとして意味も伝わりやすい構成です。

### 14.3 投稿ID形式

決定:

- `nanoid`

公開URLに使うIDは `nanoid` とします。数値IDより推測されにくく、URLも短くできます。DB内部IDは別に持たせてもよく、公開用IDとして `public_id` を持つ設計を推奨します。

### 14.4 メールログイン方式

決定:

- メールリンクログイン

MVPではパスワードログインを実装せず、メールリンクログインにします。パスワード再設定、パスワード強度、ハッシュ管理の実装範囲を抑えられます。

### 14.5 動画画質

MVP:

- 単一画質HLS

将来:

- 1080p / 720p / 480pの複数画質HLS
- アカウントレベル別の上限解像度

### 14.6 NSFW年齢確認方式

決定:

- 未ログインユーザーにはNSFW投稿を非表示にする
- ログインユーザーは自己申告でNSFW表示を許可できる
- 初期状態ではNSFW投稿をぼかし表示にし、表示ボタンを押すと閲覧できる
- タイムラインではNSFW非表示を初期値にする

MVPでは自己申告方式とします。ただし、法的要件や運用ポリシーに応じて、生年月日入力やより厳格な確認方式へ変更できる余地を残します。

### 14.7 禁止コンテンツポリシー

NSFWは許可しますが、犯罪系コンテンツはNSFWであっても投稿不可とします。禁止範囲は利用規約とモデレーションポリシーで明文化します。

### 14.8 サーバー実行可否

現時点では以下が未確定です。

- Node.js常時起動の可否
- SSHアクセスの有無
- FFmpeg実行可否
- バックグラウンドワーカー実行可否
- SMTP利用可否
- アップロードサイズ上限
- サーバー容量
- HLS静的配信可否

これらが確定するまで、Next.js構成で本番運用できるかは未確定です。

### 14.9 検索基盤

MVP:

- MySQL + LIKE + リレーション検索

将来候補:

- MySQL FULLTEXT
- Meilisearch
- Typesense
- Elasticsearch / OpenSearch

### 14.10 ストレージ拡張

MVP:

- ローカル保存

将来候補:

- S3互換ストレージ
- 専用メディアサーバー
- CDN

Cloudflareは使わない前提のため、別CDNやオブジェクトストレージを使う場合は改めて設計します。

## 15. リスクと対策

### 15.1 サーバーがNext.js常時起動に対応していない

リスク:

- FTPのみ、Node.js常時起動不可の場合、Next.js本番運用が難しい

対策:

- Phase 0で環境確認を最優先する
- Node.js不可ならLaravel + MySQLへ切り替える
- 管理画面重視ならLaravel + Filamentを検討する

### 15.2 FFmpegが実行できない

リスク:

- 動画変換、HLS生成、サムネイル生成ができない

対策:

- Phase 0で `ffmpeg -version` を確認する
- 実行不可なら動画投稿のMVPが成立しないため、サーバー変更またはLaravelでも同様に環境変更が必要
- 一時的に画像投稿のみで検証する選択肢を残す

### 15.3 アップロード容量制限が小さい

リスク:

- 3分動画でもアップロードできない

対策:

- Webサーバー、アプリ、プロキシの最大アップロードサイズを確認する
- アカウントレベルごとの制限をDB管理にする
- 動画時間、サイズ、解像度を初期は控えめにする

### 15.4 ストレージ容量不足

リスク:

- 元動画、HLS、サムネイルで容量が急増する

対策:

- 元動画の保持期間をDBで設定する
- HLS変換後の元動画は初期45日保持し、その後削除する
- 削除済みファイルの遅延削除ジョブを作る
- 削除済みファイル保持期間はDBで管理し、初期45日とする
- 管理画面で使用量を確認できるようにする
- 将来的なS3互換ストレージ移行を見据えてストレージ層を抽象化する

### 15.5 不適切投稿や通報対応の運用負荷

リスク:

- 一般公開サイトではスパム、不適切投稿、嫌がらせが発生する

対策:

- 通報機能をMVPに含める
- 管理画面をMVPに含める
- NGワード、BAN、投稿非公開化、コメント削除を実装する
- 管理者操作ログを残す
- 利用規約と禁止コンテンツを明文化する

### 15.6 NSFW運用の法的・運用リスク

リスク:

- 年齢確認、表示制限、禁止コンテンツ判定が不十分だと問題になる

対策:

- NSFWフラグを投稿に持たせる
- 年齢確認していないユーザーには表示制限する
- タイムラインではNSFW非表示を初期値にする
- 管理者がNSFW指定 / 解除できるようにする
- 禁止コンテンツはNSFWでも投稿不可と明記する
- 法的に問題がある可能性のあるカテゴリは投稿禁止にする

### 15.7 OGPが正しく表示されない

リスク:

- DiscordやXで共有してもサムネイルや説明が表示されず、共有体験が弱くなる

対策:

- 投稿詳細ページでサーバーサイドにメタタグを生成する
- 絶対URLで `og:image` を出す
- サムネイル画像を外部クローラーが取得できるようにする
- 非公開、削除、NSFWのOGP挙動を明確にする
- DiscordとXで実際に検証する

### 15.8 検索演算子の仕様が複雑化する

リスク:

- 検索構文が増えるとパーサーとSQL生成が複雑になる

対策:

- MVPでは `game:`, `tag:`, `from:`, `type:` に限定する
- 検索クエリパーサーを独立モジュールにする
- 未対応演算子は通常キーワードとして扱うか、明示的に無視する

### 15.9 動画変換中のUXが悪くなる

リスク:

- 投稿後にすぐ見られず、ユーザーが失敗と誤解する

対策:

- 投稿ステータスを表示する
- 変換中はプレースホルダーを表示する
- 変換失敗時は再試行または再アップロード導線を出す
- 管理画面で失敗ジョブを確認できるようにする

### 15.10 管理者権限の誤操作

リスク:

- 投稿削除、BAN、制限変更などの操作ミスが発生する

対策:

- 管理者操作ログを必ず残す
- 重要操作には確認ダイアログを出す
- BAN理由、非公開理由、通報対応理由を保存する
- Owner権限とAdmin権限を分ける

### 15.11 PWAと動画再生の相性

リスク:

- Service WorkerがHLSやメディアファイルを不適切にキャッシュし、再生不具合や容量圧迫を起こす

対策:

- HLSセグメントは基本的にService Workerキャッシュ対象外にする
- アプリシェルとアイコンなど最低限だけキャッシュする
- オフライン時は投稿閲覧不可の案内を出す

### 15.12 初期から機能範囲が広い

リスク:

- MVPに管理画面、通報、PWA、OGP、動画処理が含まれるため、実装量が多い

対策:

- 画像投稿から先に通す
- 動画処理を段階的に追加する
- 管理画面は最初から最低限の運用機能に絞る
- 検索演算子はMVP対象に限定する
- Phaseごとに起動確認と動作確認を行う
