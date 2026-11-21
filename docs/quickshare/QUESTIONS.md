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
- 状態: 確認済み（回答 2026-11-21: 1日上限の数え方は現在の実装のまま。Web と共有）

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
- 状態: 確認済み（回答 2026-11-21: DLページに「手順」と「更新履歴」を追加する。デザイン更新待ち。データ取得は準備済み → PROGRESS「D」）

## Q-013 (2026-11-21) `GET /api/v1/client/latest` の `sha256`
- 状況: GitHub Releases API の asset には `digest`（`sha256:<hex>`）が付く場合と付かない場合がある。
- 暫定案: `sha256` は `string | null`（取れないときは null）。**契約を更新**（型を nullable に明記）。クライアントは null のときハッシュ検証を MSIX の署名検証で代替する。
- 影響範囲: `API_CONTRACT.md`、`lib/quick-client/releases.ts`。
- 状態: 確認済み（回答 2026-11-21: sha256 は必ず返す → API 契約 v1.2。SHA256SUMS ＋手動登録、揃わないリリースは配信しない）

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

## Q-017 (2026-11-21) IP ハッシュの元になる X-Forwarded-For の偽装（既存の弱点）
- 状況: 現行の `getClientIpHash` は `X-Forwarded-For` の**先頭**を使う。本番 nginx（`scripts/install-ubuntu-24.sh`）は `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`（**追記**）なので、クライアントが自分で `X-Forwarded-For` を付けると先頭を偽装でき、匿名の1日5件と、今回の匿名レート制限・認証失敗の連続制限を回避できる。Web の匿名クイック共有にも同じ弱点が既にある。
- 暫定案: SPEC/INSTRUCTIONS の「現行と同じ IP ハッシュ方式」を守り、アプリのコードは変えない。代わりに nginx を `proxy_set_header X-Forwarded-For $remote_addr;`（**上書き**）に変更する手順を `docs/DEPLOY_QUICKSHARE.md` に記載（Cloudflare 等の前段プロキシが無い前提。ある場合は `real_ip` モジュールで実IPを復元してから上書き）。
- 影響範囲: 本番 nginx 設定（人が実施）。アプリのコード変更なし。
- 人に確認したいこと: nginx の前段に CDN/プロキシがあるか。nginx の変更を実施してよいか。
- 状態: 確認済み（回答 2026-11-21: CDN なし、nginx/1.24.0 が直接受ける → `proxy_set_header X-Forwarded-For $remote_addr;` に変更する。適用はオーナー。手順は DEPLOY §4）

## Q-018 (2026-11-21) `/api/v1/client/latest` のレート制限
- 状況: 応答はメモリキャッシュから返すため負荷は小さい。
- 暫定案: レート制限を掛けない（クライアントの更新確認が NAT 配下で一斉に来ても弾かないため）。GitHub への問い合わせはキャッシュ TTL と失敗時1分のバックオフで抑えている。
- 影響範囲: `app/api/v1/client/latest/route.ts`。
- 状態: 未確認

## Q-019 (2026-11-21) 並行アップロードで1日上限をわずかに超えうる
- 状況: 1日上限は受信前に数え、登録は受信・処理の後。同時に複数送ると上限を少し超えて通る。現行の Web（`/api/qick/upload`）も同じ作り。
- 暫定案: 現行と同じ数え方・タイミングを維持（「現行に合わせる」）。トークン/IP 別のレート制限で同時送信の量は抑えられる。厳密にする場合は登録時に行ロック付きで数え直す。
- 影響範囲: `lib/quick-share/api-upload.ts`、`lib/quick-share/create-quick-share.ts`。
- 状態: 確認済み（回答 2026-11-21: 数え方は現在の実装のまま）

## Q-020 (2026-11-21) 移行後、サイト全体の画像/動画上限はログイン中ユーザーに効かない（Q-001 の補足）
- 状況: マイグレーションで全レベルに現行値をコピーするため、移行後に「管理 › クイック共有 › クイック共有の設定」の上限を変えても、影響するのは未ログイン（とレベル未設定の新しいレベル）だけになる。
- 暫定案: INSTRUCTIONS の「既存レベルに現行値をコピー」に従う。ログイン中の上限を一括で変えたい場合は、レベル一覧で各レベルの欄を空欄（=サイト設定を使う）にする。画面の説明文（デザイン20）「レベル別の設定がないときに使います」と矛盾はしない。
- 影響範囲: 管理画面の運用。
- 人に確認したいこと: コピーではなく NULL（サイト設定に追従）にしたい場合はマイグレーションのデータ更新2文目を外すだけで済む（本番適用前なら）。
- 状態: 未確認

## オーナー回答（2026-11-21）の反映メモ
- 署名は自己署名で公開。配布物は「セットアップ exe + MSIX」の2ファイル。クライアントはアプリ内にアンインストール機能を持つ。Store 配布の予定なし。既定画質は「縮小（長辺2000px）」（クライアント側設定）。
- clipshare.link は CDN なし（nginx/1.24.0 が直接受ける）。→ Q-017
- `/api/v1/client/latest` の `assets[].sha256` は必ず返す。→ Q-013、API 契約 v1.2
- 1日上限の数え方は現在の実装のまま。→ Q-002 / Q-019
- BAN（403）時はお問い合わせページへ案内。→ Q-024
- DLページに「手順」と「更新履歴」を追加。→ Q-012、PROGRESS「D」
- （2回目の回答）Q-021〜Q-024 を確定。お問い合わせ URL は `https://clipshare.link/contact` で確定（回答では Q-027。このリポジトリの QUESTIONS には Q-027 が無いため、クライアント側の番号と思われる。内容は Q-024 に反映）。クライアントの Publisher 名は `CN=choko1229`（自己署名証明書の Subject）。

## Q-021 (2026-11-21) GitHub の digest と SHA256SUMS が食い違うとき
- 状況: GitHub は asset ごとに SHA-256 の digest を返すことがある（返さないこともある）。
- 暫定案: digest は**照合のみ**に使い、SHA256SUMS（または手動登録）と食い違ったらそのリリースを配信しない（ファイル差し替えや SHA256SUMS の誤りを配らないため）。digest だけを SHA-256 の出どころにはしない（オーナー指定の「SHA256SUMS → 手動登録」に従う）。
- 影響範囲: `lib/quick-client/releases.ts`。
- 状態: 確認済み（回答 2026-11-21: 食い違うリリースは配信しない。現状の実装のまま）

## Q-022 (2026-11-21) ダウンロードボタンで渡すファイル
- 状況: 配布物が「セットアップ exe + MSIX」の2つになった。デザイン01のボタンは1つ。
- 暫定案: **セットアップ exe を優先**（自己署名の MSIX は証明書の信頼が必要なので、それを扱える exe を入口にする想定）。exe が無いリリースでは MSIX。`/api/v1/client/latest` は両方を返す。
- 影響範囲: `pickInstallerAsset`（`lib/quick-client/releases.ts`）、`/qick/download`。
- 人に確認したいこと: exe がどこまで行うか（証明書の登録・MSIX のインストール）。MSIX を直接ボタンにしたい場合は関数の優先順を入れ替えるだけ。
- 状態: 確認済み（回答 2026-11-21: メインボタンはセットアップ exe 優先、MSIX は補助。現状のまま）

## Q-023 (2026-11-21) SHA-256 の手動登録の置き場所
- 状況: 「/admin/quick-share もしくは適切な管理画面」。
- 暫定案: 配布元リポジトリなど Clipshare Quick の設定がある **`/admin/api-tokens`（ナビ「連携トークン」）の「配布ファイルの SHA-256」** に置いた。直近3件のリリースの判定（配信可/不可・理由・取得元）を表示し、タグ・ファイル名・SHA-256 で登録/削除できる（ADMIN/OWNER のみ、監査ログ `quick_client.checksum.*`）。保存先は新テーブル `QuickClientAssetChecksum`（マイグレーション `20261121010000_add_quick_client_asset_checksums`、追加のみ）。リポジトリ単位で持つので、配布元を変えても混ざらない。
- 影響範囲: `app/admin/api-tokens/page.tsx`、`app/admin/quick-share-actions.ts`、スキーマ。
- 人に確認したいこと: ナビ名「連携トークン」のままでよいか（Clipshare Quick 全般の設定に広がったため「Clipshare Quick」への改名も可）。
- 状態: 確認済み（回答 2026-11-21: 登録場所は現状のまま＝管理 › 連携トークン › 配布ファイルの SHA-256。ナビ名も現状のまま）

## Q-024 (2026-11-21) BAN（403）時の案内先
- 状況: 既存のお問い合わせ機能は `/contact`（`app/contact/page.tsx`、`ContactMessage` に保存）。**ログイン不要**で送信でき（`userId` は任意）、BAN されたユーザーでも送信を拒否しない（`requireActiveUser` を使っていない）。送信は IP ハッシュで1時間5件まで。フォームが使えない場合の連絡先メールアドレスもページに載っている。
- 暫定案: 案内先 URL は `https://clipshare.link/contact`（API 契約の 403 行に明記）。種別に「アカウント停止（BAN）について」は無いので、利用者は「一般的なお問い合わせ」を選ぶ想定。種別の追加やクエリでの初期選択（`?category=`）は仕様に無いので足していない。
- 影響範囲: クライアントの 403 表示、API_CONTRACT。
- 人に確認したいこと: BAN 用の種別を追加するか（追加する場合は `ContactCategory` の enum 追加＝マイグレーションが必要）。
- 状態: 確認済み（回答 2026-11-21: BAN 用の問い合わせ種別は足さない。クライアントは /contact に案内する。案内先 URL は https://clipshare.link/contact で確定＝オーナー回答の Q-027）

## Q-025 (2026-11-21) アプリ側の IP の取り方（X-Forwarded-For の信頼）の改善案
- 状況（点検結果）: IP は `lib/quick-share/ip-hash.ts` の1か所だけで決めている（`X-Forwarded-For` の先頭 → `X-Real-IP` → `"unknown"`）。使っている所: 匿名のクイック共有（Web/API）の1日上限、API の匿名レート制限・認証失敗の連続制限、お問い合わせの送信回数制限、トークンの最終使用 IP。Next はファイアウォール（ufw: SSH と nginx のみ許可）の内側で、外から直接 3000 番には届かない。
- nginx を `X-Forwarded-For $remote_addr`（上書き）に変えれば、先頭＝実際の接続元になり、偽装できなくなる。ハッシュの作り方は変わらないので、既存の数え方とも連続する（反映した当日の匿名の件数がリセットされることもない。偽装していないクライアントのハッシュは変わらない）。
- 改善案（未実施）: アプリ側でも `X-Real-IP`（nginx が常に `$remote_addr` で上書きしている）を優先するようにすれば、nginx の設定に依存しない。ただし「現行と同じ IP ハッシュ方式」の指示があるため今回は変えない。nginx 反映後は両者が同じ値になるので、将来切り替えても数え方は変わらない。
- 影響範囲: なし（記録のみ）。
- 状態: 未確認


## Q-026 (2026-11-21) SHA256SUMS の解析をどこまで厳格にするか
- 状況: オーナー指示「ファイル名は GitHub のアセット名と完全一致」「不正行はそのリリースを不可にする」。それ以外の細部（パス付き・同値の重複・アセットに無いファイル名・不正な SHA256SUMS と手動登録の関係）は未指定。以前の実装はパスを除いて照合し、同値の重複を許し、アセットに無い行は無視し、不正な SHA256SUMS でも手動登録で補えた。
- 暫定案（安全側）:
  - パス（`./`、`dist/`、`\`）付きのファイル名は不正（完全一致の指示どおり。生成コマンドは配布ファイルと同じフォルダで実行する前提）。
  - 同じファイル名は値が同じでも不正（生成手順の誤りを早く見つけるため）。
  - そのリリースに無いファイル名の行があれば配信しない（別リリースの SHA256SUMS の取り違えを配らないため）。`.appinstaller` など実在するアセットの行は可。
  - `SHA256SUMS` があるのに不正なら、手動登録があっても配信しない。手動登録は「無い・取得できない」ときだけ使う（壊れた SHA256SUMS はリリース作業の誤りなので、リリース側で直す）。
- 影響範囲: `lib/quick-client/checksums.ts`、`lib/quick-client/releases.ts`、API_CONTRACT「SHA256SUMS の形式」。
- 人に確認したいこと: 不正な SHA256SUMS を手動登録で上書きできるようにしたい場合は `releases.ts` の1か所（`sha256sums_invalid` の早期終了）を外す。
- 状態: 未確認
