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

ライブ配信チャット/プレゼンスサーバー(任意):

```txt
clipeshare-live-chat.service
```

ログ確認:

```bash
journalctl -u clipeshare -f
journalctl -u clipeshare-worker -f
journalctl -u clipeshare-discord-bot -f
journalctl -u clipeshare-live-chat -f
```

再起動:

```bash
sudo systemctl restart clipeshare
sudo systemctl restart clipeshare-worker
sudo systemctl restart clipeshare-discord-bot
sudo systemctl restart clipeshare-live-chat
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

### ライブ配信機能の有効化(既存サーバーへの追加手順)

`/live`・`/l/{token}` のライブ配信機能を有効化するには、Next.js本体に加えて (1) RTMP/HLS/RTSPを扱うメディアサーバー(MediaMTX)と (2) チャット/視聴者数/オフライン検知を行う `clipeshare-live-chat.service` が必要です。詳しい仕様は `docs/live-feature-spec.md`、技術選定の背景は `docs/live-feature-feasibility.md` を参照してください。

#### 1. DNSとサブドメイン

`live.clipshare.link` のようなライブ配信専用サブドメインを用意し、AレコードをVPSのIPへ向けます。

#### 2. MediaMTXの導入

MediaMTXはUbuntuの標準パッケージには無いため、[GitHub Releases](https://github.com/bluenviron/mediamtx/releases)からバイナリを取得します。

```bash
MEDIAMTX_VERSION=v1.9.3
curl -L -o /tmp/mediamtx.tar.gz \
  "https://github.com/bluenviron/mediamtx/releases/download/${MEDIAMTX_VERSION}/mediamtx_${MEDIAMTX_VERSION}_linux_amd64.tar.gz"
sudo mkdir -p /opt/mediamtx
sudo tar -xzf /tmp/mediamtx.tar.gz -C /opt/mediamtx
```

`scripts/mediamtx.yml.example` を `/opt/mediamtx/mediamtx.yml` としてコピーし、`__LIVE_MEDIA_HOOK_SECRET__` と `__APP_URL__` を実際の値に置き換えます。

```bash
sudo tee /etc/systemd/system/clipeshare-mediamtx.service > /dev/null <<'EOF'
[Unit]
Description=MediaMTX (clipshare live streaming)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/mediamtx
ExecStart=/opt/mediamtx/mediamtx /opt/mediamtx/mediamtx.yml
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now clipeshare-mediamtx.service
```

MediaMTXは以下のポートで待受します(すべてループバックまたはUFWで制限し、Nginx経由以外の直接公開はしません)。

| ポート | 用途 |
| --- | --- |
| 1935 | RTMP入稿(OBS用、外部公開) |
| 8554 | RTSP出力(VRChat PC版用、外部公開) |
| 8888 | HLS/HTTP配信(内部のみ、Nginxがリバースプロキシ) |
| 9997 | Control API(内部のみ、`127.0.0.1`にバインド) |

#### 3. Next.js側の環境変数

`.env.production` に以下を追加します。

```txt
LIVE_MEDIA_DOMAIN=live.clipshare.link
LIVE_MEDIA_HOOK_SECRET=(openssl rand -hex 32 などで生成)
LIVE_CHAT_TOKEN_SECRET=(openssl rand -hex 32 などで生成)
LIVE_MEDIAMTX_API_URL=http://127.0.0.1:9997
LIVE_CHAT_SERVER_PORT=8081
NEXT_PUBLIC_LIVE_WS_URL=wss://live.clipshare.link/ws
```

`LIVE_MEDIA_HOOK_SECRET` は `mediamtx.yml` の `runOnPublish`/`runOnPublishEnd` に埋め込んだ値と一致させます。`LIVE_CHAT_TOKEN_SECRET` は `clipeshare-live-chat.service` 側でも同じ値を読み込みます(`.env.production` を共有しているため追加設定は不要)。

#### 4. clipeshare-live-chatサービスの有効化

`scripts/install-ubuntu-24.sh` は `clipeshare-live-chat.service` のユニットファイルを作成しますが、`LIVE_CHAT_TOKEN_SECRET` が未設定のまま自動起動すると失敗するため `enable`/`start` はコメントアウトしてあります。上記の環境変数を設定したうえで以下を実行します。

```bash
sudo systemctl enable --now clipeshare-live-chat.service
```

#### 5. Nginxの追加設定

certbotの`--nginx`プラグインは、対象ドメインの**既存の80番ポートのserver block**を見つけてSSL設定を後付けする仕組みです。そのため、最初はSSLなし(80番のみ)の設定を作り、`nginx -t`が通る状態にしてからcertbotを実行します。順番を逆にする(いきなり`listen 443 ssl`を書く)と証明書が無い状態でNginxが起動できず失敗します。

`live.clipshare.link` 用のserver blockを追加します(既存の`${APP_NAME}`設定とは別ファイルにします)。

```bash
sudo tee /etc/nginx/sites-available/clipeshare-live > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name live.clipshare.link;

    # HLS(Web視聴・VRChat MPEG-TS向け)
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin *;
    }

    # チャット/視聴者数WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
EOF
sudo ln -sfn /etc/nginx/sites-available/clipeshare-live /etc/nginx/sites-enabled/clipeshare-live
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t`が`syntax is ok` / `test is successful`になっていることを確認してから次に進みます。80/443番ポートは`${APP_NAME}.service`セットアップ時に`ufw allow 'Nginx Full'`で既に開放済みのはずなので、追加のUFW設定は不要です(未実施の場合のみ`sudo ufw allow 'Nginx Full'`を実行)。

DNSが反映されていること(`dig live.clipshare.link`でVPSのIPが返ること)を確認したうえで、certbotを実行します。`--nginx`プラグインが自動的に`listen 443 ssl`とHTTPS証明書のパス、80→443のリダイレクトを既存のserver blockに追記します。

```bash
sudo certbot --nginx -d live.clipshare.link --email "${EMAIL}" --agree-tos --non-interactive --redirect
sudo nginx -t
sudo systemctl reload nginx
```

RTMP(1935)とRTSP(8554)はNginxを経由せず、MediaMTXへ直接到達させます(UFWで許可)。

```bash
sudo ufw allow 1935/tcp
sudo ufw allow 8554/tcp
```

#### 6. 動作確認

1. OBSの「配信」設定で、サーバーに `rtmp://live.clipshare.link/live`、ストリームキーに `/live` ページで発行された値を入力する
2. 配信を開始し、`/live` ページのプレビューと状態バッジが「配信中」になることを確認する
3. `/l/{視聴トークン}` を別ブラウザ(未ログイン)で開き、再生・チャット・いいねが動作することを確認する
4. VRChatのAVPro Video Playerに `/live` ページの「視聴リンク」カードに表示されたRTSP URLを入力し、再生できることを確認する(ワールド側の許可リストへの追加が別途必要な場合がある。`docs/live-feature-feasibility.md` の2章参照)

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
