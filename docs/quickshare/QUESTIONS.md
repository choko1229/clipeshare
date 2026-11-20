# QUESTIONS（暫定判断と質問の記録）

自走中に仕様の穴・判断に迷う点があれば、ここに追記して**暫定案で先へ進む**。人が後で確認する。

形式:
```
## Q-001 (日付) 件名
- 状況:
- 選択肢と採用した暫定案（理由）:
- 影響範囲（ファイル/画面/API）:
- 人に確認したいこと:
- 状態: 未確認 / 確認済み（回答: …）
```

## 現行コード調査メモ（Step 0 で記入 / 2026-11-21）

### ① `POST /api/qick/upload`（`app/api/qick/upload/route.ts` → `lib/quick-share/create-quick-share.ts`）
- `request.formData()` でボディ全体をメモリに読み込む（フィールド名 `media`）。認証は `getServerSession`（Cookie）のみ。成功時 `{ redirectUrl: "/qick?created=<id>" }`、失敗時は 400 `{ error: "<日本語>" }`。
- 種別判定: `detectMediaKind()`（MIME の `image/*`/`video/*` か拡張子）。**マジックバイト検証なし**。
- サイズ上限: **ログイン有無に関係なく** SiteSetting の `quick_share_max_image_bytes`（既定 20,000,000）/ `quick_share_max_video_bytes`（既定 200,000,000）。AccountLevel のサイズ列は投稿用で、クイック共有では使っていない。
- IP ハッシュ: `lib/quick-share/ip-hash.ts`。`x-forwarded-for` 先頭 → `x-real-ip` → `"unknown"` を `${ip}:${AUTH_SECRET|NEXTAUTH_SECRET|固定値}` で SHA-256。匿名のときだけ保存（ログイン時は `ipHash=null`）。
- **1日上限の数え方**（`lib/quick-share/rate-limit.ts` `assertQuickShareRateLimit`）:
  - ログイン: `AccountLevel.dailyUploadLimit`（`null`=無制限。投稿と同じ列を流用）に対し `QuickShare.count({ userId, createdAt >= サーバーローカル時刻の当日0時 })`。
  - 匿名: SiteSetting `quick_share_anonymous_daily_limit`（既定5）に対し `QuickShare.count({ ipHash, createdAt >= 当日0時 })`。
  - 削除済み（`deletedAt`あり）・失敗も**数に含む**（行数で数える）。リセットはサーバーのローカル時刻の0時（`setHours(0,0,0,0)`）。
- 画像処理（`lib/media/quick-share.ts` `storeQuickShareImage`）: `sharp(bytes,{failOn:"none"}).rotate()` → `resize(2000 × (2000-65), inside, withoutEnlargement)` → 下部にバナー（`public/images/quick-share-ad-banner.png`、幅合わせ）を合成 → WebP q88。**ログイン有無に関係なくバナーあり**。`limitInputPixels` は sharp 既定（268,402,689px）。メタデータ系の呼び出しなし。
- 保存名は `publicId`（nanoid(10)）。deleteToken は nanoid(24)、Cookie `qs_uploads` に保存。

### ② 保存場所
- `QuickShare`: `prisma/schema.prisma`（publicId unique, deleteToken, kind, status, mediaUrl, thumbnailUrl, originalPath, userId, ipHash, expiresAt, deletedAt。`@@index([userId, createdAt])`, `@@index([ipHash, createdAt])`）。
- AccountLevel: 投稿用の `maxVideoSizeBytes`/`maxImageSizeBytes`（BigInt バイト）、`dailyUploadLimit Int?`。管理画面 `/admin/account-levels` で MB 単位入力。
- 匿名上限・サイズ・保存時間: `SiteSetting`（key/value）。管理画面 `/admin/quick-share`。

### ③ 動画の非同期処理
- 原本を `quickShareOriginalRoot/videos/<publicId>.<ext>` に保存 → `QuickShare(status=PROCESSING)` と `UploadJob(QUEUED)` を作成 → `scripts/video-worker.mjs`（systemd の別プロセス）が ffmpeg で mp4 と サムネイル（`/media/quick/thumbnails/<id>.webp`）を作り `READY` に更新、失敗時 `FAILED`。
- 処理中も `/q/{id}` は原本を返す（`app/q/[id]/route.ts`）。→ 契約「URL は即時共有可能、`status: PROCESSING` で返ることがある」は**現行と一致**。

### ④ NextAuth・管理画面
- NextAuth v4.24（`auth.ts`）、`session.strategy = "database"`、Discord / X(OAuth2) / Email。`pages.signIn = "/login"`。`/login` は `callbackUrl` を見ず、ログイン後は常に `/`。
- `VerificationToken` は Email プロバイダが使用中。
- 管理画面: `app/admin/*`（`requireModerator`/`requireAdmin`）。変更は Server Action（`app/admin/actions.ts`）→ `writeAuditLog()`（`AdminAuditLog` テーブル）。
- 参考: Discord ボット用 `app/api/bot/*` は `Authorization: Bearer <env secret>` の単純比較。
- `middleware.ts`/`proxy.ts` なし。本番は systemd の単一プロセス `npm run start` ＋ nginx（`client_max_body_size 512m`）。`scripts/deploy-server.sh` は `prisma migrate deploy` を自動実行する。

### ⑤ テスト基盤
- 既存のテストなし。**vitest を導入**（`vitest.config.ts`、`npm test` = `vitest run`、`tests/**/*.test.ts`）。DB に依存するロジックは prisma をモックして検証する。

### 現状のビルド状態（Step 0 時点）
- `npm.cmd ci` 後、npm 11 の install-scripts 制限で `prisma generate` が走らないため手動で `npx prisma generate` が必要（既存の環境要因）。その後 `typecheck`/`lint`/`build` は通過。

---

## Q-001 (2026-11-21) クイック共有のサイズ上限をどこに持つか（レベル別）
- 状況: 現行はログイン有無に関係なくサイト全体設定のみ。SPEC は「ツール用はレベル別設定（AccountLevel）、0=無制限、初期値は現行ログイン上限を引き継ぐ」。デザイン20は「クイック共有の上限は、投稿用の上限とは別に設定します。0 を入れると無制限になります。ツール経由のアップロードにも同じ上限が使われます。」「サイト全体の初期値です。未ログインの利用と、レベル別の設定がないときに使います。」で、レベル一覧に「クイック共有 画像MB / 動画MB」の2列のみ。
- 暫定案: AccountLevel に `quickShareImageMaxBytes BigInt?` / `quickShareVideoMaxBytes BigInt?` を追加（`0`=無制限、`NULL`=サイト全体設定を使う）。**ログイン中のWebクイック共有とトークン経由APIの両方**に適用（デザイン20の文言どおり）。マイグレーションで既存レベルに「現行のログイン上限（＝サイト全体設定の現在値。画像は Q-003 の 50MB 反映後）」をコピーするので、**移行直後の実効値は現行と同じ**＝Web の挙動は変わらない。
- 影響範囲: `prisma/schema.prisma`、`lib/quick-share/limits.ts`、`lib/quick-share/create-quick-share.ts`、`/admin/account-levels`、`/admin/quick-share`。
- 人に確認したいこと: レベル別上限を Web のログイン中クイック共有にも効かせてよいか（デザイン20の文言どおりの解釈）。API だけに限定する場合は `create-quick-share.ts` の1行を戻すだけ。
- 状態: 未確認

## Q-002 (2026-11-21) ツール用の1日上限
- 状況: INSTRUCTIONS は例として `toolDailyLimit` を挙げるが、SPEC は「数え方は現行Clipshareに合わせる（コードで確認して再利用）」、デザイン20のレベル一覧には日次はクイック共有用の列がなく既存の「日次投稿上限」だけ。
- 暫定案: 新しい列は作らず、現行と同じ `AccountLevel.dailyUploadLimit` と同じ数え方（`QuickShare` を userId/ipHash で当日0時以降カウント）を共通関数化して Web/API で共用する。API の `dailyLimit` は `null`→`0`（無制限）で返す。Web とツールのアップロードは同じ枠を共有する。
- 影響範囲: `lib/quick-share/rate-limit.ts`（関数分割のみ、Web のメッセージ・判定は不変）、`/api/v1/me`、`/api/v1/quick`。
- 人に確認したいこと: ツール専用の日次上限が必要か。
- 状態: 未確認

## Q-003 (2026-11-21) 画像上限 20MB→50MB の反映方法
- 状況: サイト全体設定は SiteSetting（DB）。値が保存されていれば既定値の変更だけでは反映されない。
- 暫定案: コードの既定値を 50,000,000 に変更し、マイグレーションで `quick_share_max_image_bytes` が**旧既定値 `20000000` のときだけ** `50000000` に更新（管理者が別の値を設定していれば触らない）。デザイン20の「現在の初期値は20MBです。」は移行後に事実と合わなくなるため表示しない。
- 影響範囲: `lib/quick-share/settings.ts`、マイグレーション SQL。Web の匿名・ログイン中クイック共有の画像上限も 50MB になる（SPEC 確定事項）。
- 人に確認したいこと: なし（確定事項の反映）。
- 状態: 未確認

## Q-004 (2026-11-21) 認可フローの一時データの保存先
- 状況: INSTRUCTIONS は「専用テーブル or VerificationToken 流用のどちらが保守的か検討して提示」。
- 暫定案: **専用テーブル `ApiAuthorization`** を新設。VerificationToken は NextAuth の Email ログインが使っており、流用すると識別子の衝突・期限切れ掃除の相互干渉の恐れがあるため。1行=1回の認可要求（接続コード、PKCE challenge、redirect_uri、state、CSRF トークンのハッシュ、認可コードのハッシュ、期限、使用済み時刻）。
- 影響範囲: `prisma/schema.prisma`、`lib/api-auth/*`。
- 状態: 未確認

## Q-005 (2026-11-21) NextAuth への認可フロー組み込み設計
- 状況: INSTRUCTIONS「実装前に設計案を提示して承認を得る」。自走ルールに従い、ここに設計を記録して進める。
- 暫定案:
  1. `GET /qick/authorize`（App Router の画面）でパラメータを zod 検証。`redirect_uri` が不正なら**リダイレクトせず**「このリンクは使えません」を表示。
  2. 未ログインなら `/login?callbackUrl=<authorize のURL>` へ。`/login` は `callbackUrl` が**同一オリジンの相対パス**のときだけそれを使い、無ければ従来どおり `/`（既存挙動は不変）。NextAuth 自体の設定（プロバイダ・コールバック）は変更しない。
  3. ログイン済みなら `ApiAuthorization` を作成（同じ `code_challenge` の要求が同じユーザーで未処理なら再利用＝再読込で増えない／処理済み・期限切れ・別ユーザーなら「このリンクは使えません」）。CSRF トークン（32バイト乱数）を発行してハッシュを保存し、hidden で埋め込む。
  4. 「許可する」「キャンセル」は通常の HTML フォーム POST で `POST /qick/authorize/decision`（Route Handler）へ。検証: セッションのユーザー＝要求のユーザー、CSRF トークン（定数時間比較）、`Origin` が自サイト、未処理・期限内、トークン発行が有効。許可→認可コード（32バイト）を発行してハッシュ保存し `303 {redirect_uri}?code&state`、キャンセル→`303 {redirect_uri}?error=access_denied&state`。
  5. `POST /api/v1/auth/token` で code / code_verifier / redirect_uri を検証してトークン発行（使い捨ては `updateMany(where usedAt=null)` で原子的に）。使用済みコードの再提示時は、そのコードで発行したトークンを失効させる（RFC 6749 §4.1.2 の推奨）。
- 影響範囲: `app/qick/authorize/*`、`app/login/page.tsx`、`components/auth/login-actions.tsx`、`lib/api-auth/*`。
- 人に確認したいこと: 上記設計でよいか。
- 状態: 未確認

## Q-006 (2026-11-21) 認可完了画面（デザイン07「連携が完了しました」）の出し方
- 状況: 契約上、許可後はブラウザが `redirect_uri`（クライアントのループバック）へ遷移するため、Clipshare 側で完了画面を直接出せない。
- 暫定案: `GET /qick/authorize/complete` を追加。クライアントはループバックでコードを受け取ったあと、ブラウザを `302 https://clipshare.link/qick/authorize/complete` へ戻す（**契約に追加**。任意。戻さなければクライアント自身のページを出してよい）。完了画面はログイン中ユーザーの直近10分以内に許可された要求の端末名を表示し、無ければ端末名なしで表示する。
- 影響範囲: `API_CONTRACT.md`（追加）、`app/qick/authorize/complete/page.tsx`、クライアント（`clipshare-qick`）のループバック応答。
- 状態: 未確認

## Q-007 (2026-11-21) 端末の OS 表記とアプリのバージョン（デザイン07/13）
- 状況: デザインに「DESKTOP-4N7QK · Windows 11 · v[VERSION]」とあるが、契約のパラメータは `device_name` のみ。
- 暫定案: 認可URLに任意パラメータ `device_platform`（最大32文字、例 `Windows 11`）を**追加**。バージョンは API 呼び出し時の `User-Agent: ClipshareQuick/<version> (...)` から取り出し、トークンの `clientVersion` に保存（最大32文字、英数と `.-+`のみ）。無ければ表示しない。
- 影響範囲: `API_CONTRACT.md`（追加）、`ApiToken`/`ApiAuthorization` の列。
- 状態: 未確認

## Q-008 (2026-11-21) 匿名 + `quality=original` のバナー
- 状況: INSTRUCTIONS Step3 に「`original` = …バナー無し」とあるが、SPEC は「匿名=バナーあり」。
- 暫定案: **匿名は画質に関係なくバナーあり**（original 指定でバナーを回避できないようにする）。トークンありは画質に関係なくバナーなし。
- 影響範囲: `/api/v1/quick`。
- 状態: 未確認

## Q-009 (2026-11-21) トークンで削除できる範囲
- 状況: デザイン07の許可内容は「このアプリでアップロードしたファイルの削除」。
- 暫定案: Bearer で削除できるのは「同じユーザーの、いずれかの API トークン経由でアップロードされたもの」（`QuickShare.apiTokenId` が非NULL かつ `userId` 一致）。Web でアップロードしたものや他人のものは 404。
- 影響範囲: `DELETE /api/v1/quick/{id}`、`QuickShare.apiTokenId` 列の追加。
- 状態: 未確認

## Q-010 (2026-11-21) レート制限の実装方式
- 状況: 本番は単一プロセス（systemd `npm run start`）。
- 暫定案: プロセス内メモリの固定ウィンドウ（1分）で、キーはトークンID（匿名はIPハッシュ）。値は SiteSetting（管理画面）で変更可。既定: トークン 30回/分、匿名 10回/分、認証失敗 20回/10分/IP（超過で 429 と警告ログ）。複数プロセス化する場合は共有ストアが必要（DEPLOY に記載）。
- 影響範囲: `lib/api/rate-limiter.ts`、`/api/v1/*`。
- 状態: 未確認

## Q-011 (2026-11-21) 管理者用「トークン管理」画面の画面案（実装前のテキスト提示）
- 状況: デザイン未作成。既存管理画面のトーン（`rounded-md border bg-card` のセクション、表形式の行、`Button variant="outline"/"destructive"`）に合わせる。
- 画面案（`/admin/api-tokens`、ナビ名「連携トークン」、ADMIN/OWNER のみ）:
  ```
  ┌ 連携トークン ───────────────────────────────┐
  │ [ユーザー名で絞り込み________] [有効のみ ▢] [検索] │
  ├──────────────────────────────────────────┤
  │ ユーザー | 端末名 | 先頭文字 | 作成 | 最終使用 | 状態 | [失効] │
  │ @choko1229 | DESKTOP-4N7QK | csq_Ab12 | 11/20 | 5分前 | 有効 | [失効] │
  │ @foo | LAPTOP-8QX2M | csq_Zx90 | 11/18 | 3日前 | 失効済み(管理者) | — │
  └──────────────────────────────────────────┘
  ```
  - トークン値・ハッシュは表示しない。失効はフォーム POST（Server Action）→ `revokedAt`/`revokedReason=admin` を設定し、`AdminAuditLog`（action `api_token.revoke`、targetType `api_token`、before/after に userId・端末名・prefix）に記録。最大100件表示、作成日の新しい順。
  - 同じページに「Clipshare Quick 連携の設定」（トークン発行の有効/無効＝緊急停止、レート制限値）を置く。
- 状態: 未確認（このまま実装）

## Q-012 (2026-11-21) ダウンロードページの掲載項目
- 状況: INSTRUCTIONS Step6 は「更新履歴、署名/信頼手順、動作環境」も挙げるが、デザイン01（正）にはそれらの区画がなく、CLAUDE.md は「UIに動作説明の文章を足さない（デザインにある文言のみ）」。
- 暫定案: デザイン01の構成・文言のみ実装。バージョン・サイズは GitHub Releases の取得結果、`[対応OS]` は管理画面の設定値（既定 `Windows 11`）。署名手順・更新履歴を載せる場合はデザイン追加後に対応。
- 影響範囲: `app/qick/download/page.tsx`。
- 状態: 未確認

## Q-013 (2026-11-21) `GET /api/v1/client/latest` の `sha256`
- 状況: GitHub Releases API の asset には `digest`（`sha256:<hex>`）が付く場合と付かない場合がある。
- 暫定案: `sha256` は `string | null`（取れないときは null）。**契約を更新**（型を nullable に明記）。クライアントは null のときハッシュ検証を MSIX の署名検証で代替する。
- 影響範囲: `API_CONTRACT.md`、`lib/quick-client/releases.ts`。
- 状態: 未確認

## Q-014 (2026-11-21) 「ログイン解除/アカウント削除時のトークン連動失効」の解釈
- 状況: Web のログアウトでトークンまで失効させると SPEC の「失効するまで有効」と矛盾する。
- 暫定案: Web のログアウトでは失効させない。アカウント削除は外部キー `onDelete: Cascade` でトークンも削除。BAN されたユーザーのトークンは API 側で即拒否（403 FORBIDDEN）。
- 影響範囲: `lib/api-auth/authenticate.ts`、スキーマ。
- 状態: 未確認

## Q-015 (2026-11-21) 上限 `0`（無制限）の実際の上限
- 状況: 0=無制限でも nginx の `client_max_body_size 512m` が実質の上限になる。
- 暫定案: アプリ側は 0 を無制限として扱い、nginx の値は DEPLOY 手順書に明記する（超過時 nginx が 413 を HTML で返すので、クライアントは JSON でない 413 も「サイズ超過」として扱う旨を契約に追記）。
- 影響範囲: `API_CONTRACT.md`、`docs/DEPLOY_QUICKSHARE.md`。
- 状態: 未確認

## Q-016 (2026-11-21) 原寸（original）の扱いの細部
- 状況: WebP は1辺 16383px が上限。
- 暫定案: `original` は回転補正 → 長辺が 16383px を超える場合のみ収まるよう縮小 → WebP q95（メタデータは付けない）。それ以外の寸法は変えない。
- 影響範囲: `lib/media/quick-share.ts`。
- 状態: 未確認
