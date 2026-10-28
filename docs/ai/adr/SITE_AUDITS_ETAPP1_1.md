# ADR: Site audits Etapp 1.1 — Sitegrade parity (AI readiness + security)

**Status:** Accepted — QA Approved; Security Approved (SA-R4–R6)  
**Date:** 2026-10-21  
**Epic:** Site audits  
**Extends:** [`SITE_AUDITS_ETAPP1.md`](SITE_AUDITS_ETAPP1.md)  
**Related:** [`CUPAPPEN_SITEGRADE_SEO.md`](CUPAPPEN_SITEGRADE_SEO.md), [`SITE_AUDITS_UX.md`](../design/SITE_AUDITS_UX.md)

## Context

Etapp 1 delivers a manual technical SEO crawl with a 0–100 score across four weighted categories. Sitegrade-style reports also surface **AI crawler readiness** and **security hygiene**. Etapp 1.1 adds those checks without changing score weights, crawl cap, SSRF rules, or run orchestration.

## Decision

### Score weights — unchanged

| Category  | Weight |
| --------- | ------ |
| indexing  | 0.30   |
| content   | 0.30   |
| technical | 0.25   |
| sharing   | 0.15   |

### Finding `pillar` (UI only)

Optional field on each finding: `seo` | `ai` | `security`. Does not replace `category` or affect weights. Missing pillar → treat as `seo` in the UI.

### AI readiness (`pillar: ai`)

| Check                                                                                          | Scoring category | Severity |
| ---------------------------------------------------------------------------------------------- | ---------------- | -------- |
| `{origin}/llms.txt` missing or empty                                                           | indexing         | warning  |
| AI bots blocked in robots (`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `PerplexityBot`) | indexing         | warning  |
| JSON-LD present but no useful `@type`                                                          | sharing          | warning  |
| H1 present but no H2                                                                           | content          | info     |
| Thin body text (&lt; 300 chars) when not already shellOnly                                     | content          | warning  |
| Missing author meta / JSON-LD author on homepage                                               | sharing          | info     |

### Security (`pillar: security`)

| Check                                                                                                                          | Scoring category | Severity                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ----------------------------- |
| HTTPS homepage missing HSTS                                                                                                    | technical        | warning + deduction           |
| Missing CSP / X-Content-Type-Options                                                                                           | technical        | warning + smaller deduction   |
| Set-Cookie without Secure / HttpOnly / SameSite (on HTTPS)                                                                     | technical        | warning                       |
| Mixed content sample (`http://` assets on https page)                                                                          | technical        | warning                       |
| Path probes `/.env`, `/.git/HEAD`, `/wp-config.php`, `/server-status`, `/phpinfo.php` → HTTP 200 with sensitive body signature | technical        | critical + material deduction |

All probes: same-host after final crawl host, `safeFetch` / SSRF, crawl delay, ≤5 GETs, not counted toward the HTML page cap (`MAX_PAGES`, currently 500). 401/403/404 = no critical finding.

### siteMeta JSONB (no migration)

Extend `summary.siteMeta` with e.g. `llmsTxtFound`, `aiBotRobots`, `cookieFlags`, `mixedContentSample`, `securityProbes`.

### Non-goals

PDF/share, GEO, analytics, uptime, JS render, weight changes, configurable probe lists.

## Residual risks (Security)

1. **SA-R4 (Medium):** Probe noise in target logs / WAF.
2. **SA-R5 (Medium):** Soft-200 false positives — mitigate with body signatures.
3. **SA-R6 (Low):** AI robots multi-group precedence is heuristic.

Etapp 1 residuals SA-R1–R3 unchanged.
