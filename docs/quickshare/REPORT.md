# 完了報告: Clipshare Quick 向け Clipshare 側改修（feature/quickshare-api-v1）

作成: 2026-11-21 / ブランチ: `feature/quickshare-api-v1`（`main` 未マージ）

## 1. 概要
SPEC.md / INSTRUCTIONS.md の Step 0〜7 をすべて実装した。Windows クライアント「Clipshare Quick」用に、ブラウザ認可（ループバック＋PKCE）、端末ごとの API トークン、クイック共有のアップロード/削除 API、共有ページの OGP、管理画面（上限・トークン管理）、ダウンロードページを追加した。既存の Web（Cookie セッション）の挙動は、SPEC で確定した画像上限 20MB→50MB を除き変えていない。

仕様の穴は質問で止めず `QUESTIONS.md`（Q-001〜Q-018）に「状況・暫定案・影響範囲」を記録して、安全で後から直しやすい案で進めた。**人の確認が必要な項目は §8 を参照。**

## 2. 変更ファイル
| 区分 | ファイル |
|---|---|
| DB | `prisma/schema.prisma`、`prisma/migrations/20261121000000_add_quickshare_api_tokens/migration.sql` |
| API 共通 | `lib/api/{errors,handler,log,rate-limiter,rate-limits,request-body}.ts` |
| 認可・トークン | `lib/api-auth/{authenticate,authorization,authorize-params,crypto,tokens}.ts`、`lib/auth/callback-url.ts` |
| API ルート | `app/api/v1/auth/token/route.ts`、`app/api/v1/me/route.ts`、`app/api/v1/quick/route.ts`、`app/api/v1/quick/[id]/route.ts`、`app/api/v1/client/latest/route.ts` |
| クイック共有 | `lib/quick-share/{api-limits,api-multipart,api-settings,api-upload,delete-quick-share,limits,share-metadata}.ts`（新規）、`lib/quick-share/{rate-limit,ip-hash,settings,create-quick-share}.ts`（関数分割・既定値変更）、`lib/media/magic-bytes.ts`（新規）、`lib/media/quick-share.ts`（API 用処理を追加、Web 用は関数に切り出しのみ） |
| 配布情報・整形 | `lib/quick-client/releases.ts`、`lib/format/{relative-time,megabytes}.ts` |
| 画面 | `app/qick/authorize/{page.tsx,decision/route.ts,complete/page.tsx}`、`components/quick-auth/authorize-views.tsx`（画面07）、`app/settings/apps/{page,actions}.ts(x)`、`components/settings/connected-app-row.tsx`（画面13）、`app/q/[id]/view/page.tsx`（画面17）、`app/admin/quick-share/page.tsx`・`app/admin/quick-share-actions.ts`・`app/admin/api-tokens/page.tsx`・`app/admin/layout.tsx`・`app/admin/actions.ts`（画面20・トークン管理）、`app/qick/download/page.tsx`（画面01） |
| 既存の小変更 | `app/login/page.tsx`・`components/auth/login-actions.tsx`（`callbackUrl` 対応。未指定時は従来どおり `/`）、`app/qick/page.tsx`（上限表示をレベル別に）、`app/qick/actions.ts`（削除処理を共通関数へ）、`lib/uploads/account-limits.ts`（列の追加のみ）、`next.config.ts`（認可・連携画面の iframe 埋め込み禁止）、`scripts/cleanup-quickshare.mjs`（受信途中の一時ファイル掃除） |
| テスト | `vitest.config.ts`、`tests/**`（11ファイル＋ヘルパー2） |
| 依存 | `busboy`（ストリーム受信）、dev: `vitest`、`@types/busboy` |
| 文書 | `docs/DEPLOY_QUICKSHARE.md`、`docs/quickshare/{API_CONTRACT,QUESTIONS,PROGRESS,REPORT}.md` |

## 3. マイグレーション
`20261121000000_add_quickshare_api_tokens`（**追加のみ**。`prisma migrate diff --from-schema-datamodel` で生成し、データ更新2文を追記）
- 追加: テーブル `ApiToken`（端末ごと、`tokenHash` unique、`prefix`、`lastUsedAt`、`revokedAt`/`revokedReason`）、`ApiAuthorization`（認可要求1回分。`codeChallenge` unique、CSRF/コードはハッシュ、期限・使用済み時刻）、列 `AccountLevel.quickShareImageMaxBytes/quickShareVideoMaxBytes`（BIGINT NULL、0=無制限、NULL=サイト設定）、`QuickShare.apiTokenId`（FK SET NULL）とインデックス。
- データ: ① `quick_share_max_image_bytes` が `20000000` のときだけ `50000000` に、② 既存レベルへ現在のサイト設定値をコピー（移行直後の実効値は現行と同じ）。
- 検証: MySQL 8.4 の使い捨てコンテナで適用 → 結果確認（画像 20→50MB、管理者が変えた動画 300MB は維持、全レベルにコピー）→ ロールバック SQL → 再適用、すべて成功。既存スキーマとのドリフト（`Comment`/`Game` の `updatedAt` 既定値）は本件と無関係の既存差分。

## 4. 追加した API（詳細は `API_CONTRACT.md` v1.1）
| メソッド・パス | 認証 | 主な応答 |
|---|---|---|
| `GET /qick/authorize` | ログイン（未ログインは `/login?callbackUrl=…`） | 認可画面（接続コード表示）。不正・期限切れ・処理済みは「このリンクは使えません」 |
| `POST /qick/authorize/decision` | セッション＋CSRF＋Origin | `303 {redirect_uri}?code&state` / `?error=access_denied&state` |
| `GET /qick/authorize/complete` | 任意 | 「連携が完了しました」 |
| `POST /api/v1/auth/token` | なし（code＋PKCE） | `200 {token, tokenId, tokenType, user, limits}` / 400 / 403 / 503 |
| `DELETE /api/v1/auth/token` | Bearer | 204 / 401 |
| `GET /api/v1/me` | Bearer 任意 | `200 {authenticated, user, limits}` |
| `POST /api/v1/quick` | Bearer 任意 | `201 {id, url, kind, status, expiresAt, deleteToken?}` / 400 / 401 / 403 / 413 / 415 / 429 |
| `DELETE /api/v1/quick/{id}` | Bearer または `X-Delete-Token` | 204 / 404 |
| `GET /api/v1/client/latest` | なし | `200 {version, publishedAt, notes, minSupportedVersion, assets[]}` / 503 |

例（ローカル + MySQL 8.4 で実際に得た応答。値は一部省略）:
```text
POST /api/v1/auth/token → {"token":"csq_…","tokenId":"cmwp…","tokenType":"Bearer","user":{"id":"u-test","name":"…"},"limits":{"imageMaxBytes":50000000,"videoMaxBytes":300000000,"dailyLimit":0,"dailyUsed":0,"resetsAt":"2026-11-21T15:00:00.000Z","banner":false}}
POST /api/v1/quick (Bearer, quality=original) → 201 {"id":"2ANi9oBLHp","url":"…/q/2ANi9oBLHp","kind":"IMAGE","status":"READY","expiresAt":"…"}
POST /api/v1/quick (匿名) → 201 {…,"deleteToken":"…"}
POST /api/v1/quick (動画) → 201 {…,"kind":"VIDEO","status":"PROCESSING"}
POST /api/v1/quick (中身がテキストの .mp4) → 415 {"error":{"code":"UNSUPPORTED_MEDIA","message":"…"}}
POST /api/v1/quick (Bearer csq_xxx) → 401 {"error":{"code":"UNAUTHORIZED","message":"…"}}
```

## 5. テスト結果
最終コミット時点: `npm.cmd run typecheck` 成功 / `npm.cmd run lint` 成功 / `npm.cmd run build`（`next build --webpack`）成功 / `npm.cmd test` **175件すべて成功（11ファイル）**。

| ファイル | 主な内容 |
|---|---|
| `tests/api-auth.test.ts` | loopback 以外の redirect_uri 拒否（13パターン）、パラメータ検証、PKCE 不一致、redirect_uri 不一致、期限切れコード、使い回し（逐次・同時とも発行済みトークン失効）、キャンセル、CSRF 不一致・他人・二重決定、再読込で再利用、期限切れ要求、発行停止、BAN、Bearer（なし=匿名・不正形式/不明/失効=401・BAN=403・認証失敗の連続=429）、ログ・DB にトークン/コードが残らない |
| `tests/api-auth-routes.test.ts` | 許可→303（code/state）、他サイトからの POST 拒否、ログアウト時、トークン交換の応答形・統一エラー・CORS ヘッダ無し、`/me` 匿名/トークン、自己失効後 401、匿名レート制限と Retry-After |
| `tests/api-quick-routes.test.ts` | トークン=バナーなし・deleteToken なし、匿名=バナー・deleteToken、匿名 original もバナー、GPS EXIF 除去、無効/失効トークンは 401 で保存されない、匿名5件目OK/6件目429（resetsAt=次の0時）、前日分は数えない、レベル別上限（0=無制限・日次）、動画 PROCESSING+ジョブ、偽装 415、トークン別レート制限、削除（本人/別端末/他人404/Web経由404/期限切れ404/匿名 X-Delete-Token） |
| `tests/media-processing.test.ts` | マジックバイト（8形式・偽装6種）、GPS EXIF＋回転の除去（4通り）、shrink=2000px・original=原寸、匿名 original のバナー、**Web 出力が変更前とバイト一致**、1億画素超の拒否、上限ちょうど/+1バイト、0=無制限、種別不一致、ファイル名なし、空・複数・非 multipart、30MB をメモリに溜めず受信 |
| `tests/admin-quick-share.test.ts` | 管理者のトークン失効と監査ログ（ハッシュを残さない）、レベル別上限（MB→バイト、0、空欄=NULL、小数の正確な保存）、サイト設定の MB 入力、緊急停止・設定の検証 |
| `tests/quick-client-releases.test.ts` | GitHub 応答の変換、TTL 内は1回のみ取得、失敗時の前回結果と1分バックオフ、再起動後の DB フォールバック、未取得時 503、契約どおりの応答 |
| その他 | `quick-share-limits`（上限解決・日次境界）、`migrations`（DROP/MODIFY なし）、`share-metadata`（OGP）、`api-log`（秘密情報を落とす・Prisma エラー）、`review-fixes`（MB 変換・システムエラー判定） |

**本番相当の通し確認**（ローカル、使い捨て MySQL 8.4 ＋ `next dev` ＋ アプリ内ブラウザ / curl）:
- 未ログインで認可URL → ログイン画面（callbackUrl 付き）→ 戻って認可画面（画面07）→「許可する」→ ループバックに code と state → 完了画面。続けてトークン交換、同じコードの再交換で 400 かつトークン失効を確認。
- アップロード（トークン original / 匿名 shrink / 動画 / 偽装 415 / 無効トークン 401）、`/me`、削除（匿名の誤トークン 404・正しいトークン 204、トークンで 204 → 再度 404）。
- 150MB の動画は受理、260MB は受信途中で 413 JSON（`limitBytes`/`kind`）、一時ファイルは残らない。
- 保存された WebP に EXIF なし・回転補正済み。共有ページの OGP タグ（og:image は1つ）。`/media/quick/images/*.webp` が 200 `image/webp`。
- 連携アプリ（画面13）で解除 → 即 401、空の状態の表示。管理画面（画面20・トークン管理）の表示。既存 `/api/qick/upload` の出力（バナー付き）が従来どおり。
- この確認で **Referrer-Policy: no-referrer により許可ボタンが必ず拒否される不具合**を発見・修正（単体テストでは Origin を手で付けるため気づけなかった）。

## 6. 未検証項目の検証結果（INSTRUCTIONS §10 / SPEC §6）
| 項目 | 結果 |
|---|---|
| sharp のメタデータ除去 | **確認済み**。GPS（IFD3）・カメラ名入り EXIF ＋ orientation=6 の JPEG で、original/shrink × バナー有無の全4通りとも出力 WebP に EXIF/XMP/orientation が無く、回転補正済み（`tests/media-processing.test.ts`、本番相当スタックでも確認）。sharp は `withMetadata`/`keepMetadata` を呼ばない限りメタデータを書かない。 |
| NextAuth への認可フロー組み込み | **設計して実装・確認済み**（Q-005）。NextAuth の設定は変えず、通常ページ＋`getServerSession`、`/login` の `callbackUrl` 対応のみ。ブラウザで 未ログイン→ログイン画面→戻る→許可→ループバック→完了画面 を確認。 |
| OGP の Discord / X 表示 | **メタタグは確認済み・実機表示は未確認**。公開URLが必要なため人が実施（`docs/DEPLOY_QUICKSHARE.md`「OGP の表示確認」）。ページの og:image がサイト既定の画像を上書きすること（og:image が1つ）はローカルで確認。動画は og:video＋サムネイル。 |
| ダウンロードページの GitHub API キャッシュ | **確認済み**（テスト）。TTL 内は1回のみ取得、失敗時は前回結果（メモリ→DB）を返し1分は再試行しない、未取得時は 503。実 GitHub への問い合わせはリリース未公開のためページはリリースページへのリンクにフォールバックすることを確認。 |
| 現行の「1日上限」の数え方 | **確認して再利用**。`QuickShare` の行数（削除済み含む）を userId / ipHash で、サーバーのローカル時刻の当日0時以降で数える。共通関数 `countQuickSharesToday` に切り出し、Web と API で共用。 |
| ライトテーマのコントラスト | 新規画面は既存のテーマトークン（`bg-card`/`text-muted-foreground`/`text-primary` 等）のみを使用。ライトテーマの目視確認は未実施（ブラウザ確認はダーク）。 |

## 7. 契約の変更点（`clipshare-qick` 側へ伝えること）
すべて**追加・明確化のみ**で互換を維持（詳細は `API_CONTRACT.md` の変更履歴 v1.1）。
1. 認可URLに任意パラメータ `device_platform`（最大32文字）を追加。`state` は表示可能 ASCII 1〜256文字、`device_name` は1〜64文字・制御文字不可、`code_challenge` は43文字の BASE64URL。
2. 許可/キャンセルのリダイレクトは **303**。
3. 任意: ループバックで受信後、ブラウザを `302 {base}/qick/authorize/complete` に戻すと Clipshare の完了画面が出る。
4. トークンは `csq_` で始まる47文字。使用済みコードの再提示で、そのコードから発行したトークンも失効する。
5. `403 FORBIDDEN` は BAN（再認可しても解決しない）。`503` はトークン発行の停止中にも返る。
6. nginx が返す **HTML の 413** もサイズ超過として扱う。画像の画素数超過（1億画素）も 413（`details.limitPixels`）。縮小して再送すれば通る。
7. `429 DAILY_LIMIT_EXCEEDED` の `details` に `dailyLimit` を追加。
8. 日次の数え方: トークンありは**ユーザー単位で Web 経由と共通**、匿名は IP 単位。リセットはサーバーのローカル0時（`resetsAt`）。
9. `POST /api/v1/quick` の形式判定はマジックバイト（jpg/png/webp/mp4/mov/webm/mkv/avi）。拡張子・Content-Type と種別が食い違うと 415。
10. 匿名は `quality=original` でもバナーあり。`original` は寸法そのまま（1辺16383px超のみ縮小）・WebP q95。
11. `deleteToken` は匿名のときだけ含まれる。
12. Bearer での削除は **API 経由でアップロードしたものだけ**（Web で上げたものは 404）。
13. `GET /api/v1/client/latest` の `assets[].sha256` は null になりうる。未取得時は 503。
14. `/api/v1/*` は CORS 不可・`Cache-Control: no-store`。

## 8. 人が行う作業
1. **PR のレビューと `main` へのマージ**（Claude Code はマージしていない）。
2. **本番反映**: `docs/DEPLOY_QUICKSHARE.md` の手順（バックアップ → `migrate deploy` → スモークテスト）。
3. **nginx の X-Forwarded-For 上書き**の要否判断と実施（Q-017。既存の /qick にもある弱点）。
4. **Discord / X での OGP 実機確認**（公開URLが必要）。
5. **QUESTIONS.md の暫定判断の確認**。特に影響の大きいもの:
   - Q-001 レベル別のクイック共有上限を **Web のログイン中クイック共有にも適用**（デザイン20の文言どおり。移行直後の実効値は現行と同じ）。
   - Q-002 ツール専用の日次上限は作らず既存の日次投稿上限を共用。
   - Q-008 匿名は original でもバナーあり。
   - Q-009 トークンで削除できるのは API 経由のアップロードのみ。
   - Q-012 ダウンロードページはデザイン01の構成のみ（署名手順・更新履歴は未掲載）。
   - Q-020 移行時に既存レベルへ上限をコピーする（本番適用前なら NULL＝サイト設定追従にも変更可）。
6. GitHub Releases に最初のリリース（`.msix`）を公開すると、ダウンロードページにバージョン・サイズが表示される。
7. `npm ci` 後に `npx prisma generate` が必要（npm 11 の install-scripts 制限。既存の環境要因）。

## 9. セルフレビュー（INSTRUCTIONS §9）
### 1回目（自分で §9 の6観点を照合）
- 仕様との差分: Step 1〜6 を照合。未実装なし。仕様にない機能は足していない（追加したのはセキュリティ上の補強＝使用済みコード再提示時の失効、画素数上限、iframe 禁止のみ）。
- セキュリティ: §7 を1項目ずつ確認。**修正**: 想定外エラーのログに Prisma のメッセージ（クエリ引数を含みうる）が出る → 名前とエラーコードだけに。**記録**: X-Forwarded-For の先頭を使う既存方式は偽装できる → nginx での対処を手順書に（Q-017）。
- 回帰: Web の画像出力のバイト一致テスト、`/login` の既定戻り先、削除処理、日次判定・メッセージが不変であることを確認。
- マイグレーション: MySQL 8.4 で適用・ロールバック・再適用を実地確認。
- エラー処理・ビルド: 全経路が統一形式で応答、すべて通過。
- 実地確認で Referrer-Policy の不具合を発見・修正（`90c9cf0`）。

### 2回目（先入観を避けるため、別のレビュアー（サブエージェント）に差分だけを渡して独立レビュー → 指摘を修正）
高い重大度の指摘なし。中・低の指摘への対応:
| 指摘 | 対応 |
|---|---|
| 画像処理中のディスク不足等が 415 になり、クライアントが再試行しない | システムエラーは 500 に（`isSystemError`） |
| ファイル名なしの file パートが分かりにくい 400 | `file_without_filename` の 400 にし、契約にファイル名必須を明記 |
| 一時ファイルを閉じる前に rename（Windows で失敗しうる） | `close` 後に完了扱い |
| 同時の認可コード再使用で発行済みトークンが失効しない | 負けた側で勝った側のトークンを失効（テスト追加） |
| 並行アップロードで日次上限をわずかに超えうる | 現行 Web と同じ作り。Q-019 に記録 |
| 移行後、サイト全体の上限がログイン中に効かない | 指示どおりのコピーの帰結。Q-020 に記録（空欄にすればサイト設定に追従） |
| 管理画面の MB 丸めで値が黙って変わる | 小数6桁まで正確に表示・保存 |
| nginx を通さないと早期 413 が接続リセットになりうる | DEPLOY に `proxy_request_buffering on` を明記 |

レビュアーが「問題なし」とした範囲: Bearer 処理（匿名にフォールバックしない）、ログ・応答への秘密情報、認可フロー（redirect_uri・CSRF・PKCE・使い捨て・iframe 禁止ヘッダの適用）、削除の IDOR、管理者権限と監査ログ、multipart 受信の全経路、画像のバナー規則とメタデータ、動画経路、日次の数え方、応答形、Web の回帰。

## 10. 残課題
- レート制限はプロセス内メモリ（単一プロセス前提、Q-010）。複数プロセス化する場合は共有ストアに置き換える。
- `/api/v1/client/latest` はレート制限なし（キャッシュ応答のみ、Q-018）。
- ライトテーマでの新規画面の目視確認。
