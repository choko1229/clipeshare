#!/usr/bin/env bash
set -euo pipefail

# Adds direct Nginx serving for Next.js static assets on an existing VPS install.
# Run as root:
#   APP_NAME=clipeshare APP_DIR=/var/www/clipeshare bash scripts/fix-nginx-next-static.sh

APP_NAME="${APP_NAME:-clipeshare}"
APP_DIR="${APP_DIR:-/var/www/${APP_NAME}}"
NGINX_CONF="/etc/nginx/sites-available/${APP_NAME}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if [[ ! -f "${NGINX_CONF}" ]]; then
  echo "Missing Nginx config: ${NGINX_CONF}" >&2
  exit 1
fi

if grep -q "location /_next/static/" "${NGINX_CONF}"; then
  echo "Nginx already serves /_next/static/ directly."
  exit 0
fi

python3 - "$NGINX_CONF" "$APP_DIR" <<'PY'
import pathlib
import sys

conf_path = pathlib.Path(sys.argv[1])
app_dir = sys.argv[2].rstrip("/")
text = conf_path.read_text()
marker = "    location /media/ {"
block = f"""    location /_next/static/ {{
        alias {app_dir}/current/.next/static/;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }}

"""

if marker not in text:
    raise SystemExit("Could not find media location marker in Nginx config.")

conf_path.write_text(text.replace(marker, block + marker, 1))
PY

nginx -t
systemctl reload nginx
echo "Nginx /_next/static/ direct serving has been enabled."
