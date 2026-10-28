# Site audits — plugin overview (etapp 1 + 1.1 + 1.2 + 1.3 + 1.4)

Plugin id: **`site-audits`**. Internal tool for a **manual, read-only technical SEO audit** of a public site. One list item is one site (URL plus an optional competitor URL). The crawl does not execute JavaScript and does not change the target site.

**Status:** Etapp **1** (2026-10-20), **1.1** Sitegrade parity (2026-10-21), **1.2** Technical inventory (2026-10-21), **1.3** Detected technologies (2026-10-21), and **1.4** Diff / actionable findings / Quick audit (2026-10-25) are implemented in the working tree. Etapp 1.2 adds a self-hosted **Technical** tab (TLS, DNS SPF/DMARC, securityheaders-style header matrix, resource/third-party hosts, crawl vs sitemap coverage) with **no** Lighthouse, PSI, Chromium, or third-party scan APIs. Etapp 1.3 adds a BuiltWith-inspired **local** technology fingerprint (`summary.siteMeta.technologies`) from crawl headers/HTML/hosts — **no** BuiltWith/Wappalyzer APIs. Etapp 1.4 adds optional **Quick** crawl mode, stable finding `code` + curated i18n why/fix hints, and client-side **Since last run** / History score Δ. Score category weights are unchanged. Etapps 2–5 are not built. Uptime is out of scope. **Analytics and GEO / AI visibility** (prompt-based LLM measurement) are future work and are not in this plugin. List tags are not used.

**ADR:** [`ai/adr/SITE_AUDITS_ETAPP1.md`](ai/adr/SITE_AUDITS_ETAPP1.md) · **1.1:** [`ai/adr/SITE_AUDITS_ETAPP1_1.md`](ai/adr/SITE_AUDITS_ETAPP1_1.md) · **1.2:** [`ai/adr/SITE_AUDITS_ETAPP1_2.md`](ai/adr/SITE_AUDITS_ETAPP1_2.md) · **1.3:** [`ai/adr/SITE_AUDITS_ETAPP1_3.md`](ai/adr/SITE_AUDITS_ETAPP1_3.md) · **1.4:** [`ai/adr/SITE_AUDITS_ETAPP1_4.md`](ai/adr/SITE_AUDITS_ETAPP1_4.md)  
**UX:** [`ai/design/SITE_AUDITS_UX.md`](ai/design/SITE_AUDITS_UX.md)

Security Approved for etapp 1 SSRF/outbound; residuals SA-R1–R3 are in the etapp 1 ADR. Etapp 1.1 adds path probes on the same `safeFetch` stack; residuals SA-R4–R6 are in the 1.1 ADR. Etapp 1.2 TLS/DNS/compression inventory: residuals SA-R7–R9 in the 1.2 ADR. Etapp 1.3 fingerprint inventory: residuals SA-R10–R12 in the 1.3 ADR. Etapp 1.4 Quick mode / hints: residuals SA-R13–R14 in the 1.4 ADR.

---

## Naming

Verified in `plugins/site-audits/plugin.config.js`, `client/src/core/pluginRegistry.ts`, `client/src/core/routing/routeMap.ts`, `client/src/core/pluginSingular.ts`, and `client/src/i18n/locales/en.json` / `sv.json`.

| Surface                | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Menu label (en and sv) | Site audits                                                                                      |
| Plugin id              | `site-audits`                                                                                    |
| Nav category           | Tools (order 5, icon `SearchCheck`)                                                              |
| App route              | `/site-audits`                                                                                   |
| API base               | `/api/site-audits` (`routeBase` in plugin config; client uses `createApiClient('/site-audits')`) |
| Tables                 | `site_audits`, `site_audit_runs`                                                                 |
| Context singular       | `siteAudit` (`getSingular('site-audits')` → `siteAudits` minus trailing `s`)                     |
| Display number prefix  | `AUD` (`displayNumber.ts`)                                                                       |
| Required role          | `user`                                                                                           |

There is no settings view, no dashboard widget, and no list-tags UI (`SiteAuditList` does not render `ItemTagsField`). The empty detail pane (`SiteAuditsStatisticsView`) is a title plus “select a site” copy. It is not an analytics or KPI view.

---

## Local setup

**Local first.** Apply the tenant migration and plugin access on the local main database. Do not pass `--both` and do not point these commands at production unless a release is explicitly requested. After plugin access changes, **log out and log in** so `/api/auth/me` picks up the plugin.

### 1. Migrate tenant databases

```bash
npm run migrate:site-audits
```

`package.json` runs `scripts/run-site-audits-migration.js`, which applies `server/migrations/185-site-audits.sql` using **`DATABASE_URL` only** (no `--both`).

- `TENANT_PROVIDER=local`: each user in main `users`, schema `tenant_<id>`.
- Otherwise: each row in `tenants` that has `neon_connection_string`.

The SQL is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. The script treats “already exists” as skipped.

### 2. Enable the plugin

```bash
npm run set:tenant-plugins -- --email=<tenant-email> --enable=site-audits
```

`scripts/set-tenant-plugin-access.js` requires `--email` or `--tenant-id` in addition to `--enable`. It writes `tenant_plugin_access` and the owner’s `user_plugin_access` on the **main** database.

Verified constraint in that script (not a site-audits special case): without `--both`, it uses `TARGET_DATABASE_URL` or else `DATABASE_URL`. If the chosen URL is localhost and `TARGET_DATABASE_URL` is **unset**, the script **exits** (it treats bare localhost `DATABASE_URL` as “prod URL missing”). For a **local-only** enable, set `TARGET_DATABASE_URL` to your local main Postgres URL (same value as `DATABASE_URL` is fine), or use another non-localhost main URL you intend to update. Do not pass `--both` and do not set `LOCAL_PROD_PARITY=1` / `true` unless a release explicitly updates production too.

---

## Data model

Tenant DB. Source: `server/migrations/185-site-audits.sql`. API JSON is camelCase via `plugins/site-audits/model.js`.

### `site_audits`

| Column                     | Notes                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `id`                       | Serial PK. API `id` is a string.                                                    |
| `user_id`                  | Tenant scope. Set by the database adapter on insert, not by the plugin INSERT list. |
| `name`                     | `VARCHAR(255)` NOT NULL. API trim, 1–255.                                           |
| `url`                      | `TEXT` NOT NULL. Stored as entered after trim. API max 2048, `validateAuditUrl`.    |
| `competitor_url`           | Nullable `TEXT`. API `competitorUrl`. Empty becomes `null`.                         |
| `last_score`               | Nullable integer. Updated from the **site** run score when that leg finishes.       |
| `last_run_at`              | Nullable timestamptz. Set with `last_score`.                                        |
| `created_at`, `updated_at` | `NOW()` defaults.                                                                   |

Indexes: `(user_id)`, `(updated_at DESC)`. No unique constraint on name or URL. List order from the API is `updated_at DESC`.

### `site_audit_runs`

| Column          | Notes                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `id`            | Serial PK.                                                                   |
| `site_audit_id` | FK → `site_audits(id)` **ON DELETE CASCADE**.                                |
| `target`        | `site` or `competitor`.                                                      |
| `status`        | `queued`, `running`, `done`, `failed`.                                       |
| `score`         | Nullable integer 0–100 when done.                                            |
| `summary`       | JSONB. Site summary plus, when both legs finish, `comparison`.               |
| `pages`         | JSONB array. At most 500 scored pages (`runAudit.js` slices to `MAX_PAGES`). |
| `error`         | Text when the leg fails.                                                     |
| `started_at`    | Default `NOW()` on insert.                                                   |
| `finished_at`   | Set when the leg is finished or marked stale.                                |

Indexes: `(site_audit_id, started_at DESC)`, `(status)`.

`site_audit_runs` has **no** `user_id`. The model uses the tenant pool and checks ownership by loading the parent `site_audits` row first (`assertOwnedSiteAudit`).

---

## API

Router: `plugins/site-audits/routes.js`. Every route uses `requirePlugin('site-audits')`. Mutations use CSRF. Client: `client/src/plugins/site-audits/api/siteAuditsApi.ts`.

| Method   | Path                                      | Body / query                                             | Response                                                    |
| -------- | ----------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `GET`    | `/api/site-audits`                        | —                                                        | Array of sites                                              |
| `POST`   | `/api/site-audits`                        | `{ name, url, competitorUrl? }`                          | Created site                                                |
| `PUT`    | `/api/site-audits/:id`                    | Same fields                                              | Updated site                                                |
| `DELETE` | `/api/site-audits/batch`                  | `{ ids }` (max 500)                                      | `{ ok, requested, deleted, deletedIds }`                    |
| `DELETE` | `/api/site-audits/:id`                    | —                                                        | `{ message }`                                               |
| `POST`   | `/api/site-audits/:id/runs`               | Optional `{ mode?: 'full' \| 'quick' }` (default `full`) | **202** `{ site, run, competitorRun }`                      |
| `GET`    | `/api/site-audits/:id/runs`               | `limit` optional (default 50, capped at 100)             | Runs, newest `started_at` first                             |
| `GET`    | `/api/site-audits/:id/runs/:runId`        | —                                                        | One run                                                     |
| `POST`   | `/api/site-audits/:id/runs/:runId/cancel` | —                                                        | Cancels active run (+ same-job competitor leg when present) |

`POST /:id/runs` is registered before `/:id` so `batch` is not captured as an id. Validation errors use `{ errors: [{ field, message }] }`. When the in-memory concurrency gate is full the start endpoint returns **429** (`Too many audits are running right now…`). Omitted or non-`quick` `mode` runs a **full** audit. Quick mode is persisted as `summary.siteMeta.auditMode: 'quick' | 'full'`.

---

## Crawl and score

Orchestration: `plugins/site-audits/services/runAudit.js`. One `POST /:id/runs` is one in-process job (no separate worker). Run rows are inserted as `queued`, then marked `running` before the response. The handler returns **202** with `{ site, run, competitorRun }` and schedules `runJob` fire-and-forget (same `req` / tenant pool; slot released in `runJob`’s `finally`).

- Always crawls `url` as `target: 'site'`.
- If `competitorUrl` is set, a second run (`target: 'competitor'`) uses the same pipeline, sequentially in the same job.
- The job counts as **one** concurrency slot: max **1** active job per user and **2** global, in memory for this process. Counters reset on process restart.
- `last_score` / `last_run_at` update only when the **site** leg produces a summary. A failed site leg does not clear a previous score.
- When both summaries exist, `compare.js` writes `summary.comparison`: `siteScore`, `competitorScore`, `scoreDelta` (site minus competitor), and per-category `{ site, competitor, delta }` for indexing, content, technical, sharing. SEO scores only.

### Stale runs

`failStaleRuns` marks `queued` or `running` rows older than **30 minutes** as `failed` with a fixed error string (`Run exceeded the maximum allowed duration…`). It runs lazily on the caller’s tenant pool (scoped to the caller’s `user_id`): before `startRun`, before `getRunsForSite`, and before `getRunById` (poll path). It does **not** run at plugin init. `plugins/site-audits/index.js` explains that init has no per-tenant pool in this multi-tenant layout.

### Crawl limits

`plugins/site-audits/services/crawler.js` (GET only):

| Limit                                                  | Full (default)              | Quick (`mode: 'quick'`)               |
| ------------------------------------------------------ | --------------------------- | ------------------------------------- |
| Pages stored / crawled                                 | 500 (`MAX_PAGES`)           | 50 (`QUICK_MAX_PAGES`)                |
| Delay between fetches                                  | 200 ms                      | 50 ms                                 |
| Security path probes                                   | yes                         | skipped (`securityProbes: []`)        |
| Homepage compression probe                             | yes                         | skipped (`compression.skipped: true`) |
| robots / sitemap / llms / TLS / DNS / tech fingerprint | yes                         | yes                                   |
| Sitemap files fetched                                  | 3                           | 3                                     |
| Children of a sitemap index                            | 5                           | 5                                     |
| Queue cap                                              | 2000 URLs (`MAX_PAGES * 4`) | same formula with quick page cap      |

Order: validate URL and DNS, then `robots.txt` at the origin, then sitemap URLs from robots `Sitemap:` lines or `{origin}/sitemap.xml`, then BFS of same-host links discovered in HTML. **Path scope:** if the start URL path is not `/`, only same-host URLs under that path prefix are crawled (e.g. `/nordics-baltics/` → `/nordics-baltics` and children). Root `/` means the whole host. Scope is stored as `summary.siteMeta.pathScope`. After the HTML queue finishes, the crawler performs **extra GETs** that do not count toward the page cap: `{origin}/llms.txt` and (full mode only) five **security probes** (see below). `robots.txt` disallow rules are honored for the crawl path. The parser (`robotsParser.js`) is prefix Allow/Disallow for the `HomebaseSiteAudits` token (and `*`). It does not implement `*` / `$` wildcards.

**llms.txt:** Fetched at `{origin}/llms.txt`. Counts as found only on HTTP 200 with a non-empty body that is not an HTML document (SPA soft-200 fallbacks are rejected). Stored on the run as `summary.siteMeta.llmsTxtFound`.

**AI bots in robots:** `robotsParser.summarizeAiBots` records allow/disallow at `/` for `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, and `PerplexityBot` (plus `*` for wildcard root blocks). Result is `summary.siteMeta.aiBotRobots` (`byAgent`, `blocked`).

**Security probes:** `plugins/site-audits/services/securityProbes.js` — same-host GETs to `/.env`, `/.git/HEAD`, `/wp-config.php`, `/server-status`, `/phpinfo.php` via `safeFetch`, with the crawl delay between requests. Not counted toward the 500-page HTML cap. HTTP 401/403/404 (or off-host final URL) → not exposed. HTTP 200 alone is not enough: body must match path-specific signatures (mitigates soft-200 HTML). Probe bodies are inspected then discarded; stored metadata is in `summary.siteMeta.securityProbes` (no raw body in JSON).

`htmlAnalyzer.js` (cheerio, no JS execution) reads title, meta description, H1s, canonical, robots meta, `lang`, viewport, Open Graph, Twitter tags, JSON-LD (invalid blocks kept with `_parseError`), images (src/alt), and same-host links. A page is flagged `shellOnly` when `#root` / `#app` has under 50 characters of text, or when there is no such mount but there is at least one script and under 50 characters of body text.

**Images and alt text are parsed and scored.** If a page has images and any lack `alt` (missing or blank), `scoring.js` adds a content warning and deducts from the content category.

### Score (0–100)

`plugins/site-audits/services/scoring.js`. Weights: **indexing 0.30**, **content 0.30**, **technical 0.25**, **sharing 0.15** (unchanged through etapp 1.4). Findings use severity `critical`, `warning`, or `info`, an optional **`pillar`** (`seo` | `ai` | `security`) for UI grouping only, and (etapp 1.4) a stable snake_case **`code`** (e.g. `missing_title`, `no_hsts`). Missing pillar is treated as `seo` in the client. Finding **why/fix** hints are UI-only i18n (`siteAudits.findingHints.<code>`); they are not stored in JSONB. The site score is the weighted average of category scores after site-level penalties. Per-page category scores are averaged first.

Page deductions (clamped 0–100 per category) include:

- **Indexing:** noindex (−60), missing canonical (−15), HTTP ≥ 400 (−80), leftover 3xx (−10), HTTP 200 with a 404-like title (−30).
- **Content:** missing title (−30), title length outside 10–60 (−10), missing meta description (−20), meta length outside 50–160 (−10), missing H1 (−20), more than one H1 (−10), shell-only page (−15). **Etapp 1.1:** thin body text under 300 characters when not already shell-only (−10, `pillar: ai`); H1 without any H2 (−5, `pillar: ai`, info).
- **Technical:** final URL not `https://` (−30), response time over 2000 ms (−15), HTML over 1.5 MiB (−10), missing viewport (−15), missing `lang` (−5). **Etapp 1.1:** mixed content sample on HTTPS pages (−15, `pillar: security`).
- **Sharing:** missing `og:title` (−20), `og:description` (−15), `og:image` (−20), `twitter:card` (−10), any invalid JSON-LD (−15). **Etapp 1.1:** JSON-LD present but no useful `@type` (−10, `pillar: ai`).

Site-level adjustments on the averaged categories:

- Missing robots.txt: indexing −5 and a warning finding. Missing sitemap: indexing −10 and a warning finding.
- **Etapp 1.1 — AI readiness (`pillar: ai`):** missing or empty `llms.txt` (indexing −5); any blocked AI bot at `/` in robots (indexing −5); homepage missing author in meta or JSON-LD (sharing −5, info).
- **Etapp 1.1 — Security (`pillar: security`):** on HTTPS homepage — missing HSTS (technical −10); missing CSP (technical −4); missing `X-Content-Type-Options` (technical −3); `Set-Cookie` missing Secure, HttpOnly, or SameSite (technical −5). Exposed sensitive path from probes (critical finding, technical penalty up to −50 total from probes).
- **Etapp 1.2 — Security inventory findings:** missing Referrer-Policy / Permissions-Policy / frame protection (XFO or CSP `frame-ancestors`) — warning + technical −3 each; TLS expired or hostname mismatch — critical; TLS &lt;30 days — warning; SPF or DMARC missing — info each; ≥10 third-party script hosts — info. Inventory is shown on the **Technical** tab and is not a fifth SEO score category.
- Duplicate titles (case-insensitive): content −10.
- Also recorded: missing `Cache-Control` (no category penalty for that alone), and a sample (up to 5) of pages with status ≥ 400 (critical finding). Missing `Content-Encoding` is **not** recorded — the fetch client does not send `Accept-Encoding`, so absence of the header is not evidence the origin is uncompressed.

Run `summary.siteMeta` (JSONB inside `summary`, no migration) includes etapp 1 / 1.1 fields plus etapp 1.2 inventory: `securityHeaders`, `tls`, `dns`, `resources`, `crawlGraph`, `compression` (homepage probe with `Accept-Encoding`; main crawl still omits that header; quick mode skips the probe). Etapp 1.3 adds `technologies` (`items[]` with id/name/category/evidence, `catalogVersion`) from the local fingerprint catalog — inventory only, no score impact. Etapp 1.4 adds `auditMode` (`quick` | `full`).

`summary.shellOnly` is true only when every crawled page is `shellOnly`. The overview shows `siteAudits.shellOnlyNote` in that case, or `siteAudits.shellOnlyPartialNote` when only some pages are shell-only.

---

## SSRF and outbound fetch

`plugins/site-audits/services/urlGuard.js` and `safeFetch.js`. This is stricter than hostname-only checks in `server/core/utils/ssrfUrlGuard.js`, which site audits still calls via `isBlockedHostname`.

1. **Schemes:** `http:` and `https:` only, so an HTTP-only site can be reported. Other schemes are rejected.
2. **Credentials** in the URL (`username` / `password`) are rejected.
3. **Blocked hostnames** from the shared SSRF helper, plus private/reserved address literals (IPv4 and IPv6, including IPv4-mapped IPv6).
4. **DNS:** `resolveAndAssertPublic` runs before the crawl. `safeFetch` uses a custom `lookup` and connects only to addresses that pass `isPrivateIp`. Private-only results fail closed (rebinding defense at connect time).
5. **Redirects:** followed manually, max **5** (301, 302, 303, 307, 308). Each hop is passed through `validateAuditUrl` again. The next request’s lookup rejects private addresses.
6. **Caps:** 15 s timeout per request; body kept up to **2 MiB** (extra bytes are dropped and `truncated` is set; the fetch still returns). Method is **GET**. No `Cookie` header and no auth forwarding.
7. **User-Agent:** `HomebaseSiteAudits/1.0 (+https://homebase.se)`.
8. **Accept:** `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`. The crawler runs HTML analysis when `Content-Type` is missing, `text/html`, or `application/xhtml+xml`. Other successful bodies are stored as size-only page rows.

IPv4 ranges treated as private/reserved in `isPrivateOrReservedIpv4`: 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10 (CGNAT), and 224.0.0.0 and above. IPv6: `::`, `::1`, strings starting with `fe80:`, `fe8`, or `fe9`, and ULA (`fc` / `fd`). IPv4-mapped `::ffff:` addresses are checked with the IPv4 rules.

The UI does not render fetched HTML (`SiteAuditView` / overview show text fields and findings). Invalid JSON-LD raw snippets may be stored in `pages` JSON (analyzer truncates raw to 500 characters) and are not rendered as HTML.

---

## UI (etapp 1–1.4)

Contacts-class mail layout. List: `SiteAuditList` + `SiteAuditListTable`. Identity column is **name**, with a meta row of hostname, last score (or no score), and last run. Header: sort, select/clear, search, add. Bulk delete uses `BulkDeleteModal`. No Settings content view.

Form (`SiteAuditForm`): name, URL (hint: HTTPS preferred; path can scope the crawl; value stored as entered), optional competitor URL. Inline save/cancel via `PanelFormHandle`.

Detail (`SiteAuditView`) tabs: **Overview**, **Quick wins**, **SEO**, **AI readiness**, **Security**, **Pages**, **Technical**, **Compare** (only when a competitor URL is set), **History**, **Activity**.

- Overview (`SiteAuditRunOverview`): score, four category bars, primary **Run audit** (full) + secondary **Quick audit**, or **Stop · m:ss** while active (cancel → `cancelled`). Polls active runs every **2 seconds**. When a previous **done** site run exists: collapsible **Since last run** (score Δ, category Δ, new/resolved critical+warning via `siteAuditRunDiff.ts`).
- **Quick wins / SEO / AI readiness / Security** tabs: `SiteAuditFindingsPanel` filtered by severity or `pillar`. Known finding `code`s show muted why/fix hints (i18n). Security tab also shows headers / TLS / DNS inventory.
- Pages: crawled URLs with status, title, severity icons, and page score; include/exclude tag filters; row expands to findings.
- Technical: detected technologies (first), resources + crawl coverage from `summary.siteMeta` (collapsed cards).
- Compare: hidden without a competitor URL. If set but `summary.comparison` is missing, pending/empty copy. Otherwise overall scores, per-category site vs competitor with deltas, and finding counts by severity (site vs competitor).
- History: **site** runs only (`target === 'site'`), up to 50, with duration, optional Quick label (`auditMode`), and compact score Δ vs the previous done run. Selecting a row loads that run into Overview/Pages.
- Activity: `DetailActivityLog` with `entityType="site-audits"`.

Quick context (`SiteAuditQuickContextPanel`): name, hostname, score, last run, Run / Quick / Stop, edit, delete. Delete uses `ConfirmDialog`. No duplicate action. System id uses prefix `AUD`.

---

## Etapp roadmap

Product order (see ADR § Planned later etapps). Etapp 1 and **1.1** exist in code; etapps 2–5 do not.

| Etapp   | Scope                                                                                                                                                              | In the repo                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **1**   | Technical SEO audit (core crawl + score)                                                                                                                           | Implemented                                                                      |
| **1.1** | Sitegrade parity — AI readiness + security checks, pillar UI (extends etapp 1)                                                                                     | Implemented — [`ai/adr/SITE_AUDITS_ETAPP1_1.md`](ai/adr/SITE_AUDITS_ETAPP1_1.md) |
| **1.2** | Technical inventory — TLS, DNS, headers matrix, resources, crawl graph (no Lighthouse/PSI)                                                                         | Implemented — [`ai/adr/SITE_AUDITS_ETAPP1_2.md`](ai/adr/SITE_AUDITS_ETAPP1_2.md) |
| **1.3** | Detected technologies — curated local fingerprint (BuiltWith-inspired; no external APIs)                                                                           | Implemented — [`ai/adr/SITE_AUDITS_ETAPP1_3.md`](ai/adr/SITE_AUDITS_ETAPP1_3.md) |
| **1.4** | Run diff vs previous done run, finding codes + i18n hints, Quick audit mode                                                                                        | Implemented — [`ai/adr/SITE_AUDITS_ETAPP1_4.md`](ai/adr/SITE_AUDITS_ETAPP1_4.md) |
| **2**   | First-party analytics (snippet, daily aggregates, light realtime)                                                                                                  | Not built                                                                        |
| **3**   | Google Analytics (GA4 read-in)                                                                                                                                     | Not built                                                                        |
| **4**   | Company identification (IP→company vendor)                                                                                                                         | Not built                                                                        |
| **5**   | **GEO / AI visibility** — prompt catalogue, LLM runs via `ai-providers`, mentions / share of voice vs competitor, dedicated UI tab (not the technical 0–100 score) | Not built                                                                        |
| Later   | Classic keywords/phrases; AI walkthrough of SEO findings                                                                                                           | Not built                                                                        |

Etapps 2–5 need separate ADRs before implementation. Analytics etapp 2 can reuse patterns from [`ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md). GEO is prompt-based measurement of brand/domain presence in LLM answers (also called AI visibility / AEO); it does not crawl HTML for an SEO score.

**Uptime** is an etapp 1 non-goal in the ADR. There is no uptime monitor, probe table, or uptime UI in this plugin.

Also absent from v1 (ADR non-goals and/or UI design): list tags, settings page, analytics tab, GEO tab, keyword or backlink databases, AI analysis of findings, writing or changing the target site, and JS-rendered content (shell-only note only).

---

## Code map

| Area                                    | Path                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| Plugin entry, routes, model, controller | `plugins/site-audits/`                                                                |
| Crawl, score, compare, fetch, probes    | `plugins/site-audits/services/` (`securityProbes.js`, `robotsParser.summarizeAiBots`) |
| Overview pillars / quick wins           | `client/src/plugins/site-audits/utils/siteAuditFindings.ts`                           |
| Run vs previous done run                | `client/src/plugins/site-audits/utils/siteAuditRunDiff.ts`                            |
| Migration                               | `server/migrations/185-site-audits.sql`                                               |
| Migration runner                        | `scripts/run-site-audits-migration.js`                                                |
| Client UI, API, types                   | `client/src/plugins/site-audits/`                                                     |
| Registry and route                      | `client/src/core/pluginRegistry.ts`, `client/src/core/routing/routeMap.ts`            |
