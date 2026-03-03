# Analytics Overhaul Reference

## Scope and Status

This is the canonical reference for the Analytics performance overhaul.
It supersedes:

- `docs/analytics-performance-rollout.md`
- `docs/analytics-contracts.md`
- `C:/Users/Fabio/.cursor/plans/analytics_performance_overhaul_a77a35d3.plan.md`

All planned work items were completed, plus post-rollout optimizations.

## Why This Overhaul Was Done

Primary bottlenecks before the overhaul:

- One dashboard load triggered many endpoint roundtrips.
- Runtime SQL repeatedly normalized values (`lower/trim/raw->>.../regexp_replace`) on every request.
- Customer segment query used expensive full-history windowing.
- Frontend state changes could trigger duplicate/reflex fetches.

Primary goals:

- Lower p50/p95 load time for analytics.
- Remove duplicated work across frontend/API/DB.
- Move normalization to write time for deterministic reads.
- Keep contracts strict and explicit.

## Core Design Decisions

1. **Frontend request discipline first**
   - Base dashboard load separated from drilldown fetches.
   - Drilldowns only load when open.
   - Debounced filter updates.

2. **Summary endpoint for first paint**
   - Consolidate `overview`, `timeSeries`, `statusDistribution`, `customerSegments`, `channels`.
   - Keep `top-products` and drilldown endpoints separate.

3. **Canonical analytics fields on `orders`**
   - Persist normalized fields once on ingest/write.
   - Query canonical columns directly.

4. **Read model for customer segments**
   - `customer_first_orders` replaces runtime first-order windowing.

5. **Evidence-driven DB tuning**
   - Add indexes for actual filter/join/group patterns.
   - Validate with `EXPLAIN`.

6. **Short TTL cache + explicit invalidation**
   - User-scoped cache keys based on normalized filters.
   - Invalidate on order mutations/sync/import flows.

## External Feedback and How It Was Applied

### Accepted in full

- Start with frontend request cleanup.
- Add summary endpoint.
- Move normalization to write-time canonical columns.
- Introduce first-order read model.
- Add index + explain gates.
- Use short TTL cache with invalidation.

### Risk controls implemented

- Filter contract formalized and enforced.
- Canonical data contract formalized.
- Summary kept focused (not a super-endpoint with drilldowns).
- Cache keys normalized and user-scoped.

### Gaps that were explicitly closed

- Contract definitions were centralized into one reference (this document).
- Post-rollout optimization reduced extra summary-path channel work and cached top-products.

## Architecture: Before vs After

### Before

- Analytics page fan-out to multiple endpoints.
- Expensive runtime normalization expressions in hot SQL.
- Customer segment first-order logic computed on each load.
- Duplicate fetch behavior possible during filter interactions.

### After

- Main load pattern: `summary + top-products`.
- Drilldown fetches isolated and conditional.
- Read queries based on canonical `orders` fields.
- Segment logic based on `customer_first_orders` read model.
- User+filter cache with short TTL and mutation invalidation.

## Contracts

### Filter Contract (API)

Accepted analytics filter shape:

- `status`: lowercase string.
- `channel`: `<channel>` or `<channel>:<market>`.
- `channelInstanceId`: positive integer.
- `from`: ISO-8601 datetime.
- `to`: ISO-8601 datetime.
- `granularity`: `day | week | month` (default `day`).

Enforcement:

- Validation in `plugins/analytics/routes.js`.
- Normalization in `plugins/analytics/controller.js`.
- Guardrails in `plugins/analytics/model.js` for invalid `channelInstanceId`.

### Canonical Data Contract (Storage)

Analytics reads rely on these `orders` columns:

- `channel_market_norm`
  - Derived from `raw.market` (trim + lowercase).
  - Expected channel-market values include `se`, `dk`, `fi`, `no`.

- `currency_norm`
  - For CDON/Fyndiq by market map:
    - `se -> SEK`
    - `dk -> DKK`
    - `fi -> EUR`
    - `no -> NOK`
  - For other channels: normalized `orders.currency`.

- `customer_identifier_norm`
  - CDON/Fyndiq: normalized phone (`+` and digits).
  - Others: normalized email (trim + lowercase).

### Read Model Contract

`customer_first_orders`:

- key: `(user_id, customer_identifier_norm)`
- value: first order id + first order timestamp
- updated by ingest/write flow and DB trigger logic

## Implementation Walkthrough (Plan -> Delivered)

### Phase 1: Frontend request discipline

Delivered:

- Debounced filter state.
- Base dashboard fetch decoupled from drilldown state.
- Drilldown fetches triggered only by drilldown state.

### Phase 2: API consolidation

Delivered:

- `GET /api/analytics/summary` added.
- Frontend switched to summary for core dashboard data.
- `top-products` and drilldowns kept separate.

### Phase 3: Canonical columns

Delivered:

- Added and backfilled:
  - `channel_market_norm`
  - `currency_norm`
  - `customer_identifier_norm`
- Updated ingest flow to write canonical fields.
- Query paths switched to canonical fields.

### Phase 4: Customer segment read model

Delivered:

- Added/backfilled `customer_first_orders`.
- Rewrote segment query to join read model.

### Phase 5: Index hardening

Delivered indexes aligned to analytics patterns:

- `orders(user_id, placed_at DESC)`
- `orders(user_id, status, placed_at DESC)`
- `orders(user_id, channel, placed_at DESC)`
- `orders(user_id, channel_instance_id, placed_at DESC)`
- `orders(user_id, channel, channel_market_norm, placed_at DESC)`
- `orders(user_id, customer_identifier_norm, placed_at DESC)`
- `customer_first_orders(user_id, customer_identifier_norm)`
- `order_items(order_id)`

### Phase 6: Caching

Delivered:

- user+endpoint+normalized-filter cache key
- short TTL (summary/channels/customer segments)
- invalidation hooks from order mutation/sync/import paths

Post-rollout extension:

- `top-products` now cached with short TTL.

### Phase 7: Validation and rollout gates

Delivered:

- timing logs for summary/channels/customer-segments/top-products
- explain checks for key query shapes
- acceptance gates tracked (main load shape, duplicate request control, segment query strategy)

## Post-Rollout Improvements

1. **Summary channel optimization**
   - Skip redundant second channel load when no channel filter is active.

2. **Top-products caching**
   - Added short-TTL user+filter cache for repeated filter toggles.

These changes target perceived slowness on repeated dashboard interactions.

## Migration and Database Runbook

### Migration Files

- `server/migrations/057-analytics-canonical-and-customer-first-orders.sql`
- `server/migrations/058-analytics-normalized-indexes.sql`

### Rollout Order

1. Deploy backend (summary/model/cache support).
2. Apply 057 + 058.
3. Deploy frontend summary-based context.
4. Validate dashboards/charts/drilldowns/export.
5. Observe timings (24h window preferred).

### Neon Execution Notes (Actual)

The migration logic was executed and verified in:

- `public`
- `tenant_1`
- `tenant_2`
- `tenant_3`

Verified objects:

- canonical `orders` columns
- `customer_first_orders`
- analytics triggers
- normalized indexes

Additional live DB consistency checks performed:

- Woo orders with missing labels: verified clean after backfill.
- market/currency mismatch for CDON/Fyndiq: verified clean.
- dangling first-order references: verified clean.

## Verification SQL Reference

Use representative user/filter windows.

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  date_trunc('day', o.placed_at) AS bucket,
  o.channel,
  o.channel_market_norm,
  o.currency_norm,
  COUNT(*)::int,
  COALESCE(SUM(o.total_amount), 0)::numeric
FROM orders o
WHERE o.user_id = 123
  AND o.placed_at >= now() - interval '60 days'
GROUP BY 1, 2, 3, 4
ORDER BY 1 ASC;
```

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
WITH filtered_orders AS (
  SELECT o.id, o.user_id, o.customer_identifier_norm
  FROM orders o
  WHERE o.user_id = 123
    AND o.placed_at >= now() - interval '60 days'
)
SELECT
  COUNT(
    DISTINCT CASE
      WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id = fo.id
        THEN fo.customer_identifier_norm
      ELSE NULL
    END
  ),
  COUNT(
    DISTINCT CASE
      WHEN fo.customer_identifier_norm IS NOT NULL AND cfo.first_order_id IS DISTINCT FROM fo.id
        THEN fo.customer_identifier_norm
      ELSE NULL
    END
  )
FROM filtered_orders fo
LEFT JOIN customer_first_orders cfo
  ON cfo.user_id = fo.user_id
 AND cfo.customer_identifier_norm = fo.customer_identifier_norm;
```

## Acceptance Gates and Ongoing Monitoring

Functional gates:

- Main dashboard load is one summary request + one top-products request.
- No repeated summary requests for unchanged filter state except manual refresh.
- Drilldown queries only execute for active drilldown.
- Segment query strategy uses read model, not full runtime windowing.

Performance gates:

- `analytics.summary.timing`
- `analytics.channels.timing`
- `analytics.customerSegments.timing`
- `analytics.topProducts.timing`

Operational recommendation:

- Track p50/p95 per endpoint over representative traffic.
- Compare cold-cache vs warm-cache behavior.

## Reuse Blueprint for Other E-commerce Plugins

This exact sequence is recommended for any data-heavy plugin:

1. Lock strict request/filter contract.
2. Lock strict canonical storage contract.
3. Move normalization to write-time.
4. Add targeted read model(s) for expensive cross-history logic.
5. Add indexes based on query plans.
6. Add short-TTL cache with deterministic invalidation hooks.
7. Instrument timings and enforce p50/p95 gates.

## Guardrails

- Do not add broad fallback chains that mask data-quality bugs.
- Do not overload summary endpoints with drilldown-sized payloads.
- Do not index blindly without explain evidence.
- Do not ship ambiguous contracts; contract first, code second.

## File Map (Primary Implementation Surfaces)

- `plugins/analytics/model.js`
- `plugins/analytics/controller.js`
- `plugins/analytics/routes.js`
- `plugins/analytics/cache.js`
- `plugins/orders/model.js`
- `plugins/orders/controller.js`
- `client/src/plugins/analytics/context/AnalyticsContext.tsx`
- `client/src/plugins/analytics/api/analyticsApi.ts`
- `client/src/plugins/analytics/components/AnalyticsList.tsx`
- `server/migrations/057-analytics-canonical-and-customer-first-orders.sql`
- `server/migrations/058-analytics-normalized-indexes.sql`

## Document Ownership

This file is intended to remain the single long-form reference for analytics performance architecture and rollout decisions.
If additional analytics performance changes are made, update this file directly instead of creating a parallel planning/contract doc.
