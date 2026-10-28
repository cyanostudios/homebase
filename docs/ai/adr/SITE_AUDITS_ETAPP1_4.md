# ADR: Site audits Etapp 1.4 — Diff, actionable findings, Quick audit

**Status:** Accepted (QA + Security Approved)  
**Date:** 2026-10-25  
**Epic:** Site audits  
**Extends:** [`SITE_AUDITS_ETAPP1.md`](SITE_AUDITS_ETAPP1.md) … [`SITE_AUDITS_ETAPP1_3.md`](SITE_AUDITS_ETAPP1_3.md)  
**Related:** [`SITE_AUDITS_UX.md`](../design/SITE_AUDITS_UX.md)

## Context

Operators have a solid crawl-based inventory (score, pillars, technical stack, path scope, cancel). The next friction is actionability: “what changed since last time?”, “what should I do?”, and “can I get a faster signal without a full crawl?”.

## Decision

### Score weights — unchanged

| Category  | Weight |
| --------- | ------ |
| indexing  | 0.30   |
| content   | 0.30   |
| technical | 0.25   |
| sharing   | 0.15   |

### 1. Quick audit

`POST /api/site-audits/:id/runs` accepts optional JSON `{ "mode": "full" | "quick" }` (default `full`).

| Setting                                                | Full   | Quick |
| ------------------------------------------------------ | ------ | ----- |
| HTML page cap                                          | 500    | 50    |
| Inter-fetch delay                                      | 200 ms | 50 ms |
| Security path probes                                   | yes    | skip  |
| Homepage compression probe                             | yes    | skip  |
| robots / sitemap / llms / TLS / DNS / tech fingerprint | yes    | yes   |

Persist `summary.siteMeta.auditMode: 'quick' | 'full'`. Same SSRF/`safeFetch` stack.

### 2. Actionable findings

Every scoring finding carries a stable `code` string. UI maps `siteAudits.findingHints.<code>.{why,fix}` (en/sv). Hints are UI-only (not stored in JSONB). Old runs without `code` show message only.

### 3. Run diff (vs previous site run)

Client-side compare of the selected **done** (or any loaded) site run against the previous **done** site run by `startedAt`. Outputs: score Δ, category Δ, findings added/resolved (fingerprint prefers `code`, else `code|message|url`). No new API / no persisted diff.

### UI

- Overview: **Run audit** (full) + **Quick audit**; **Since last run** when a baseline exists.
- Findings panels: optional why/fix under message.
- History: compact score Δ vs previous done run.

### Non-goals

Scheduled runs; PDF/export; finding→Pages deep-link; AI-generated advice; Lighthouse/PSI; analytics/GEO; weight changes; DB-persisted diff.

## Residual risks (Security)

1. **SA-R13 (Info):** Quick mode still performs outbound GETs (crawl + llms/TLS/DNS) under the same SSRF rules; fewer probe URLs than full mode.
2. **SA-R14 (Info):** Finding hint copy is static i18n — never render finding message/hints as HTML (same as SA-R8/R10).
