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
EMAIL_SERVER_HOST
EMAIL_SERVER_PORT
EMAIL_SERVER_USER
EMAIL_SERVER_PASSWORD
EMAIL_FROM
NEXT_PUBLIC_APP_URL
AUTH_URL
```

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

ログ確認:

```bash
journalctl -u clipeshare -f
journalctl -u clipeshare-worker -f
```

再起動:

```bash
sudo systemctl restart clipeshare
sudo systemctl restart clipeshare-worker
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
