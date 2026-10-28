# ADR: Site audits Etapp 1.2 — Technical inventory

**Status:** Accepted — QA Approved; Security Approved (SA-R7–R9)  
**Date:** 2026-10-21  
**Epic:** Site audits  
**Extends:** [`SITE_AUDITS_ETAPP1.md`](SITE_AUDITS_ETAPP1.md), [`SITE_AUDITS_ETAPP1_1.md`](SITE_AUDITS_ETAPP1_1.md)  
**Related:** [`SITE_AUDITS_UX.md`](../design/SITE_AUDITS_UX.md)

## Context

Etapp 1 + 1.1 deliver a manual technical SEO crawl (score 0–100) plus AI readiness and security hygiene findings. Operators still lack a **self-hosted technical inventory** (TLS, DNS mail hygiene, securityheaders-style header matrix, resource/third-party hosts, crawl vs sitemap coverage) without Lighthouse, PageSpeed Insights, Chromium, or third-party scan APIs/quotas.

## Decision

### Score weights — unchanged

| Category  | Weight |
| --------- | ------ |
| indexing  | 0.30   |
| content   | 0.30   |
| technical | 0.25   |
| sharing   | 0.15   |

Inventory is **not** a fifth SEO category and is **not** folded into the primary score ring. New findings may still deduct from existing categories (mostly `technical`) with `pillar: security` where appropriate — same pattern as etapp 1.1.

### Data sources (self-hosted only)

All inventory comes from:

1. The existing crawl (`safeFetch` / SSRF rules).
2. Local Node DNS (`dns.promises`) for the **already validated** audit hostname.
3. A TLS peek to the **same** host/port using the same public-IP lookup rules as `safeFetch`.
4. Optional **homepage-only** second GET with `Accept-Encoding` solely to observe `Content-Encoding` for inventory. The main HTML crawl still does **not** send `Accept-Encoding` (preserves etapp 1 scoring semantics).

No outbound calls to securityheaders.com, Google PSI, or other scan SaaS. HTML resource inventory is **parse-only** (no fetching third-party asset URLs).

### `summary.siteMeta` shape (no migration)

Extend JSONB `summary.siteMeta` with:

| Key               | Purpose                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `securityHeaders` | Fixed matrix: HSTS, CSP, XCTO, Referrer-Policy, Permissions-Policy (also accepts legacy `Feature-Policy`), frame protection (XFO **or** CSP `frame-ancestors`). Present/absent + truncated raw values. |
| `tls`             | Protocol, authorized, validity dates, days remaining, issuer, hostname match (HTTPS only; null/skipped on HTTP).                                                                                       |
| `dns`             | A/AAAA counts (public), NS, CAA sample, `spfPresent`, `dmarcPresent`.                                                                                                                                  |
| `resources`       | Site-wide script/stylesheet/img counts, first- vs third-party host sets (capped), async/defer counts, missing width/height sample, manifest / service-worker detection flags.                          |
| `crawlGraph`      | `pageCount`, sitemap-only / crawled-not-in-sitemap counts, max depth, capped URL samples.                                                                                                              |
| `compression`     | Homepage probe: `contentEncoding` observed when Accept-Encoding sent (or `null` if probe skipped/failed).                                                                                              |

Truncate stored header/cert/TXT-derived strings (cap length in services). Do not store full DNS TXT blobs.

### New findings

| Check                                                                      | Category  | Severity                  | Pillar   |
| -------------------------------------------------------------------------- | --------- | ------------------------- | -------- |
| Missing Referrer-Policy                                                    | technical | warning + small deduction | security |
| Missing Permissions-Policy                                                 | technical | warning + small deduction | security |
| Missing frame protection (no X-Frame-Options and no CSP `frame-ancestors`) | technical | warning + small deduction | security |
| TLS expired or hostname mismatch                                           | technical | critical                  | security |
| TLS expires in &lt; 30 days                                                | technical | warning                   | security |
| SPF missing                                                                | technical | info                      | security |
| DMARC missing                                                              | technical | info                      | security |
| ≥ 10 distinct third-party script hosts                                     | technical | info                      | security |

Etapp 1.1 HSTS / CSP / XCTO / cookie / probe findings unchanged.

### UI

New detail tab **Technical** / **Tekniskt** (`?tab=technical`). Collapsed inventory sections with meta counts. Overview Security pillar continues to list security findings.

### Non-goals

Lighthouse / PSI / CrUX / headless JS render; open-port or subdomain scanning; DKIM selector guessing; calling securityheaders.com; changing `MAX_PAGES`; analytics / GEO; mixing inventory into the primary SEO score ring; weight changes.

## Residual risks (Security)

1. **SA-R7 (Low):** Extra TLS connect + DNS queries add latency and may appear in target logs — same class as crawl traffic; hostname already validated.
2. **SA-R8 (Low):** Truncated header/CSP strings retained in JSONB — treat as operational metadata, never render as HTML in UI.
3. **SA-R9 (Info):** Compression probe is a second homepage GET; still SSRF-gated; does not alter main crawl Accept-Encoding.

Etapp 1 residuals SA-R1–R3 and etapp 1.1 SA-R4–R6 unchanged.
