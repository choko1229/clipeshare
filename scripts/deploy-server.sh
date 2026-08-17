#!/usr/bin/env bash
set -euo pipefail

# Deploy script executed on the VPS by the deploy user.
# It assumes scripts/install-ubuntu-24.sh has already created:
#   /var/www/clipeshare/current
#   /var/www/clipeshare/shared/.env.production
#   systemd services: clipeshare, clipeshare-worker, (optional) clipeshare-discord-bot

APP_NAME="${APP_NAME:-clipeshare}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
BRANCH="${BRANCH:-main}"
# 小規模VPS(物理RAMが少なくswap依存になる環境)でnext buildがヒープ不足でクラッシュするのを防ぐ。
# 必要に応じてVPS_HOST等と同様にGitHub Actions側の環境変数で上書きできる。
BUILD_NODE_OPTIONS="${BUILD_NODE_OPTIONS:---max-old-space-size=3072}"

CURRENT_DIR="${APP_DIR}/current"
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

cd "${CURRENT_DIR}"

echo "==> Fetching latest ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Linking production environment"
ln -sfn "${ENV_FILE}" "${CURRENT_DIR}/.env.production"
if [[ -L "${CURRENT_DIR}/storage" ]]; then
  rm "${CURRENT_DIR}/storage"
fi

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

echo "==> Linking shared storage"
ln -sfn "${APP_DIR}/storage" "${CURRENT_DIR}/storage"

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

echo "==> Deployment complete"
