#!/usr/bin/env bash
set -euo pipefail

# Deploy script executed on the VPS by the deploy user.
# It assumes scripts/install-ubuntu-24.sh has already created:
#   /var/www/clipeshare/current
#   /var/www/clipeshare/shared/.env.production
#   systemd services: clipeshare, clipeshare-worker, (optional) clipeshare-discord-bot
#
# 稼働中のサーバーは current の .next と node_modules を使い続けているため、
# そこで npm ci や rm -rf .next をするとビルドが終わるまで数分間ページが500になる。
# 依存関係の導入からビルドまでは別の作業ツリー(BUILD_DIR)で行い、
# すべて成功してから current へ入れ替えて再起動する。途中で失敗しても current は無傷のまま残る。

APP_NAME="${APP_NAME:-clipeshare}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
BRANCH="${BRANCH:-main}"
# 小規模VPS(物理RAMが少なくswap依存になる環境)でnext buildがヒープ不足でクラッシュするのを防ぐ。
# 必要に応じてVPS_HOST等と同様にGitHub Actions側の環境変数で上書きできる。
BUILD_NODE_OPTIONS="${BUILD_NODE_OPTIONS:---max-old-space-size=3072}"
# 入れ替え前のビルドの静的ファイルを残す日数。古いHTMLを開いたままのユーザーがJSを取得できるようにする。
STATIC_RETENTION_DAYS="${STATIC_RETENTION_DAYS:-7}"

CURRENT_DIR="${APP_DIR}/current"
BUILD_DIR="${APP_DIR}/build"
ENV_FILE="${APP_DIR}/shared/.env.production"

if [[ ! -d "${CURRENT_DIR}/.git" ]]; then
  echo "Repository is not cloned at ${CURRENT_DIR}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 1
fi

echo "==> Loading production environment"
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

echo "==> Fetching latest ${BRANCH}"
git -C "${CURRENT_DIR}" fetch origin "${BRANCH}"
TARGET_COMMIT="$(git -C "${CURRENT_DIR}" rev-parse "origin/${BRANCH}")"

echo "==> Preparing build worktree at ${BUILD_DIR}"
# current の worktree として作るので、認証情報もオブジェクトも共有でき、再クローンは不要。
# main は current でチェックアウトしているため、こちらは detached HEAD にする。
if [[ ! -e "${BUILD_DIR}/.git" ]]; then
  rm -rf "${BUILD_DIR}"
  git -C "${CURRENT_DIR}" worktree prune
  git -C "${CURRENT_DIR}" worktree add --detach "${BUILD_DIR}" "${TARGET_COMMIT}"
fi

cd "${BUILD_DIR}"
git checkout --detach --force "${TARGET_COMMIT}"
git reset --hard "${TARGET_COMMIT}"
ln -sfn "${ENV_FILE}" "${BUILD_DIR}/.env.production"

echo "==> Installing dependencies"
npm ci --include=dev

echo "==> Generating Prisma client"
if [[ -f "prisma/schema.prisma" ]]; then
  npx prisma generate
fi

echo "==> Running database migrations"
if [[ -f "prisma/schema.prisma" ]]; then
  npx prisma migrate deploy
fi

echo "==> Seeding database defaults"
if [[ -f "prisma/schema.prisma" ]]; then
  npx prisma db seed
fi

echo "==> Clearing stale Next.js build output"
# .next/types はNext.jsがルートファイルの型を検査するために前回のビルドから生成した
# 派生ファイル群で、ソースでファイルをリネーム/削除すると存在しないファイルを指したまま残る。
# 先にtscを走らせる構成だとビルドが一度も走らないうちは更新されず、tscが毎回誤って
# 失敗し続ける(ビルドが動かないと直らない、が先にtscで止まる)ため、tscの前に必ず消す。
rm -rf .next

echo "==> Type-checking"
NODE_OPTIONS="${BUILD_NODE_OPTIONS}" npx tsc --noEmit

echo "==> Linting"
NODE_OPTIONS="${BUILD_NODE_OPTIONS}" npx eslint .

echo "==> Building application"
# next build内蔵の型チェック/lintはnext.config.tsでスキップ設定済み(上のtsc/eslintで代替済みのため)。
# ビルド自体のワーカープロセスにもヒープ上限を渡す。
NODE_OPTIONS="${BUILD_NODE_OPTIONS}" npm run build

echo "==> Carrying over previous static assets"
# ファイル名にハッシュが付くので上書きの衝突は起きない。-p で元の更新日時を保ち、
# 保持期間を過ぎた旧ファイルだけを削除する(今回のビルドで生成したファイルは新しいので残る)。
if [[ -d "${CURRENT_DIR}/.next/static" ]]; then
  cp -rnp "${CURRENT_DIR}/.next/static/." "${BUILD_DIR}/.next/static/"
  find "${BUILD_DIR}/.next/static" -type f -mtime "+${STATIC_RETENTION_DAYS}" -delete
fi

echo "==> Switching current to ${TARGET_COMMIT}"
# ここから再起動までが、旧サーバーから見て成果物が入れ替わる区間。mv は同一ファイルシステム内の
# リネームなので一瞬で終わり、直後に再起動する。
cd "${CURRENT_DIR}"
git checkout "${BRANCH}"
git reset --hard "${TARGET_COMMIT}"
ln -sfn "${ENV_FILE}" "${CURRENT_DIR}/.env.production"
# storage が実体のディレクトリになっていると ln -sfn はその中に storage/storage を作ろうとして失敗し、
# ソースだけ新しく成果物は古いまま止まってしまう。既に何かあれば触らない。
if [[ ! -e "${CURRENT_DIR}/storage" ]]; then
  ln -s "${APP_DIR}/storage" "${CURRENT_DIR}/storage"
fi

rm -rf "${CURRENT_DIR}/.next.previous" "${CURRENT_DIR}/node_modules.previous"
if [[ -d "${CURRENT_DIR}/.next" ]]; then
  mv "${CURRENT_DIR}/.next" "${CURRENT_DIR}/.next.previous"
fi
mv "${BUILD_DIR}/.next" "${CURRENT_DIR}/.next"
if [[ -d "${CURRENT_DIR}/node_modules" ]]; then
  mv "${CURRENT_DIR}/node_modules" "${CURRENT_DIR}/node_modules.previous"
fi
mv "${BUILD_DIR}/node_modules" "${CURRENT_DIR}/node_modules"

echo "==> Restarting services"
sudo systemctl restart "${APP_NAME}.service"
if systemctl list-unit-files | grep -q "^${APP_NAME}-worker.service"; then
  sudo systemctl restart "${APP_NAME}-worker.service"
fi
if systemctl list-unit-files | grep -q "^${APP_NAME}-discord-bot.service"; then
  sudo systemctl restart "${APP_NAME}-discord-bot.service"
fi
if systemctl list-unit-files | grep -q "^${APP_NAME}-live-chat.service"; then
  sudo systemctl restart "${APP_NAME}-live-chat.service"
fi
if systemctl list-unit-files | grep -q "^${APP_NAME}-live-mpegts.service"; then
  sudo systemctl restart "${APP_NAME}-live-mpegts.service"
fi

echo "==> Cleaning up previous build output"
rm -rf "${CURRENT_DIR}/.next.previous" "${CURRENT_DIR}/node_modules.previous"

echo "==> Deployment complete"
