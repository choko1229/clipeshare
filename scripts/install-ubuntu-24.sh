#!/usr/bin/env bash
set -euo pipefail

# Initial server setup for Clipeshare on Ubuntu Server 24.04 LTS.
# Run as root:
#   DOMAIN=example.com EMAIL=admin@example.com APP_REPO=git@github.com:owner/clipeshare.git DEPLOY_PUBLIC_KEY="ssh-ed25519 ..." bash scripts/install-ubuntu-24.sh
#
# Optional env:
#   APP_NAME=clipeshare
#   APP_DIR=/var/www/clipeshare
#   DEPLOY_USER=deploy
#   NODE_MAJOR=22
#   APP_PORT=3000
#   MEDIA_DIR=/var/www/clipeshare/storage/uploads/processed
#   ENABLE_CERTBOT=1

APP_NAME="${APP_NAME:-clipeshare}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
NODE_MAJOR="${NODE_MAJOR:-22}"
APP_PORT="${APP_PORT:-3000}"
MEDIA_DIR="${MEDIA_DIR:-${APP_DIR}/storage/uploads/processed}"
ENABLE_CERTBOT="${ENABLE_CERTBOT:-1}"

DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
APP_REPO="${APP_REPO:-}"
DEPLOY_PUBLIC_KEY="${DEPLOY_PUBLIC_KEY:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if [[ -z "${DOMAIN}" ]]; then
  echo "DOMAIN is required. Example: DOMAIN=example.com" >&2
  exit 1
fi

if [[ -z "${EMAIL}" ]]; then
  echo "EMAIL is required for Let's Encrypt. Example: EMAIL=admin@example.com" >&2
  exit 1
fi

echo "==> Updating packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "==> Installing base packages"
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  nginx \
  ufw \
  ffmpeg \
  mysql-server \
  certbot \
  python3-certbot-nginx \
  build-essential

echo "==> Installing Node.js ${NODE_MAJOR}"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
  | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs

echo "==> Creating deploy user"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${DEPLOY_USER}"
fi
usermod -aG www-data "${DEPLOY_USER}"

install -d -m 0755 "${APP_DIR}"
install -d -m 0755 "${APP_DIR}/releases"
install -d -m 0755 "${APP_DIR}/shared"
install -d -m 0755 "${APP_DIR}/storage"
install -d -m 0755 "${APP_DIR}/storage/uploads"
install -d -m 0755 "${APP_DIR}/storage/uploads/originals"
install -d -m 0755 "${APP_DIR}/storage/uploads/processed"
install -d -m 0755 "${APP_DIR}/storage/uploads/thumbnails"
install -d -m 0755 "${APP_DIR}/storage/temp"
install -d -m 0755 "${APP_DIR}/storage/deleted"
chown -R "${DEPLOY_USER}:www-data" "${APP_DIR}"

if [[ -n "${DEPLOY_PUBLIC_KEY}" ]]; then
  echo "==> Installing deploy public key"
  install -d -m 0700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
  touch "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  grep -qxF "${DEPLOY_PUBLIC_KEY}" "/home/${DEPLOY_USER}/.ssh/authorized_keys" \
    || echo "${DEPLOY_PUBLIC_KEY}" >> "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh/authorized_keys"
  chmod 0600 "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

echo "==> Creating shared environment file"
if [[ ! -f "${APP_DIR}/shared/.env.production" ]]; then
  cat > "${APP_DIR}/shared/.env.production" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
DATABASE_URL=mysql://clipeshare:CHANGE_ME@localhost:3306/clipeshare
AUTH_URL=https://${DOMAIN}
NEXTAUTH_URL=https://${DOMAIN}
AUTH_SECRET=CHANGE_ME
NEXTAUTH_SECRET=CHANGE_ME
DISCORD_CLIENT_ID=CHANGE_ME
DISCORD_CLIENT_SECRET=CHANGE_ME
EMAIL_SERVER_HOST=CHANGE_ME
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=CHANGE_ME
EMAIL_SERVER_PASSWORD=CHANGE_ME
EMAIL_FROM=no-reply@${DOMAIN}
MEDIA_ROOT=${APP_DIR}/storage/uploads/processed
ORIGINAL_UPLOAD_ROOT=${APP_DIR}/storage/uploads/originals
TEMP_UPLOAD_ROOT=${APP_DIR}/storage/temp
DELETED_UPLOAD_ROOT=${APP_DIR}/storage/deleted
EOF
  chown "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}/shared/.env.production"
  chmod 0600 "${APP_DIR}/shared/.env.production"
fi

echo "==> Creating MySQL database and user placeholder"
mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS clipeshare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'clipeshare'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON clipeshare.* TO 'clipeshare'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Writing systemd services"
cat > "/etc/systemd/system/${APP_NAME}.service" <<EOF
[Unit]
Description=Clipeshare Next.js web
After=network.target mysql.service

[Service]
Type=simple
User=${DEPLOY_USER}
Group=www-data
WorkingDirectory=${APP_DIR}/current
EnvironmentFile=${APP_DIR}/shared/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${APP_NAME}-worker.service" <<EOF
[Unit]
Description=Clipeshare background worker
After=network.target mysql.service

[Service]
Type=simple
User=${DEPLOY_USER}
Group=www-data
WorkingDirectory=${APP_DIR}/current
EnvironmentFile=${APP_DIR}/shared/.env.production
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}.service"
systemctl enable "${APP_NAME}-worker.service"

echo "==> Allowing deploy user to restart app services"
cat > "/etc/sudoers.d/${APP_NAME}-deploy" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/bin/systemctl restart ${APP_NAME}.service, /usr/bin/systemctl restart ${APP_NAME}-worker.service, /usr/bin/systemctl status ${APP_NAME}.service, /usr/bin/systemctl status ${APP_NAME}-worker.service
EOF
chmod 0440 "/etc/sudoers.d/${APP_NAME}-deploy"
visudo -cf "/etc/sudoers.d/${APP_NAME}-deploy"

echo "==> Configuring Nginx"
cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 512m;

    location /media/ {
        alias ${MEDIA_DIR}/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
            video/iso.segment m4s;
            video/mp4 mp4;
            image/webp webp;
            image/jpeg jpg jpeg;
            image/png png;
        }
        try_files \$uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
EOF

ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Configuring firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

if [[ "${ENABLE_CERTBOT}" == "1" ]]; then
  echo "==> Requesting Let's Encrypt certificate"
  certbot --nginx -d "${DOMAIN}" --email "${EMAIL}" --agree-tos --non-interactive --redirect
fi

if [[ -n "${APP_REPO}" && ! -d "${APP_DIR}/current/.git" ]]; then
  echo "==> Cloning application repository"
  sudo -u "${DEPLOY_USER}" git clone "${APP_REPO}" "${APP_DIR}/current"
  sudo -u "${DEPLOY_USER}" ln -sfn "${APP_DIR}/shared/.env.production" "${APP_DIR}/current/.env.production"
  sudo -u "${DEPLOY_USER}" ln -sfn "${APP_DIR}/storage" "${APP_DIR}/current/storage"
fi

echo "==> Done"
echo "Next steps:"
echo "1. Edit ${APP_DIR}/shared/.env.production and replace CHANGE_ME values."
echo "2. Change the MySQL password and update DATABASE_URL."
echo "3. Deploy the app from GitHub Actions or run scripts/deploy-server.sh on the server."
