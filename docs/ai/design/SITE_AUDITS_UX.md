# Site audits — UX (Etapp 1 + 1.1 + 1.2 + 1.3 + 1.4)

**Status:** Design for implementation (through etapp 1.4)  
**Date:** 2026-10-25  
**Aligned with:** [`UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md), [`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md), ADR [`SITE_AUDITS_ETAPP1_1.md`](../adr/SITE_AUDITS_ETAPP1_1.md), [`SITE_AUDITS_ETAPP1_2.md`](../adr/SITE_AUDITS_ETAPP1_2.md), [`SITE_AUDITS_ETAPP1_3.md`](../adr/SITE_AUDITS_ETAPP1_3.md), [`SITE_AUDITS_ETAPP1_4.md`](../adr/SITE_AUDITS_ETAPP1_4.md)

## List

- Contacts-class mail-layout: table-only, identity column = **name** + meta row (hostname · last score or “—” · last run relative time).
- Empty: `No Site audits yet` + Create. Search no-match: message only.
- Header: Sort, Select/Clear, search, Add. No Settings in etapp 1. No Analytics tab. No GEO / AI visibility tab (etapp 5).

## Create / edit form

- Fields: Name, URL (required HTTPS preferred; store as entered), Competitor URL (optional).
- URL hint: a non-root path limits the crawl to that path prefix (e.g. `/nordics-baltics/`); `/` audits the whole host.
- Inline Save/Cancel (`PanelFormHandle`). Same chrome as view (`DETAIL_VIEW_CARD_CLASS`).

## Detail view tabs

1. **Overview** — large score (0–100), four category bars (indexing / content / technical / sharing), primary **Run audit** (full) + secondary **Quick audit**. While running: **Stop · m:ss** (live elapsed from `startedAt`); poll every **2s**. Cancel sets run status `cancelled`. When a previous **done** site run exists: collapsible **Since last run** (score Δ, category Δ, new/resolved critical+warning). Shell-only notes as in etapp 1. Findings are **not** listed here — they have category tabs.
2. **Quick wins** — critical + warning findings only (severity order). Same finding may also appear under its pillar tab.
3. **SEO** — findings with `pillar: seo` (missing pillar treated as seo).
4. **AI readiness** — findings with `pillar: ai`.
5. **Security** — findings with `pillar: security`, plus inventory blocks: security headers matrix, TLS, DNS (SPF/DMARC).
6. **Pages** — sortable table of crawled URLs (URL, title, status, severity icons, page score) with crawled-count meta; expand row for findings (plain text). Default sort: URL ascending. Client-side **Include** and **Exclude** tag chips (type + Enter / X to remove): include keeps URLs matching any include tag; exclude then drops URLs matching any exclude tag; meta shows shown/total/hidden when either is active.
7. **Technical** — remaining self-hosted inventory: **detected technologies** (BuiltWith-inspired local catalog), resources / third-party hosts, crawl coverage (sitemap vs crawled). Collapsible cards with meta counts. Plain text only.
8. **Compare** — tab chip shown only when a competitor URL is set; overall scores, per-category site vs competitor with deltas, finding counts by severity.
9. **History** — **site** runs only (started, **duration**, score, optional score Δ vs previous done run, status including cancelled; quick runs may show a Quick badge via `auditMode`); select to load that run into Overview and category tabs.
10. **Activity** — `DetailActivityLog` for the site entity.

Quick context panel: name, outbound URL when safe, score, last run, tab chips, Run / Quick / Stop / edit / delete (ConfirmDialog). No duplicate in v1.

## Run flow

User opens site → **Run audit** (full) or **Quick audit** → creates site (+ competitor if set) runs → Overview shows progress → when done, score updates on list row. Quick uses fewer pages / shorter delay and skips security probes + compression probe.

## Finding hints (etapp 1.4)

Findings with a stable `code` show muted **why** + **fix** lines under the message (i18n). Never HTML. Unknown/missing codes: message only.

## Since last run (etapp 1.4)

Baseline = previous **done** site run older than the selected run (`startedAt`). Ignore cancelled/failed/queued/running. Plain text lists for added/resolved critical+warning.

## Category findings tabs

Shared `SiteAuditFindingsPanel` (`SiteAuditFindingsPanel.tsx`):

| Tab          | Content                                                      |
| ------------ | ------------------------------------------------------------ |
| Quick wins   | `severity` critical or warning only; sort critical → warning |
| SEO          | `pillar: seo` (missing → seo)                                |
| AI readiness | `pillar: ai`                                                 |
| Security     | `pillar: security` + headers / TLS / DNS inventory           |

- Sort within a tab: `critical` → `warning` → `info`.
- Empty tabs still show empty copy.
- Content: severity badge + plain-text `message`; optional truncated `url`.
- Never render finding text as HTML. No `dangerouslySetInnerHTML`.
- AI readiness is technical crawl tagging — not etapp 5 GEO.

## Etapp 1.2 / 1.3 — inventory placement

| Tab       | Inventory sections                                       |
| --------- | -------------------------------------------------------- |
| Security  | Security headers, TLS, DNS                               |
| Technical | Detected technologies (first), resources, crawl coverage |

Collapsed by default (`defaultOpen={false}`) with meta counts.

### Detected technologies (etapp 1.3)

- Section title: **Detected technologies** / **Identifierade teknologier**.
- Collapsed meta: e.g. “12 detected” / “12 identifierade”.
- Group rows by category (CMS, ecommerce, analytics, CDN, framework, chat, marketing, other).
- Each row: technology name + short plain-text evidence line (path / host / header / generator). Never render evidence as HTML.
- Empty: “No known technologies matched” / “Inga kända teknologier matchade” — not an error state.
- Inventory only — does not appear on Overview score or findings tabs.

## Non-goals in UI

Analytics tab, GEO / AI visibility tab, uptime, settings page, list tags, multi-column table prefs, PDF/share, Lighthouse/PSI charts, BuiltWith-style historical timelines or enrichment, scheduled runs, AI-generated finding advice.
