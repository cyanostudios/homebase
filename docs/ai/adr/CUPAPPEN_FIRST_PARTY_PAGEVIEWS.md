# ADR: Cupappen first-party pageviews (admin stats)

**Status:** Accepted  
**Date:** 2026-08-12  
**Context:** Product wants Google-independent visitor stats for public Cups: traffic source (bucket + domain) and most-visited cups/districts, shown first in Homebase Cups admin (Matches-style statistics view). Public “most visited” row is deferred. GTM stays untouched.

## Decision

1. **Storage:** One tenant-DB aggregate table (same Neon/tenant as `cups` / `cup_ratings`), written by Cupappen PHP (`CUPS_DB_URL`) and read by Homebase `plugins/cups` (authenticated).
2. **Grain:** Daily upserts — not raw event logs. Key = `(day, page_kind, target_key, source_bucket, referrer_domain)`.
3. **Pages in v1:** `page_kind=cup` (SSR detail) and `page_kind=district` (SPA `/{slug}/`). Not home/search/listing tabs.
4. **Ingest:** `POST /api/pageview.php` on Cupappen; client beacon sends `page_kind` + id/slug + raw referrer string; **server** classifies bucket and normalizes domain. Do not trust client-supplied bucket.
5. **Admin API:** `GET /api/cups/stats/pageviews?days=30` (default 30) on Homebase cups plugin; register **before** `/:id`.
6. **Admin UI:** Dedicated `CupsStatisticsView` + `cupsContentView: 'statistics'` mirroring Matches — **not** a category inside `CupsSettingsView`.
7. **Non-goals (v1):** Public Hem row, UTM persistence, IP storage, listing pageviews beyond district, GTM removal, realtime dashboard.
8. **Admin UI v1.5 (2026-08-13):** Dashboard layout with period select (7/30/90), metric cards (pageviews / cups / districts / sources), daily time series (`series`), and ranked bar lists — still pageviews-only (no visitors/bounce/device/country). `topCups` capped at **20** rows; `topDistricts` 25; `sources` 50.

## Consequences

- Stats survive without Google and stay with cup data for local/prod parity.
- Aggregate table stays small; 30-day queries are simple `SUM` filters.
- Public write endpoint needs rate limiting and validation (Security gate).
- Express route order and Cupappen CORS/`CUPS_ALLOWED_ORIGINS` must stay correct.
- Later public “mest besökta” can reuse the same aggregates without schema change.
- `GET /api/cups/stats/pageviews` returns gap-filled `series` and extended `totals` without schema change.

## Accepted residual risks (TPM / product)

- **A1:** Public counters can be inflated despite cooldown — directional stats only.
- **A2:** Session-only rate limit is incomplete without IP persistence — accepted for v1.
- **R-STATS-1 (v1.5, pending TPM):** Authenticated cups-plugin users can read tenant-wide aggregates (`series`, `totals`, `topDistricts`, `sources`); `topCups` is scoped to the current `user_id`. Low severity for directional admin stats. Security Approved; **awaits TPM conscious acknowledgment**.
