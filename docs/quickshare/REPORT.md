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

---

# 追加報告: オーナー回答の反映（2026-11-21）
作業ブランチ `feature/quickshare-api-v1` の続き（**未 push**）。コミット: `c92df6e`（sha256 必須化・DLページのデータ準備）、`007f5cc`（テストの安定化）、`5960801`（nginx 手順）、本報告のコミット（PROGRESS/QUESTIONS/REPORT）。

## A. `/api/v1/client/latest` の sha256 を必ず返す（API 契約 v1.2）
- **v1.1 で null になっていた経路**: ① GitHub が asset の `digest` を返さない → null、② DB に保存した前回結果（v1.1 形式）の null がそのまま返る、③ `.appinstaller` など配布物以外の asset も null のまま返していた。
- **対応後**: SHA-256 は「リリースに添付された `SHA256SUMS`」→「管理画面での手動登録」の順で決める。GitHub の digest は照合のみ（食い違えば配信しない、Q-021）。配布ファイル（`.exe` / `.msix` / `.msixbundle`）の**すべて**に SHA-256 が揃ったリリースだけを配信し、揃わなければ直近3件まで遡る → 前回配信分（今回配信不可と判定したものは除く）→ 503。v1.1 形式の保存データ（null を含む）は読み込み時に捨てる。
- **安全策**: 取得先は `api.github.com` / `github.com` / `objects.githubusercontent.com` / `release-assets.githubusercontent.com` の https のみ。リダイレクトは手動で追い、毎回ホストを検査（最大3回）。サイズ上限（一覧 2MB、SHA256SUMS 64KB。宣言値と実際の受信量の両方）、タイムアウト 5秒、認証情報は送らない。ログには署名付き URL のクエリを出さずホスト名だけ。
- **キャッシュ・失敗時**: TTL は管理画面の設定（既定600秒）。GitHub 一覧の取得失敗時は前回結果（メモリ → DB）で継続し1分は再試行しない。管理画面での保存・手動登録の直後はキャッシュを捨てる。
- **ログ**: `quick_client.releases_refreshed` / `release_not_servable`（理由付き）/ `sha256sums_unavailable` / `sha256sums_fetch_failed` / `no_servable_release` / `release_fetch_failed` / `checksum_registered`。
- **管理画面**: 「管理 › 連携トークン › 配布ファイルの SHA-256」に直近のリリースの判定（配信可/不可・理由・取得元・SHA-256 の先頭）と、手動登録/削除（ADMIN/OWNER、監査ログ `quick_client.checksum.*`）。保存先は新テーブル `QuickClientAssetChecksum`（マイグレーション `20261121010000_add_quick_client_asset_checksums`、テーブル追加のみ。MySQL 8.4 で適用・ロールバック・再適用を確認）。
- **クライアントのリリースワークフローへの要件**（API_CONTRACT v1.2 に記載）: `SHA256SUMS`（`sha256sum` の出力形式、exe と MSIX の両方を記載）をリリースに添付する。

## B. nginx の X-Forwarded-For
- `docs/DEPLOY_QUICKSHARE.md` §4 に、`proxy_set_header X-Forwarded-For $remote_addr;` への変更、CDN なしの理由、変更前後の挙動、反映手順（手順中の `sed` はサンプル設定で動作確認済み）、確認コマンド、ロールバックを記載。新規構築用 `scripts/install-ubuntu-24.sh` のテンプレートも変更。**本番への適用はしていない。**
- アプリ側の点検（Q-025）: IP は `lib/quick-share/ip-hash.ts` の1か所で決め、匿名の1日上限（Web/API）・API の匿名レート制限・認証失敗の連続制限・お問い合わせの送信回数制限・トークンの最終使用 IP に使われる。nginx 変更後は偽装できなくなり、普通のクライアントのハッシュは変わらない（当日の件数も連続）。改善案（アプリ側で `X-Real-IP` を優先）は記録のみ。

## C. 403（BAN）の案内先
- **`https://clipshare.link/contact`**（`app/contact/page.tsx`）。ログイン不要で送信でき、BAN されたユーザーの送信も拒否しない（1時間5件まで、IP ハッシュ単位）。API_CONTRACT の 403 行と PROGRESS に明記。BAN 用の問い合わせ種別は無い（追加するかは Q-024）。

## D. ダウンロードページの拡張 — デザイン更新待ち
- 画面の変更はしていない（デザイン01に区画が無いため）。PROGRESS「D」に、必要な要素とデータ、未定事項（リリースノートの表示形式・件数）を記載。
- 準備したもの: `getDownloadPageData()`（`lib/quick-client/download-page-data.ts`）が更新履歴（公開リリース最大10件、同じキャッシュ）と、証明書のフィンガープリント（管理画面に入力欄を追加。`AB:CD:…` に正規化）、配布ファイル名とその SHA-256 を返す。現在の画面もこれを使うが、表示は変えていない。

## テスト結果（このコミット時点）
`npm.cmd run typecheck` 成功 / `npm.cmd run lint` 成功 / `npm.cmd run build` 成功 / `npm.cmd test` **211件すべて成功（11ファイル）**。
- 追加: `tests/quick-client-releases.test.ts`（42件）— SHA256SUMS の解析（正常・大文字・CRLF・パス付き／空・短い・区切りなし・不正行・矛盾する重複・HTML）、許可ホスト（4件許可・8件拒否）、非 GitHub へのリダイレクト拒否（そのホストには接続しない）、サイズ上限（宣言・実受信）、リダイレクト回数上限、タイムアウト、正常（exe+MSIX のみ・null なし・署名付き URL がログに出ない）、SHA256SUMS 欠落で旧リリース継続、何も無ければ 503、形式不正、一部欠落、取得失敗（詳細ログ）、SHA256SUMS が GitHub 外にある場合（接続しない）、digest 不一致、手動登録で配信可能、手動登録を消したら同じリリースを使い回さない、入力検証、一覧取得失敗時の継続（メモリ→DB）、v1.1 形式の保存データを捨てる、TTL キャッシュ、下書き・プレリリース除外と更新履歴、exe 優先、DLページ用データ。
- 変更: ストリーム受信のテストを、プロセス全体のメモリ量で測る方式（GC 次第で不安定だった）から、「送信途中で止めて、そこまでの分がすでに一時ファイルにある」ことを確かめる決定的なテストに置き換え（3回連続で成功）。
- マイグレーションのテストに2つ目（テーブル作成のみ・DROP/ALTER/UPDATE なし）を追加。

## セルフレビュー（今回分）
| 回 | 観点 | 結果・修正 |
|---|---|---|
| 1 | 型・エラー処理 | `verifyRelease` が理論上 `sha256: ""` を返しうる書き方（`?? ""`）だった → 型の上でも非空の16進だけを返すよう修正 |
| 2 | セキュリティ・回帰 | **前回配信分へのフォールバックが、たった今「配信不可」と判定した同じリリース（手動登録を削除した等）を使い回す不具合**を発見 → 今回判定したタグは除外（テスト追加）。手動登録のファイル名検証でバックスラッシュの拒否が漏れていた → 修正（テスト追加） |
| 3 | ログ・文書の整合 | ログに秘密情報（署名付き URL のクエリ）が出ないことをテストで確認。API_CONTRACT v1.2・DEPLOY（2つ目のマイグレーションの反映・ロールバック・監視イベント）・PROGRESS・QUESTIONS を実装に合わせて更新。2つ目のマイグレーションを MySQL 8.4 で適用 → ロールバック → 再適用（既存テーブルに影響なし、スキーマとの差分なし） |

**残る注意点**: GitHub が遅いとき、キャッシュの更新が重なったリクエストは最大で約20秒（一覧5秒＋SHA256SUMS 最大3件×5秒）待つことがある（TTL 中は即時応答）。

## 契約の変更点（`clipshare-qick` へ伝えること・v1.2）
1. `GET /api/v1/client/latest` の `assets[].sha256` は**常に64桁の小文字16進（null なし）**。ダウンロード後に必ず照合する。
2. `assets` は `.exe` / `.msix` / `.msixbundle` だけ。返る `version` が GitHub 上の最新より古いことがある（最新に SHA-256 が揃っていない間）。配信できるものが無ければ 503。
3. リリースワークフローで `SHA256SUMS`（`sha256sum` 形式、exe と MSIX の両方）を添付する。
4. 403（BAN）時は `https://clipshare.link/contact` へ案内する。

## オーナーの作業
1. **push と PR 更新**（今回は push していない）: `git push origin feature/quickshare-api-v1` → PR #1 に反映される。
2. **PR のレビューと `main` へのマージ**。
3. **本番デプロイ**（`docs/DEPLOY_QUICKSHARE.md`）: バックアップ → `prisma migrate deploy`（マイグレーション2つ）→ スモークテスト（§6 の 11 で client/latest の sha256 を確認）。
4. **nginx の反映**（DEPLOY §4）: `X-Forwarded-For $remote_addr` に変更 → `nginx -t` → reload → 確認コマンド。
5. **クライアント側**: リリースに `SHA256SUMS` を添付するワークフロー、403 時の `/contact` 案内、v1.2 の契約反映。
6. **管理画面での設定**（デプロイ後）: 署名証明書のフィンガープリント（任意。DLページの信頼手順用）、必要なら SHA-256 の手動登録。
7. **デザインキャンバスの更新**（DLページの「信頼手順」「更新履歴」）→ 更新後に画面を実装。
8. **QUESTIONS の確認**: Q-021（digest の照合）、Q-022（ボタンは exe 優先）、Q-023（手動登録の置き場所・ナビ名）、Q-024（BAN 用の問い合わせ種別）、Q-025（アプリ側の IP の取り方）。

---

# 追加報告2: オーナー回答（2回目）の反映（2026-11-21）
**未 push**（ローカルコミットのみ）。

## 変更内容
1. **QUESTIONS**: Q-021〜Q-024 を確認済み（回答日・内容）に更新。お問い合わせ URL は `https://clipshare.link/contact` で確定（回答の Q-027 はこのリポジトリに無い番号のため、Q-024 と回答メモに反映）。Publisher 名 `CN=choko1229` を記録。新規 Q-026（SHA256SUMS の解析の厳格さ）。
2. **証明書フィンガープリントの入力欄**（管理 › 連携トークン › Clipshare Quick 連携の設定）:
   - 確認した問題: 以前の検証はコロン・空白を位置に関係なく取り除いていたため、`AB:CDEF…` のような崩れた入力も通っていた。Windows の証明書画面が既定で出す「拇印」は SHA-1（40桁）で、取り違えやすい。
   - 対応: 受け付けるのは「64桁の16進（区切りなし）」「2桁ずつコロン区切り32組」の2形式だけ（大文字小文字は問わず、`AB:CD:…` に正規化）。SHA-1（40桁、コロン区切り含む）は専用のエラーメッセージで拒否。ラベルは変えず、入力例として placeholder `AB:CD:EF:…:89` だけを追加（説明文は足していない）。
   - 取得手順: DEPLOY §5 に PowerShell（5.1/7）と openssl のコマンドを記載。`CN=choko1229` のテスト証明書で、PowerShell・openssl・DER の SHA-256 が一致し、Thumbprint が別の SHA-1 値であることを確認。
3. **API_CONTRACT v1.2「SHA256SUMS の形式」**: 単独で読める節を追加。添付するファイル、1行の形式と例、ファイル名の完全一致（パス不可）、生成コマンド（Git Bash / PowerShell。両方の出力を実際の解析処理に通して確認済み。Windows の Git Bash の `sha256sum` は既定で `*` 付きを出すことも確認）、許容範囲（大文字小文字・LF/CRLF・`*`・空行・行末の空白・他アセットの行）、不正とみなすもの（→ そのリリースは配信しない）、手動登録が使われる条件、配信されないときの挙動。
4. **解析処理の厳格化**（契約に合わせた変更。Q-026）: パス付きのファイル名は不正（以前はパスを除いて照合）、同じファイル名の重複は値が同じでも不正（以前は同値なら許容）、リリースに無いファイル名の行があれば配信しない（以前は無視）、`SHA256SUMS` が不正なら手動登録でも上書きしない（以前は手動で補えた）。不正の理由に行番号を付けて管理画面・ログに出す（行の内容は出さない）。

## テスト結果（このコミット時点）
`npm.cmd run typecheck` 成功 / `npm.cmd run lint` 成功 / `npm.cmd run build` 成功 / `npm.cmd test` **243件すべて成功（12ファイル）**。
- 解析（指定の網羅項目）: CRLF ✓、末尾の空行 ✓（途中の空行・行末の空白・BOM も）、`*` 付きのファイル名 ✓（`*` は名前に含めない）、重複エントリ ✓（同値・異値とも不正）、64桁でない値 ✓（63桁・65桁・非16進）、アセットに無いファイル名 ✓（リリースが配信不可になる）。加えて、大文字の16進、名前の大文字小文字を変えないこと、空白1つ・タブ・行頭の空白・BSD 形式・名前なし・不正行が1行だけ混ざる場合・HTML、パス3種（`./` `dist/` `dist\`）、空ファイル、不正行の行番号、`.appinstaller` の行は許容して返さないこと、不正な SHA256SUMS は手動登録で上書きできないこと。
- フィンガープリント（`tests/cert-fingerprint.test.ts`、14件）: 区切りなし・コロン区切り・小文字・前後の空白を受け付けて正規化、SHA-1（区切りなし・コロン）を専用理由で拒否、63/65桁・非16進・不規則なコロン・空白区切り・末尾コロン・Publisher 名の誤入力を拒否。

## セルフレビュー（今回分）
| 回 | 観点 | 結果・修正 |
|---|---|---|
| 1 | 仕様との差分 | 「ファイル名はアセット名と完全一致」に対し、実装はパスを除いて照合していた → 厳格化。アセットに無いファイル名・同値の重複・不正時の手動上書きの扱いを安全側に決めて Q-026 に記録 |
| 2 | 型・エラー処理・ログ | 解析の失敗理由を文字列から型付きの列挙に変更。ログ・管理画面には理由と行番号のみ（行の内容・URL のクエリは出さない）。正規表現に見えない BOM 文字が直接書かれていた → `String.fromCharCode(0xfeff)` で明示 |
| 3 | セキュリティ・文書の整合 | placeholder にテスト証明書の実際の値の一部を使っていた（本物の値と誤解されうる）→ 形式だけを示す `AB:CD:EF:…:89` に変更。契約の「200 行以下」を実装（空行を除いた件数）に合わせて修正。DEPLOY の取得手順の「3つとも」を、記載した2コマンドに合わせて修正 |

## オーナーの作業
1. **push**: `git push origin feature/quickshare-api-v1`（今回・前回とも未 push）→ PR #1 に反映。
2. **PR #1 のレビューと `main` へのマージ**。
3. **デプロイ**（`docs/DEPLOY_QUICKSHARE.md`）: バックアップ → `prisma migrate deploy`（マイグレーション2つ）→ スモークテスト。
4. **nginx 反映**（DEPLOY §4）: `proxy_set_header X-Forwarded-For $remote_addr;` → `nginx -t` → reload → 確認コマンド。
5. **証明書フィンガープリントの入力**（デプロイ後）: DEPLOY §5 の手順で `CN=choko1229` の証明書の SHA-256 を出し、管理 › 連携トークン › Clipshare Quick 連携の設定に入力。
6. クライアント側: リリースワークフローを API_CONTRACT「SHA256SUMS の形式」どおりにする（配布ファイルと同じフォルダで生成、パスを付けない）。
7. Q-026（不正な SHA256SUMS を手動登録で上書きしない方針）の確認。

---

# 追加報告3: ダウンロードページ（/qick/download）の実装（2026-11-22）
**未 push**（ローカルコミットのみ）。正本デザイン: `docs/quickshare/design/01-web-download-page.dc.html`（オーナーが配置した最新版。本報告のコミットで取り込み）。

## 実装内容
- **ボタン**: メイン「{対応OS} 版をダウンロード」＝セットアップ exe、副「MSIXをダウンロード」（ゴースト）、その横に `v{版} · {exe のサイズ} · {対応OS}`。どちらも `/api/v1/client/latest` と同じ**SHA-256 検証済みリリース**のファイルだけ（既存の `releases.ts` のキャッシュを再利用。新しい外部取得は無い）。検証済みが無いときはメインボタンを無効化し、MSIX とバージョン行は出さない（Q-029）。リリースに MSIX が無い／セットアップ自体が MSIX のときは副ボタンを出さない。
- **証明書の信頼手順**: 3ステップ（セットアップを開く → 証明書を信頼する（発行元 choko1229）→ インストール）。文言はデザインの仮置きのまま。
- **フィンガープリント行**: 管理画面で登録した値（`AB:CD:…` に正規化済み）をそのまま表示し、コピーボタンを付ける。未登録なら行ごと非表示。コピー成功時は既存画面と同じ「コピーしました」を2秒（Q-031）。クリップボードが使えない環境では成功表示を出さない。
- **更新履歴**: 配信中（検証済み）以前の直近3件（Q-030）。変更点は Release 本文から作るプレーンテキスト（箇条書き優先、Markdown 記法と HTML コメントを除去、5項目・140文字・先頭60行の上限は定数、Q-028）。日付は日本時間。0件・配信中なし・取得失敗のときは区画ごと非表示。
- **縮退**: リリース・履歴・各設定の読み込みを区画ごとに分け、失敗した区画だけ既定値／非表示にしてログ（`quick_download.section_failed`）を残す。ページ全体は落ちない。
- **構成**: 取得と整形は `lib/quick-client/download-page-data.ts`（画面用の型 `DownloadPageData`）と `lib/quick-client/release-notes.ts`、表示は `components/quick-download/{download-sections,copy-button}.tsx`、ページは組み立てのみ（`app/qick/download/page.tsx`）。
- **ログの改善**: GitHub 取得のネットワークエラーで、例外名だけでなくメッセージの1行目と原因コード（例 `UNABLE_TO_VERIFY_LEAF_SIGNATURE`）を残す（URL は `<url>` に置換）。

## 文言の確認
- 「MSIXをダウンロード」「セットアップを開く／証明書を信頼する／インストール」と各説明は、既存の文言（「〜をダウンロード」「インストール」「セットアップ」、Q-022 の exe＝セットアップ）と矛盾しない。デザインに無い説明文は足していない。追加した表示はコピー後の「コピーしました」だけで、既存のクイック共有画面と同じ状態表示（Q-031）。

## 変更ファイル
- 追加: `lib/quick-client/release-notes.ts`、`components/quick-download/download-sections.tsx`、`components/quick-download/copy-button.tsx`、`tests/download-page.test.tsx`
- 変更: `app/qick/download/page.tsx`、`lib/quick-client/download-page-data.ts`、`lib/quick-client/github-fetch.ts`（ログ詳細）、`tests/quick-client-releases.test.ts`（旧データ準備テストを新ファイルへ移し、ログ詳細のテストを追加）、`vitest.config.ts`（`*.test.tsx` を対象に）、`docs/quickshare/design/01-web-download-page.dc.html`（オーナー配置の最新版）、`docs/quickshare/{PROGRESS,QUESTIONS,REPORT}.md`

## テスト結果
`npm.cmd run typecheck` 成功 / `npm.cmd run lint` 成功 / `npm.cmd run build` 成功 / `npm.cmd test` **264件すべて成功（13ファイル）**（既存243件は維持。旧「DLページのデータ準備」テスト2件は新ファイルの同等以上のテストに置き換え）。
- `tests/download-page.test.tsx`（22件）: 変更点の整形（箇条書き・見出しのみ・CRLF・HTML コメント・画像・制御文字・項目数/文字数の上限・空）、日付（日本時間・不正値）、履歴の範囲（配信中から3件・1件・配信中なし・日付での代替）、描画（exe/MSIX/バージョン行、**検証済みなし＝無効ボタン・リンク無し**、MSIX 無し、信頼手順の文言、**フィンガープリント有り/無し・コピー対象の値**、**履歴0件/1件/3件**、**本文の `<script>`・`<img onerror>`・`javascript:` リンクがエスケープされる**）、ページデータ（**履歴の取得失敗でも他は表示**、検証済みなしで履歴なし、設定が読めないとき既定値、MSIX のみのリリース）。
- ブラウザでの確認（ローカルの使い捨て MySQL 8.4 ＋ `next dev`。保存済みキャッシュを使う経路で表示）: ダーク／ライト、375px 幅で横スクロールなし、未検証の新しい版が履歴に出ない、本文の `<script>` が文字として表示され実行されない（コンソールエラーなし）、コピーで正規化済みの値がそのまま渡り「コピーしました」になる（クリップボード拒否の環境では表示が変わらない）、検証済みリリースが無い状態でボタン無効・MSIX/バージョン行/履歴なし。

## セルフレビュー（今回分）
| 回 | 観点 | 結果・修正 |
|---|---|---|
| 1 | XSS・セキュリティ | 本文はプレーンテキスト化して React のテキストとして描画（`dangerouslySetInnerHTML` 不使用をコード検索で確認）。リンク先は検証済みリリースの GitHub https のファイルだけ。検証済みが無いときに GitHub のリリースページ（未検証のファイル）へ誘導していた旧挙動をやめて無効化 |
| 2 | エラー処理・ログ | 区画ごとの縮退とログを追加。ブラウザ確認中に GitHub 取得が `network TypeError` としか記録されず原因が分からなかった → メッセージと原因コードを記録するよう改善し、テスト追加。これにより、アプリから起動した開発サーバーだけ TLS 検証に失敗する（`UNABLE_TO_VERIFY_LEAF_SIGNATURE`）ことが判明 |
| 3 | 型・保守性 | 画面用の型（`DownloadPageData`）を取得側に置き、表示部品は props だけで描画できる形にしてテスト可能に。上限値は定数に集約。データ準備時に作った未使用フィールド（`releasesPageUrl` など）を削除し、参照が残っていないことを確認 |

## 環境メモ（ローカル開発）
- この PC では、シェルの Node には `NODE_EXTRA_CA_CERTS` が設定されているが、Claude のアプリから起動した開発サーバーには引き継がれず、GitHub への HTTPS が証明書検証エラーになる（TLS を検査するソフト等の影響と思われる）。本番（Linux）には関係しない。ローカルで実際の GitHub Releases を見たい場合は、開発サーバーの起動環境にも `NODE_EXTRA_CA_CERTS` を設定する。TLS 検証を無効にする対応はしていない。

## 未解決の質問
- Q-028 更新履歴の上限値（3件・5項目・140文字）とリリースノートの書き方
- Q-029 検証済みリリースが無いときの無効ボタンに文言を足すか（デザイン）
- Q-030 履歴を配信中以前に限る方針
- Q-031 コピー後の「コピーしました」表示
- Q-026 不正な SHA256SUMS を手動登録で上書きしない方針（前回から継続）
