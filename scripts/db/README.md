# DB Ops Scripts

- `queries/check_import_artifacts.sql`: Lists tables with "import" in the name.
- `queries/import_cleanup_template.sql`: Template for DROP statements (fill before use).
- `run-sql.sh`: Executes a given SQL file using $DATABASE_URL.

## Usage
export DATABASE_URL="postgres://user:pass@localhost:5432/yourdb"
./scripts/db/run-sql.sh scripts/db/queries/check_import_artifacts.sql
