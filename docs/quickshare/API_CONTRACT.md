# API 契約 v1（Clipshare ⇔ Clipshare Quick）

**正本は `clipeshare` リポジトリ（main）の `docs/quickshare/API_CONTRACT.md`。** `clipshare-qick` 側のコピーはスナップショット。変更は**追加のみ**（互換維持）。破壊的変更が必要なら実装せず `QUESTIONS.md` に書く。Clipshare側が変更・追加したら末尾「変更履歴」に追記する。
本書は設計案であり、既存実装（`POST /api/qick/upload` 等）との整合をClipshare側Claude Codeがコードで確認し、**差異があればこの文書を更新**してよい（その場合は変更履歴に理由を書く）。

- ベースURL: `https://clipshare.link`（本番の `NEXT_PUBLIC_APP_URL`。応答内の絶対URLはこの値から組み立てる）
- 全API: HTTPS、`User-Agent: ClipshareQuick/<version> (Windows)`、応答は JSON（UTF-8）。時刻は ISO 8601 UTC。
- 認証: `Authorization: Bearer <token>`。ヘッダなし=匿名。**不正/失効トークンは401（匿名にフォールバックしない）**。
- 上限値: `0` = 無制限。
- `/api/v1/*` は CORS を許可しない（ブラウザの他オリジンからは呼べない）。応答は `Cache-Control: no-store`。

## エラー形式
```json
{ "error": { "code": "SIZE_LIMIT_EXCEEDED", "message": "（日本語で人が読める説明）", "details": { } } }
```
| HTTP | code | details | 意味とクライアントの動作 |
|---|---|---|---|
| 400 | INVALID_REQUEST | — | 入力不正。再試行しない |
| 401 | UNAUTHORIZED | — | トークン無効/失効。再認可を促す（匿名にしない） |
| 403 | FORBIDDEN | — | 権限なし（BAN されたアカウントのトークンを含む）。再認可しても解決しないので停止 |
| 404 | NOT_FOUND | — | 対象なし/他人のリソース |
| 413 | SIZE_LIMIT_EXCEEDED | `limitBytes`, `kind`（`IMAGE`/`VIDEO`）、画素数超過時は `limitPixels` も | 画像→縮小して再送／動画→エラー表示。画像は1億画素を超える場合も 413（縮小して再送すれば通る）。**前段の nginx が HTML の 413 を返すこともある**ので、JSON でない 413 も同じ扱いにする（`limitBytes` 不明） |
| 415 | UNSUPPORTED_MEDIA | — | 種別不正（マジックバイト不一致含む）。再試行しない |
| 429 | DAILY_LIMIT_EXCEEDED | `resetsAt`, `dailyLimit` | 1日上限。停止→翌日再開、停止中の写真は送らない |
| 429 | RATE_LIMITED | `retryAfterSeconds`（+`Retry-After`ヘッダ） | 待って再試行 |
| 500/503 | INTERNAL / SERVICE_UNAVAILABLE | — | 指数バックオフで再試行（503 は管理者がトークン発行を停止中のときにも返る） |

## 認可フロー（ループバック + PKCE）
1. クライアントが `code_verifier`（43〜128文字）、`code_challenge`=BASE64URL(SHA256(verifier))、`state`（ランダム）、`connection_code`（`XXX-XXX`、紛らわしい文字を除いた英数大文字）を生成し、127.0.0.1 のランダムポートで受信待ちを開始する。
2. ブラウザで開く:
   `GET /qick/authorize?client_id=clipshare-quick&redirect_uri=http://127.0.0.1:{port}/callback&state=…&code_challenge=…&code_challenge_method=S256&connection_code=XXX-XXX&device_name=…[&device_platform=…]`
   - `redirect_uri` は `http://127.0.0.1:{port}/…` または `http://[::1]:{port}/…` のみ許可（ポート必須、ユーザー情報・フラグメント不可）。`code_challenge_method` は `S256` のみ。
   - `device_name` は1〜64文字（必須・前後の空白は除去・制御文字不可）。`device_platform` は任意・最大32文字（例 `Windows 11`。画面の表示用）。`state` は表示可能な ASCII（0x21〜0x7E、空白不可）で1〜256文字。`code_challenge` は43文字の BASE64URL。`connection_code` は `[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}`（I・O・0・1 を除く）。
3. 未ログインなら既存ログインを経て戻る。認可画面に **`connection_code` を表示**し、クライアント画面の表示と照合させる。「許可」（CSRF対策つきPOST）または「キャンセル」。
4. 許可: `303 {redirect_uri}?code=…&state=…`。キャンセル: `303 {redirect_uri}?error=access_denied&state=…`。`code` は使い捨て・10分以内・ハッシュ保存。
5. クライアントが `state` を検証し、トークンを交換する。
6. （任意）クライアントのループバックは、受け取ったあとブラウザを `302 {base}/qick/authorize/complete` へ戻すと、Clipshare の「連携が完了しました」画面（デザイン07）が出る。戻さない場合はクライアント自身の完了ページを出してよい。
- パラメータが不正（`redirect_uri` 不正を含む）・期限切れ（認可画面を開いてから10分）・処理済みの場合、Clipshare は `redirect_uri` へ戻さず「このリンクは使えません」を表示する。

### `POST /api/v1/auth/token`
リクエスト（JSON）: `{ "code": "…", "code_verifier": "…", "redirect_uri": "http://127.0.0.1:{port}/callback" }`
200: `{ "token": "…", "tokenId": "…", "tokenType": "Bearer", "user": { "id": "…", "name": "…" }, "limits": <Limits> }`
トークン平文は**この応答でのみ**返す。トークンは `csq_` で始まる URL-safe 文字列（47文字）。
400 `INVALID_REQUEST`（検証失敗・期限切れ・使用済み・PKCE不一致・redirect_uri不一致）。使用済みのコードが再提示された場合、そのコードで発行済みのトークンも失効する。403（BAN）。503 `SERVICE_UNAVAILABLE`（トークン発行の停止中）。

### `DELETE /api/v1/auth/token`（Bearer）
自分自身のトークンを失効。204。（アンインストール時の連携解除に使う）。無効/失効済みトークンは 401。

### `GET /api/v1/me`（Bearer 任意）
200: `{ "authenticated": true|false, "user": {"id","name"}|null, "limits": <Limits> }`（`name` は表示名、無ければユーザー名）
`Limits` = `{ "imageMaxBytes": n, "videoMaxBytes": n, "dailyLimit": n, "dailyUsed": n, "resetsAt": "ISO" , "banner": true|false }`（`0`=無制限。`dailyUsed` は現行Clipshareの数え方に一致）
- 数え方（現行コードで確認）: トークンあり＝そのユーザーのクイック共有（Web経由を含む）、匿名＝同じIPハッシュのクイック共有を、**サーバーのローカル時刻の当日0時以降に作成された件数**で数える（削除済みも含む）。`resetsAt` は次のローカル0時（UTCで表記）。
- `dailyLimit`: トークンあり＝アカウントレベルの日次上限（未設定=0=無制限）、匿名＝サイト設定（既定5）。
- `imageMaxBytes`/`videoMaxBytes`: トークンあり＝アカウントレベルのクイック共有上限（未設定ならサイト設定）、匿名＝サイト設定（既定 画像50MB / 動画200MB）。

## クイック共有
### `POST /api/v1/quick`
`multipart/form-data`: `file`（必須・1個・**ファイル名付きのファイルパート**として送る。ファイル名の中身は使わない）、`quality`=`original`|`shrink`（既定 `shrink`、画像のみ有効）。
受け付ける形式は**マジックバイトで判定**: 画像 JPEG/PNG/WebP、動画 MP4/MOV/WebM/MKV/AVI。ファイル名・Content-Type は信用しない（拡張子・Content-Type とマジックバイトの種別が食い違えば 415）。
201:
```json
{ "id": "abc123XYZ0", "url": "https://clipshare.link/q/abc123XYZ0", "kind": "IMAGE", "status": "READY",
  "expiresAt": "2026-11-21T00:00:00Z", "deleteToken": "…(匿名のときのみ)" }
```
- 動画は `status: "PROCESSING"` で返る（既存の非同期処理。現行コードで確認済み）。URL は即時に共有可能（処理中は原本を返し、閲覧ページ側で処理中表示）。
- バナー: トークンあり=なし／匿名=あり（**匿名は `original` でもバナーあり**）。画像処理: 現行（回転補正）＋ `shrink`=長辺2000px WebP(q88)、`original`=寸法そのまま（1辺16383px超のみ縮小）WebP(q95)。どちらも EXIF/位置情報などのメタデータは除去。
- `deleteToken` はトークンなし（匿名）のときだけ含む。トークンありのときはキー自体を含まない。

### `DELETE /api/v1/quick/{id}`
- Bearer: 所有者のみ、かつ API（いずれかの端末のトークン）経由でアップロードしたもの。他人/存在しない/削除済み/期限切れ/Web経由=404。
- 匿名アップロードは `X-Delete-Token: <deleteToken>` で削除可（Bearer なしのとき）。不一致は 404。
- 204。

## クライアント更新情報
### `GET /api/v1/client/latest`（認証不要・サーバー側でキャッシュ）
200: `{ "version": "1.2.3", "publishedAt": "ISO", "notes": "…", "minSupportedVersion": "1.0.0"|null, "assets": [ { "name": "ClipshareQuick-1.2.3.msix", "url": "https://github.com/…", "sizeBytes": n, "sha256": "…"|null } ] }`
GitHub API 失敗時は最後に成功した結果を返す。一度も取得できていない場合は 503 `SERVICE_UNAVAILABLE`。
- `version` はリリースのタグ名から先頭の `v` を除いたもの。`sha256` は GitHub が asset の digest を返す場合のみ（無ければ null）。`minSupportedVersion`・リポジトリ・キャッシュ時間は管理画面の設定値。

## 変更履歴
- v1 (2026-11-20): 初版（設計案）。
- v1.1 (2026-11-21): Clipshare側 Step 0 の現行コード確認による更新。**すべて追加・明確化で互換維持**。
  - 認可URLに任意パラメータ `device_platform` を追加（デザイン07/13 の OS 表記のため）。各パラメータの文字数・形式を明記。許可/キャンセルのリダイレクトは 303（フォーム POST の応答のため）。
  - 任意の完了画面 `GET /qick/authorize/complete` を追加（ループバックからブラウザを戻す先）。不正リンクは redirect_uri に戻さないことを明記。
  - `POST /api/v1/auth/token`: トークン形式、使用済みコード再提示時の連動失効、403（BAN）、503（発行停止中）を明記。
  - `403 FORBIDDEN` に BAN を含むこと、nginx の HTML 413 の扱い、503 の追加理由、CORS 不可を明記。
  - `Limits` の数え方・リセット時刻・上限の出どころを現行実装に合わせて明記（日次は Web 経由と共有）。
  - `POST /api/v1/quick`: マジックバイト判定と対応形式、匿名は `original` でもバナーあり、`original` の寸法・品質、`deleteToken` は匿名のみ、動画は PROCESSING で返ることを確定。
  - `DELETE /api/v1/quick/{id}`: Bearer で削除できるのは API 経由のアップロードのみ（デザイン07 の許可内容「このアプリでアップロードしたファイルの削除」）。
  - `GET /api/v1/client/latest`: `sha256` を nullable に、未取得時 503 を追加。
  - セルフレビュー2回目: `file` はファイル名付きのパートで送ること（無いと 400）を明記。画像処理中のディスク不足などサーバー側の失敗は 415 ではなく 500（再試行対象）。
  - Step 3 実装時: 画像の画素数上限（1億画素、展開爆弾対策）を 413 `limitPixels` として追加。`DAILY_LIMIT_EXCEEDED` の details に `dailyLimit` を追加。
