-- 037-fx-rates.sql
-- Cache for Riksbanken exchange rates (SEK -> DKK, EUR, NOK). Updated 4×/dygn by app job.
-- Table lives in main DB (public schema); rates are global, not per-tenant.
-- Run this migration once on the main database (DATABASE_URL), e.g. in Neon SQL editor or: psql $DATABASE_URL -f server/migrations/037-fx-rates.sql

CREATE TABLE IF NOT EXISTS fx_rates (
  series_id VARCHAR(20) PRIMARY KEY,
  rate NUMERIC(18,6) NOT NULL,
  observed_at DATE NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fx_rates IS 'Cached Riksbanken rates: SEKDKKPMI, SEKEURPMI, SEKNOKPMI (1 SEK = rate units of foreign currency)';
