# Clipshare Quick 本番反映手順（feature/quickshare-api-v1）

> この手順は**人が実施する**。Claude Code は本番DB・本番サーバーへの操作、`main` へのマージを行っていない。
> 対象: マイグレーション `20261121000000_add_quickshare_api_tokens`（追加のみ）と、Clipshare Quick 向けの API・画面。

## 0. 事前確認（ローカル / PR 上）
- [ ] PR の CI 相当: `npm.cmd ci` → `npx prisma generate` → `npm.cmd run typecheck` → `npm.cmd run lint` → `npm.cmd test` → `npm.cmd run build` がすべて通る。
- [ ] マイグレーション SQL を目視確認（`prisma/migrations/20261121000000_add_quickshare_api_tokens/migration.sql`）。`DROP` / `MODIFY` / `TRUNCATE` / `DELETE` が無いこと（`tests/migrations.test.ts` でも検査）。
  - 含まれるデータ更新は2文だけ: ① `quick_share_max_image_bytes` が旧既定値 `20000000` のときだけ `50000000` に更新、② 既存の全 AccountLevel にクイック共有上限（サイト全体設定の現在値）をコピー。
- [ ] 検証済み: MySQL 8.4 の使い捨てコンテナで「既存マイグレーション適用 → 既存相当データ投入 → 本マイグレーション適用 → ロールバック SQL → 再適用」を実施し成功（2026-11-21）。
- [ ] `main` へのマージは PR レビュー後に人が行う。

## 1. 反映前の確認（本番サーバー）
```sh
cd /path/to/clipeshare           # 本番の配置ディレクトリ
git fetch origin
git status                        # 作業ツリーがきれいなこと
npx prisma migrate status         # 未適用は本マイグレーションのみであること
```
- ディスク空き容量（`df -h`）: アップロードの一時ファイルは `storage/uploads/originals/quick/incoming/` に書かれる（受信完了後に削除）。
- 時刻帯: 1日上限のリセットは**サーバーのローカル時刻の0時**（現行の /qick と同じ）。`timedatectl` で想定どおりか確認。

## 2. バックアップ（必須）
```sh
# 認証情報は ~/.my.cnf など対話入力で渡し、コマンドラインに書かない
mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
  -h <DB_HOST> -u <DB_USER> -p <DB_NAME> | gzip > ~/backup/clipeshare-$(date +%Y%m%d-%H%M%S)-pre-quickshare.sql.gz
ls -lh ~/backup/                  # サイズが 0 でないこと
gunzip -t ~/backup/clipeshare-*-pre-quickshare.sql.gz   # 壊れていないこと
```

## 3. 反映
1. `main` にマージ後、通常のデプロイ手順で反映する（`scripts/deploy-server.sh` は `npx prisma migrate deploy` を実行する）。
   - 手動の場合:
     ```sh
     git pull --ff-only origin main
     npm ci
     npx prisma generate
     npx prisma migrate deploy      # 本番は migrate deploy のみ。migrate dev / db push は使わない
     npm run build
     sudo systemctl restart clipeshare.service
     ```
2. ワーカー（動画変換）は変更なし。ただし `npm ci` 後は念のため再起動: `sudo systemctl restart clipeshare-worker.service`。
3. 適用結果の確認:
   ```sql
   SHOW TABLES LIKE 'Api%';                                   -- ApiAuthorization, ApiToken
   SELECT name, quickShareImageMaxBytes, quickShareVideoMaxBytes FROM AccountLevel;
   SELECT `key`, value FROM SiteSetting WHERE `key` LIKE 'quick_share_%';
   ```

## 4. nginx の設定（推奨・要判断）
- **X-Forwarded-For の上書き**（QUESTIONS Q-017）: 現在 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`（追記）のため、クライアントが送った値が先頭に残り、匿名の1日上限・匿名レート制限・認証失敗の制限を回避できる（既存の /qick にもある弱点）。nginx の前段に CDN/プロキシが**無い**場合は次に変更する:
  ```nginx
  proxy_set_header X-Forwarded-For $remote_addr;
  ```
  前段に Cloudflare 等がある場合は `set_real_ip_from` + `real_ip_header` で実IPを復元してから上書きする。変更後 `sudo nginx -t && sudo systemctl reload nginx`。
- **リクエストのバッファリング**: `proxy_request_buffering` は既定（on）のままにする。アプリは上限超過や形式不正を受信途中で打ち切るため、nginx を通さず Next に直接送ると 413/415 の JSON の代わりに接続リセットになることがある。
- **アップロードの上限**: `client_max_body_size 512m;`（現状）。アプリの上限 `0`（無制限）にしても nginx のこの値が実質の上限になる。nginx が返す 413 は HTML なので、クライアントは JSON でない 413 もサイズ超過として扱う（契約に記載済み）。
- `/media/` を nginx が直接配信している場合、`/media/quick/images/*.webp` が `Content-Type: image/webp` で返ることを確認（OGP 画像に使う）。

## 5. 設定値（管理画面）
| 画面 | 項目 | 既定値 |
|---|---|---|
| 管理 › クイック共有 | 画像/動画の上限（MB）、保存時間、未ログインの1日あたり件数 | 50 / 200 / 24 / 5 |
| 管理 › クイック共有 › アカウントレベル一覧 | クイック共有 画像MB / 動画MB（0=無制限、空欄=サイト設定） | 移行時にサイト設定の値をコピー |
| 管理 › 連携トークン › Clipshare Quick 連携の設定 | 新しい連携を受け付ける（緊急停止） | ON |
| 同上 | レート制限: トークン（回/分）/ 未ログイン（回/分）/ 認証失敗（回/10分） | 30 / 10 / 20（0=無制限） |
| 同上 | 配布元 GitHub リポジトリ / 最小対応バージョン / キャッシュ秒 / 対応OS | `choko1229/clipshare-qick` / 空 / 600 / `Windows 11` |

`.env` の追加は**不要**（既存の `NEXT_PUBLIC_APP_URL` を共有URL・OGP の絶対URLに使う。本番では `https://clipshare.link` であること）。

## 6. スモークテスト（本番）
`B=https://clipshare.link`、`UA='ClipshareQuick/0.0.0 (Windows)'`。テスト用の画像 `photo.jpg` と動画 `clip.mp4` を用意。

1. **匿名アップロード**
   ```sh
   curl -s -A "$UA" -F "file=@photo.jpg" $B/api/v1/quick
   ```
   → `201`、`url` が `$B/q/{id}`、`deleteToken` あり。ブラウザで開くと画像下部にバナー。
2. **ブラウザ認可 → トークン**（実クライアントが無ければ以下で代用）
   - 端末で `code_verifier` を作り（43〜128文字）、`code_challenge = BASE64URL(SHA256(verifier))`。
   - `127.0.0.1:53999` で待ち受ける簡易サーバーを立て（例: `python3 -m http.server 53999 --bind 127.0.0.1` でもアクセスログに code が出る）、
     `$B/qick/authorize?client_id=clipshare-quick&redirect_uri=http://127.0.0.1:53999/callback&state=t1&code_challenge=<challenge>&code_challenge_method=S256&connection_code=ABC-DEF&device_name=SMOKE-PC&device_platform=Windows%2011` を開く。
   - 接続コード `ABC-DEF` が表示されること → 「許可する」→ ループバックに `code` と `state=t1` が届く。
   - `curl -s -X POST $B/api/v1/auth/token -H 'content-type: application/json' -d '{"code":"…","code_verifier":"…","redirect_uri":"http://127.0.0.1:53999/callback"}'` → `200` とトークン（**以後は端末内でのみ扱い、ログやチャットに貼らない**）。
   - 同じ code で再度交換 → `400`（このとき発行済みトークンも失効するので、確認後は認可をやり直す）。
3. **トークンでアップロード**: `curl -s -A "$UA" -H "authorization: Bearer $TOKEN" -F "file=@photo.jpg" -F quality=original $B/api/v1/quick` → `201`、`deleteToken` なし、バナーなし、EXIF なし（`exiftool` 等で確認）。
4. **動画**: `-F "file=@clip.mp4"` → `201`、`status: PROCESSING`。数十秒後に `/q/{id}` が変換後の mp4 を返す（ワーカー稼働確認）。
5. **削除**: `curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "authorization: Bearer $TOKEN" $B/api/v1/quick/{id}` → `204`、もう一度 → `404`。匿名は `-H "x-delete-token: …"` で `204`。
6. **無効トークン**: `-H 'authorization: Bearer csq_invalid'` → `401`（匿名として成功しないこと）。
7. **連携アプリ**: `$B/settings/apps` に `SMOKE-PC` が出る → 「解除」→ そのトークンで `/api/v1/me` が `401`。
8. **管理画面**: `$B/admin/api-tokens` でトークン値が表示されないこと、失効でき `操作ログ` に `api_token.revoke` が残ること。
9. **OGP**: 下記「OGP の表示確認」を実施。
10. **既存 Web の回帰**: `/qick` で匿名・ログイン中それぞれ画像を1枚アップロード → 従来どおりバナー付き・URL発行・削除できる。`/login` から通常ログインして `/` に戻る。
11. **ダウンロードページ**: `$B/qick/download` が表示される（リリースが無い間はバージョン表記なしで GitHub のリリースページへリンク）。`$B/api/v1/client/latest` はリリース公開後に `200`。

## OGP の表示確認（Discord / X）
公開URLでしか確認できないため、本番（またはインターネットから見えるステージング）で人が行う。

1. 画像を1枚アップロードする（`/qick`、または `POST /api/v1/quick`）。返ってきた `https://clipshare.link/q/{id}` を控える。
2. HTML のメタタグを確認する（クローラーと同じく `Accept: text/html` で取得すると `/q/{id}/view` にリダイレクトされる）:
   ```sh
   curl -sL -H 'Accept: text/html' -A 'Discordbot/2.0' https://clipshare.link/q/{id} | grep -oE '<meta (property|name)="(og:[a-z:_]+|twitter:[a-z]+|robots)" content="[^"]*"'
   ```
   期待値: `og:title`=`クイック共有 · 画像`、`og:description`=`24時間後に自動で削除されます。`、`og:site_name`=`Clipshare`、`og:image`=`https://clipshare.link/media/quick/images/{id}.webp`（og:image は1つだけ）、`twitter:card`=`summary_large_image`、`robots`=`noindex, nofollow`。（ローカル + MySQL 8.4 で同じ出力を確認済み）
3. `og:image` の URL を `curl -I` して `200` と `Content-Type: image/webp` を確認する。
4. Discord の任意のチャンネル（テスト用サーバー）に `https://clipshare.link/q/{id}` を貼り、画像付きのカードが出ることを確認する。
5. X の投稿作成画面に同じURLを貼り、カード（大きい画像）が出ることを確認する（投稿前のプレビューで確認可能）。
6. 動画でも同じ確認をする。変換完了（`READY`）後は `og:image`=サムネイル、`og:video`=mp4。処理中（`PROCESSING`）はメディアのタグを出さない。
   - Discord は `og:video` で動画プレーヤー、X は `summary_large_image`（サムネイル）になる想定。表示されない場合は結果を `docs/quickshare/QUESTIONS.md` に記録する。
7. 期限切れ（または削除済み）の URL ではメディアのタグが出ないことを確認する。

## 7. 緊急時
- **トークン発行の緊急停止**: 管理 › 連携トークン › 「新しい連携を受け付ける」を OFF（新規の認可・トークン交換が止まる。既存トークンは有効のまま）。
- **全トークンの一括失効**（漏えいが疑われるとき）:
  ```sql
  UPDATE `ApiToken` SET `revokedAt` = NOW(3), `revokedReason` = 'ADMIN' WHERE `revokedAt` IS NULL;
  ```
  （監査のため、実施した旨を `AdminAuditLog` に手動で記録するか、管理画面から個別に失効させる）
- **特定ユーザーのトークン失効**: 管理 › 連携トークン でユーザー名を絞り込み「失効」。

## 8. ロールバック
### アプリだけ戻す（推奨。DB はそのまま）
追加したテーブル・列は旧コードから参照されないため、**DB を戻さずに**旧リリースへ戻せる。
```sh
git checkout <前回のリリースのコミット>
npm ci && npx prisma generate && npm run build
sudo systemctl restart clipeshare.service
```
- 注意: 旧コードはクイック共有のレベル別上限を使わず、サイト全体設定だけを見る（画像上限は 50MB のまま）。

### DB も戻す（必要な場合のみ。先に必ずアプリを戻す）
2026-11-21 に MySQL 8.4 で動作確認済みの SQL:
```sql
ALTER TABLE `QuickShare` DROP FOREIGN KEY `QuickShare_apiTokenId_fkey`;
DROP INDEX `QuickShare_apiTokenId_createdAt_idx` ON `QuickShare`;
ALTER TABLE `QuickShare` DROP COLUMN `apiTokenId`;
DROP TABLE `ApiAuthorization`;
DROP TABLE `ApiToken`;
ALTER TABLE `AccountLevel` DROP COLUMN `quickShareImageMaxBytes`, DROP COLUMN `quickShareVideoMaxBytes`;
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20261121000000_add_quickshare_api_tokens';
-- 任意: 画像上限を 20MB に戻す(マイグレーションで 50MB にした場合のみ)
UPDATE `SiteSetting` SET `value` = '20000000' WHERE `key` = 'quick_share_max_image_bytes' AND `value` = '50000000';
-- 任意: Clipshare Quick 用の設定を消す
DELETE FROM `SiteSetting` WHERE `key` LIKE 'quick\_api\_%' OR `key` LIKE 'quick\_client\_%';
```
- `ApiToken` を消すと全端末の連携が失われる（再認可が必要）。API 経由でアップロード済みのクイック共有は `userId` で残る。
- どうしても戻せない場合はバックアップ（手順2）からリストアする。

## 9. 反映後の監視
- アプリログは1行 JSON（`event` 付き）。確認すべきイベント:
  - `api.request`（`status`/`code`/`durationMs`/`route`）… 5xx の増加
  - `api_auth.repeated_failures`（同一IPからの認証失敗の連続）
  - `api_auth.code_reuse`（認可コードの再使用 = 漏えいの疑い）
  - `quick_client.release_fetch_failed`（GitHub API 失敗。前回結果で継続）
- ログにトークン・Authorization・ファイル内容は出ない（`tests/api-log.test.ts` 等で検査）。
- 受信途中の一時ファイルは `npm run cleanup:quick-share`（既存の systemd timer）が24時間後に削除する。
