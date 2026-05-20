#!/usr/bin/env sh
# Smoke-test built Homebase (production bundle) locally.
set -e
cd "$(dirname "$0")/.."

if [ ! -f dist/index.js ]; then
  echo "Run npm run build first"
  exit 1
fi

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env.local
  set +a
fi

# Override .env.local PORT so we do not collide with dev API on 3002
export NODE_ENV=production
export PORT=3098

node dist/index.js &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

sleep 3
curl -fsS "http://127.0.0.1:${PORT}/api/health" | head -c 400
echo ""
echo "OK: /api/health responded on port ${PORT}"
