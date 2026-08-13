# ADR: Cupappen Sitegrade SEO fixes (no homepage SSR)

**Status:** Accepted  
**Date:** 2026-08-13  
**Context:** Sitegrade B (83/100) on www.cupappen.se. TPM scope: quick wins Q1–Q5 + large L3–L8; **exclude** L1/L2 homepage SSR. AI crawlers explicitly allowed. Meta/OG copy must stay in sync.

## Decision

1. **Q1–Q2 robots:** Repo [`public-cups/robots.txt`](../../public-cups/robots.txt) stays Allow-first. Live blocks come from **Cloudflare Managed robots** — ops must disable AI-bot Disallow / allow GPTBot, ClaudeBot, Google-Extended, CCBot. Repo adds explicit Allow groups for any missing UA. Document steps in `CUPPAPPEN_RAILWAY_OPERATIONS.md`.
2. **Q3 H1:** One `<h1>` on SPA shell (home hero). District / districts-index heroes use `<h2>`.
3. **Q4 JSON-LD:** Never emit empty `application/ld+json`. Homepage `#cups-json-ld` ships a valid empty ItemList; cup detail emits `json_encode` **without** `htmlspecialchars` (use `JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS` only).
4. **Q5 / L3 / L4:** Static HTML primer on homepage (lists + descriptive `h2`/`h3`) — not SSR of the cup catalog. FAQ schema stays aligned with visible FAQ copy.
5. **Meta sync:** Single canonical home description string in `index.html` meta/og/twitter and `ROUTE_SEO.home`.
6. **L5 CSP:** Remove `unsafe-inline` / `unsafe-eval` from **script-src** by externalizing GTM bootstrap and cup-detail JS. Remove inline `style=` widths (SVG/`data-*` + CSS). Prefer removing `unsafe-inline` from **style-src** where practical; residual style-src risk documented if Google Fonts/CSS forces it.
7. **L6:** Caddy `encode zstd gzip` (and `brotli` when the Alpine Caddy build supports it).
8. **L7:** No parser-blocking inline scripts in `<head>`; GTM via deferred external file.
9. **L8:** Caddy Cache-Control — long for fingerprinted/static assets; short/`no-cache` for HTML shells.

## Consequences

- Q1–Q2 Sitegrade scores improve only after Cloudflare prod change + deploy of robots.txt.
- Homepage remains SPA for the catalog; AI “thin HTML” L1/L2 stay out of scope by design.
- GTM continues via external bootstrap; CSP must allow googletagmanager domains.

## Residual risks

- **R-SEO-AI-1:** Allowing AI crawlers may increase scrape/train use despite `llms.txt` guidance — accepted by product.
- **R-SEO-CSP-1:** Third-party GTM may inject scripts that require CSP updates later.
