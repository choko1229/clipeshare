# KAGOYA CLOUD VPS デプロイ設計

## 前提

- VPS: KAGOYA CLOUD VPS
- OS: Ubuntu Server 24.04 LTS
- アプリケーションテンプレート: 指定しない
- Web: Next.js App Router
- DB: MySQL
- Webサーバー: Nginx
- SSL: Let's Encrypt + Certbot
- 動画処理: FFmpeg
- プロセス管理: systemd
- Docker: 使わない
- Cloudflare: 使わない

## 推奨スペック

MVP本番は4GBプランから開始します。

| 用途 | 推奨プラン |
| --- | --- |
| 検証 | 2GB |
| MVP本番 | 4GB |
| 動画投稿が増える | 8GB |
| 変換待ちを減らしたい | 8GB以上 |

4GBプランではFFmpegの同時変換数は1にします。動画投稿が増えたら8GBへスケールアップします。

## 初期構成

```txt
Internet
  -> HTTPS :443
  -> Nginx
  -> Next.js :3000
  -> MySQL
  -> FFmpeg worker

/media/*
  -> /var/www/clipeshare/storage/uploads/processed/*
```

## サーバー初期セットアップ

DNSのAレコードをVPSのIPv4へ向けた後、rootで以下を実行します。

```bash
DOMAIN=example.com \
EMAIL=admin@example.com \
APP_REPO=git@github.com:OWNER/clipeshare.git \
DEPLOY_PUBLIC_KEY="ssh-ed25519 ..." \
bash scripts/install-ubuntu-24.sh
```

`DEPLOY_PUBLIC_KEY` はGitHub Actionsや作業PCからVPSへSSH接続するための公開鍵です。

## インストールスクリプトが行うこと

- Ubuntuパッケージ更新
- Nginxインストール
- MySQLインストール
- FFmpegインストール
- Node.js 22インストール
- deployユーザー作成
- `/var/www/clipeshare` 作成
- storageディレクトリ作成
- systemd service作成
- Nginx reverse proxy設定
- `/media/` 静的配信設定
- UFW設定
- Let's Encrypt証明書発行
- Gitリポジトリclone

## セットアップ後に必ず変更する値

`/var/www/clipeshare/shared/.env.production` を編集します。

```txt
DATABASE_URL
AUTH_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN
DISCORD_BOT_INGEST_SECRET
EMAIL_SERVER_HOST
EMAIL_SERVER_PORT
EMAIL_SERVER_USER
EMAIL_SERVER_PASSWORD
EMAIL_FROM
NEXT_PUBLIC_APP_URL
AUTH_URL
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_CONTACT
```

`DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` はDiscordログイン(OAuth)用、`DISCORD_BOT_TOKEN` はDiscord自動ミラーBot用で、それぞれDiscord Developer Portalで別のアプリケーション/Botとして発行します。`DISCORD_BOT_INGEST_SECRET` はBotプロセスとWebアプリ間の内部認証用に自分で生成する任意の乱数文字列です(`openssl rand -hex 32` など)。

MySQLの初期パスワードも必ず変更します。インストールスクリプト内の `CHANGE_ME` は仮値です。

## GitHubから自動反映する方法

`.github/workflows/deploy.yml` を使います。

GitHub repository secrets:

| Secret | 内容 |
| --- | --- |
| `VPS_HOST` | VPSのIPアドレスまたはホスト名 |
| `VPS_USER` | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | deployユーザーへ接続できる秘密鍵 |

GitHub repository variables:

| Variable | 内容 | 省略時 |
| --- | --- | --- |
| `APP_NAME` | systemd service名 | `clipeshare` |
| `APP_DIR` | アプリ配置先 | `/var/www/clipeshare` |

mainブランチへpushすると、GitHub ActionsがVPSへSSH接続し、以下を実行します。

```bash
/var/www/clipeshare/current/scripts/deploy-server.sh
```

## デプロイスクリプトが行うこと

- `git fetch`
- `git reset --hard origin/main`
- `.env.production` のリンク
- `npm ci`
- `prisma generate`
- `prisma migrate deploy`
- `prisma db seed`
- `npm run build`
- `systemctl restart clipeshare`
- `systemctl restart clipeshare-worker`

## systemd service

Web:

```txt
clipeshare.service
```

Worker:

```txt
clipeshare-worker.service
```

Discord自動ミラーBot(任意):

```txt
clipeshare-discord-bot.service
```

ログ確認:

```bash
journalctl -u clipeshare -f
journalctl -u clipeshare-worker -f
journalctl -u clipeshare-discord-bot -f
```

再起動:

```bash
sudo systemctl restart clipeshare
sudo systemctl restart clipeshare-worker
sudo systemctl restart clipeshare-discord-bot
```

### Discord自動ミラーBotの有効化(既存サーバーへの追加手順)

`scripts/install-ubuntu-24.sh` は `clipeshare-discord-bot.service` のユニットファイルを作成しますが、`DISCORD_BOT_TOKEN` が未設定のまま自動起動すると失敗するため、`enable`/`start` はコメントアウトしてあります。既にセットアップ済みのサーバーに追加する場合は以下を行います。

1. Discord Developer PortalでBotアプリケーションを作成し、Message Content Intentを有効化してトークンを発行する
2. `.env.production` に `DISCORD_BOT_TOKEN` と `DISCORD_BOT_INGEST_SECRET` を設定する
3. `scripts/install-ubuntu-24.sh` 内の `clipeshare-discord-bot.service` の部分を参考に、`/etc/systemd/system/clipeshare-discord-bot.service` を作成する(既にインストール済みなら再実行不要、ユニットファイルだけ手動で作成する)
4. `sudo systemctl daemon-reload && sudo systemctl enable --now clipeshare-discord-bot.service`
5. 対象のDiscordサーバーにBotを招待し、管理権限を持つユーザーが `!clipshare setup <ゲーム名>` を実行して既定のゲームを設定する
6. Clipshare側でユーザーが `設定 > プロフィール編集 > Discord連携` から自動保存をONにする(Discordログイン連携済みのユーザーのみ)

以降のデプロイでは `scripts/deploy-server.sh` がユニットの存在を検知して自動的に再起動します。

### クイック共有(/qick)の期限切れメディア自動削除

`/qick` からアップロードされた画像/動画は `QuickShare` テーブルの `expiresAt` を過ぎると `scripts/cleanup-quickshare.mjs`(`npm run cleanup:quick-share`)で物理削除されます。`scripts/install-ubuntu-24.sh` は `clipeshare-cleanup-quickshare.service`/`.timer`(10分おきに実行)を作成し自動的に有効化しますが、既にセットアップ済みのサーバーに追加する場合は以下を行います。

1. `scripts/install-ubuntu-24.sh` 内の `clipeshare-cleanup-quickshare.service`/`clipeshare-cleanup-quickshare.timer` の部分を参考に、`/etc/systemd/system/` に同名のユニットファイルを作成する
2. `sudo systemctl daemon-reload && sudo systemctl enable --now clipeshare-cleanup-quickshare.timer`
3. `sudo systemctl list-timers clipeshare-cleanup-quickshare.timer` で稼働を確認する

ログ確認:

```bash
journalctl -u clipeshare-cleanup-quickshare -f
```

手動実行(動作確認用、削除せず対象だけ確認する場合は `--dry-run` を付ける):

```bash
cd /var/www/clipeshare/current && npm run cleanup:quick-share -- --dry-run
```

## SSL

SSLはLet's Encryptで発行します。

- HTTPはHTTPSへリダイレクト
- 投稿詳細URLはHTTPS
- OGP画像URLもHTTPS絶対URL
- HLS配信URLもHTTPS

更新確認:

```bash
sudo certbot renew --dry-run
```

## 注意点

- アプリのコードがまだない状態では、systemd serviceの起動は失敗します
- 初回は `.env.production` を正しく埋めてからデプロイします
- DBパスワードは必ず変更します
- FFmpeg同時変換数は初期1にします
- HLSセグメントはService Workerのキャッシュ対象外にします
- `/media/` は公開ファイルだけを置く場所にします
