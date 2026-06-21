#!/usr/bin/env bash
set -euo pipefail

# Deploy script executed on the VPS by the deploy user.
# It assumes scripts/install-ubuntu-24.sh has already created:
#   /var/www/clipeshare/current
#   /var/www/clipeshare/shared/.env.production
#   systemd services: clipeshare, clipeshare-worker

APP_NAME="${APP_NAME:-clipeshare}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
BRANCH="${BRANCH:-main}"

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
ln -sfn "${APP_DIR}/storage" "${CURRENT_DIR}/storage"

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

echo "==> Building application"
npm run build

echo "==> Restarting services"
sudo systemctl restart "${APP_NAME}.service"
if systemctl list-unit-files | grep -q "^${APP_NAME}-worker.service"; then
  sudo systemctl restart "${APP_NAME}-worker.service"
fi

echo "==> Deployment complete"
