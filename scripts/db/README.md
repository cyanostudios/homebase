# DB Ops Scripts

- `queries/check_import_artifacts.sql`: Lists tables with "import" in the name.
- `queries/import_cleanup_template.sql`: Template for DROP statements (fill before use).
- `run-sql.sh`: Executes a given SQL file using $DATABASE_URL.

## Main DB migration: tenant memberships

Run on the **main** database (same as `DATABASE_URL` used by the app):

```bash
npm run migrate:tenant-memberships
```

This creates `tenant_memberships`, `tenant_plugin_access`, adds `owner_user_id` to `tenants`, and backfills existing tenants. Safe to run multiple times (idempotent).

## Usage

export DATABASE_URL="postgres://user:pass@localhost:5432/yourdb"
./scripts/db/run-sql.sh scripts/db/queries/check_import_artifacts.sql
