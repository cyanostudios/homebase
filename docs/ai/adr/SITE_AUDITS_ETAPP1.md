# ADR: Site audits Etapp 1 — technical SEO audit

**Status:** Accepted (implementation)  
**Date:** 2026-10-20  
**Epic:** Site audits  
**Related:** Product discovery (chat), [`CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md) (analytics etapp 2+), GEO / AI visibility (etapp 5, planned), ingest SSRF helpers

## Context

Internal Homebase plugin for technical SEO audits of arbitrary public sites (`http:` or `https:`). One list item = one site (URL + optional competitor URL). Manual run. Read-only toward target sites. Uptime out of scope. Later etapps (not in this ADR): analytics (first-party snippet, GA4, company ID via third-party IP lookup), and **GEO / AI visibility** (prompt-based LLM mention and share-of-voice measurement).

## Decision

### Naming

| Surface          | Value                                      |
| ---------------- | ------------------------------------------ |
| Menu (en/sv)     | Site audits                                |
| Plugin id        | `site-audits`                              |
| API              | `/api/site-audits`                         |
| Tables           | `site_audits`, `site_audit_runs`           |
| Context singular | `siteAudit` (`getSingular('site-audits')`) |

No list tags in v1 (not in golden template / NEW_PLUGIN checklist).

### Data model (tenant DB)

- `site_audits`: `id`, `user_id`, `name`, `url`, `competitor_url` (nullable), `last_score`, `last_run_at`, timestamps.
- `site_audit_runs`: `id`, `site_audit_id` (FK cascade), `target` (`site` \| `competitor`), `status` (`queued` \| `running` \| `done` \| `failed`), `score`, `summary` JSONB, `pages` JSONB, `error`, `started_at`, `finished_at`.
- Page results stored as JSONB on the run (max 500 pages). Index `(site_audit_id, started_at DESC)`.

### Crawl & analysis

- Manual `POST /:id/runs` → **202** `{ site, run, competitorRun? }`; client polls `GET /:id/runs/:runId` (and polls the competitor run when present).
- In-process async job (no separate worker): handler returns 202 after creating run row(s), marking them `running`, and scheduling `runJob` fire-and-forget on the same request’s tenant pool. Max **1 concurrent job per user**, **2 global** (in-memory; resets on process restart).
- Stale `queued`/`running` runs older than **30 minutes** are marked `failed` **lazily** on the caller’s tenant pool (before `startRun`, before run list, before single-run poll) — **not** at plugin init (no per-tenant pool at boot). See `plugins/site-audits/index.js`.
- Scope: homepage + same-host HTML up to **500** pages via `robots.txt` (respected), `sitemap.xml`, then internal links. Delay between fetches. No JS rendering (SPA shell only; note in summary).
- Checks per page: status, redirects, HTTPS, title (presence/length/uniqueness), meta description, H1 count, canonical, robots/noindex, `lang`, viewport, Open Graph/Twitter, JSON-LD parse, image alt sampling (content warning when any image lacks alt), TTFB-ish timing, HTML size.
- Site-level: robots.txt, sitemap, cache/security headers (from homepage response), duplicate titles, sample broken internal links. **Missing `Content-Encoding` is not scored** — the fetch client does not send `Accept-Encoding`, so absence of the header is not evidence the origin is uncompressed.
- Crawl host: after the homepage response, same-host scope uses the **final URL hostname** (apex↔www redirects retarget the crawl).
- Score 0–100 with category weights: **indexing 30%**, **content 30%**, **technical 25%**, **sharing/schema 15%**. Findings carry severity `critical` \| `warning` \| `info`.
- Competitor: same pipeline when `competitor_url` set; `compare.js` produces category deltas. SEO only.

### SSRF / outbound security

Extend beyond hostname-only `validatePublicHttpsUrl`:

1. Allow `http` and `https` so missing HTTPS can be reported; block credentials in URL.
2. DNS lookup before connect; reject private/reserved IPv4 and IPv6 (loopback, ULA, link-local, etc.).
3. Manual redirect follow (max 5); re-validate each hop (scheme + DNS + IP).
4. Timeout 15s per request; body cap 2 MiB; outbound `Accept` is `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8` (`safeFetch.js`). HTML analysis runs when `Content-Type` is missing, `text/html`, or `application/xhtml+xml`; other successful bodies may be stored size-only (sitemap/robots/XML rely on parser + `*/*` fallback).
5. No cookies / auth forwarding. User-Agent: `HomebaseSiteAudits/1.0 (+https://homebase.se)`.
6. Fetched HTML never rendered as HTML in the UI; text only, truncated.

### Non-goals (etapp 1)

Uptime, keyword/backlink databases, GEO / AI visibility (LLM prompt measurement), AI analysis of technical SEO findings, analytics snippet, GA4, company identification, writing/changing the target site, JS-rendered content.

## Planned later etapps (product roadmap; separate ADRs required)

| Etapp | Scope                                                    | Notes                                                                                                                                                                                                                                                        |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2** | First-party analytics                                    | Site snippet / beacon, daily aggregates, light realtime. Pattern: [`CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md).                                                                                                                  |
| **3** | Google Analytics                                         | Read existing GA4 into admin UI as a parallel source.                                                                                                                                                                                                        |
| **4** | Company identification                                   | Optional IP→company lookup vendor (Snitcher-class); no IP retention after lookup; per-site toggle.                                                                                                                                                           |
| **5** | GEO / AI visibility                                      | Prompt catalogue per site; run prompts via `ai-providers` (`pluginKey: 'site-audits'`); parse mentions / citations / share of voice vs competitor; dedicated UI tab (not mixed into technical SEO score 0–100). Measure only — no writes to the target site. |
| Later | Classic keywords/phrases; AI walkthrough of SEO findings | After or alongside etapp 5 as needed.                                                                                                                                                                                                                        |

Etapp 5 is **not** an SEO crawl score. It measures how often the brand/domain appears in LLM answers for chosen prompts (also called AI visibility / AEO). Non-deterministic answers → trends over time, not a single absolute truth. Cost = prompts × models × runs. Own ADR before build (prompt storage, answer retention, rate limits, Security).

## Consequences

- Plugin is Tools-category, Contacts-class mail-layout list.
- Security Approved for etapp 1 SSRF/outbound (see Residual risks).
- **Etapp 1.1** extends etapp 1 with AI readiness and security checks (Sitegrade parity); see [`SITE_AUDITS_ETAPP1_1.md`](SITE_AUDITS_ETAPP1_1.md). Score weights unchanged.
- Etapps 2–5 need separate ADRs (public beacon, OAuth/GA, IP lookup vendor, GEO prompt/LLM pipeline).

## Residual risks (Security Accepted, etapp 1)

1. **SA-R1 (Medium):** Concurrency is per-process (`1`/user, `2` global), not shared across app instances.
2. **SA-R2 (Low):** Non-default ports are allowed on public hosts (needed for arbitrary public audits; not classic metadata SSRF).
3. **SA-R3 (Low):** Mixed DNS A/AAAA — pre-check fails closed if any record is private; connect-time lookup may still use a remaining public address on redirect hops.

## Score weights (initial)

| Category  | Weight | Example deductions                                |
| --------- | ------ | ------------------------------------------------- |
| indexing  | 0.30   | noindex, missing robots/sitemap, soft-404         |
| content   | 0.30   | missing/duplicate title, bad H1, thin meta        |
| technical | 0.25   | HTTP-only, slow TTFB, huge HTML, missing viewport |
| sharing   | 0.15   | missing OG, invalid JSON-LD                       |

Weights may be tuned after first real reports without schema change.
