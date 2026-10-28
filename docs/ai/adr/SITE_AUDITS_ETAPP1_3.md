# ADR: Site audits Etapp 1.3 — Detected technologies

**Status:** Accepted — QA Approved; Security Approved (SA-R10–R12)  
**Date:** 2026-10-21  
**Epic:** Site audits  
**Extends:** [`SITE_AUDITS_ETAPP1.md`](SITE_AUDITS_ETAPP1.md), [`SITE_AUDITS_ETAPP1_1.md`](SITE_AUDITS_ETAPP1_1.md), [`SITE_AUDITS_ETAPP1_2.md`](SITE_AUDITS_ETAPP1_2.md)  
**Related:** [`SITE_AUDITS_UX.md`](../design/SITE_AUDITS_UX.md)

## Context

Operators want a BuiltWith-style view of which CMS, analytics, CDN, commerce, and chat tools appear on an audited site. BuiltWith and similar SaaS APIs are out of scope (quotas, cost, third-party dependency). Etapp 1.2 already collects homepage headers, HTML resource URLs, and third-party hosts — enough for a curated, self-hosted fingerprint.

## Decision

### Product

- **Idea only** from BuiltWith: inventory of detected technologies.
- **No** BuiltWith API, Wappalyzer API, datasets scraped from those products, or other tech-lookup SaaS.
- Detection is **parse-only** from crawl signals already collected via `safeFetch` / SSRF rules. Never fetch third-party asset URLs to “confirm” a vendor.
- **SEO score weights unchanged.** No new score category; no deductions from detection in v1.
- UI: collapsible **Detected technologies** on the **Technical** tab (first among infra sections). Not a new top-level tab.

### Score weights — unchanged

| Category  | Weight |
| --------- | ------ |
| indexing  | 0.30   |
| content   | 0.30   |
| technical | 0.25   |
| sharing   | 0.15   |

### Catalog policy

- Curated local catalog (~40–60 high-signal rules) in `plugins/site-audits/services/techFingerprintCatalog.js`.
- Categories (fixed enum): `cms` | `ecommerce` | `analytics` | `cdn` | `framework` | `chat` | `marketing` | `other`.
- False positives/negatives are accepted; coverage is intentionally far below commercial tools.
- Catalog version integer (`catalogVersion`) stored with results for future rule evolution.

### Detection inputs

1. Homepage response headers (`server`, `x-powered-by`, `via`, Cloudflare/Shopify markers, …).
2. Per-page `techHints` from `htmlAnalyzer`: `meta[name=generator]`, capped path hits (`/wp-content/`, `/_next/`, …).
3. Aggregated third-party script/style hostnames from `resourceInventory`.

### `summary.siteMeta.technologies` (no migration)

```js
{
  items: [
    {
      id: 'wordpress',
      name: 'WordPress',
      category: 'cms',
      evidence: [{ kind: 'path'|'host'|'header'|'generator', value: string }]
    }
  ],
  catalogVersion: 1
}
```

Caps: evidence per item ≤ 3; total items ≤ 40; truncate evidence values (same hygiene as header inventory). Never render evidence as HTML in UI.

### Non-goals

BuiltWith/Wappalyzer APIs; browser extensions; historical “first seen”; spend/employee enrichment; fetching vendor URLs; mixing into SEO score; replacing the resources/third-party host list; new top-level tab.

## Residual risks (Security)

1. **SA-R10 (Info):** Evidence strings (paths, hostnames, truncated headers) retained in JSONB — operational metadata; never render as HTML.
2. **SA-R11 (Info):** Static catalog only — no new outbound network; no SSRF expansion.
3. **SA-R12 (Low):** False positives may mislabel a stack; accepted for inventory-only UX with no score impact.
