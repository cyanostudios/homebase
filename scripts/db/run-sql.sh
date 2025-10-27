#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/db/run-sql.sh scripts/db/queries/check_import_artifacts.sql
# Requires $DATABASE_URL to be set (e.g. postgres://user:pass@localhost:5432/dbname)
if [ $# -ne 1 ]; then
  echo "Usage: $0 <sql-file>"; exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set"; exit 2
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
