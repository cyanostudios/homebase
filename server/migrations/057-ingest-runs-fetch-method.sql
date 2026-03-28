-- 057-ingest-runs-fetch-method.sql
-- Record which fetch strategy was used for each import run (generic_http vs browser_fetch).

ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS fetch_method VARCHAR(50);
