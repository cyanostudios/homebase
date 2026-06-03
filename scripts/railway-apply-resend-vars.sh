#!/usr/bin/env sh
# Apply RESEND_* from .env.railway.resend to Railway (requires: railway login + railway link).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/.env.railway.resend"

if [ ! -f "$FILE" ]; then
  echo "Missing $FILE — run: npm run export:system-email-from-mail -- --write-railway-file"
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Install Railway CLI: npm i -g @railway/cli && railway login && railway link"
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$FILE"
set +a

for key in RESEND_API_KEY RESEND_FROM FRONTEND_URL APP_URL; do
  eval "val=\$$key"
  if [ -z "$val" ]; then
    echo "Missing $key in $FILE"
    exit 1
  fi
  echo "Setting $key..."
  railway variables set "$key=$val"
done

echo "Done. Redeploy the Homebase service in Railway."
