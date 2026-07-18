# ADR: Guide content source registry (research pack)

**Status:** Accepted  
**Date:** 2026-07-18  
**Updated:** 2026-07-19 — aligned with place-only model ([`P-GUIDES_PLACE_PRESENTATION.md`](P-GUIDES_PLACE_PRESENTATION.md))  
**Context:** Guides editor vision — research-first from place via an extensible source list (Wikipedia + Wikidata by default; UNESCO optional), then produce one guide text per language presentation.

## Decision

1. **Content sources** live in `plugins/guides/sources/` as a catalog + registry (same pattern as places / AI providers). Guides orchestration only consumes a **source pack** (`sourceKey`, excerpts, URLs) — never source-specific APIs in the orchestrator.
2. **Adapters:** Wikipedia (geosearch/search + extracts), Wikidata (SPARQL around / name search; prefers heritage `P1435` when present), UNESCO WHC list (kept in catalog, **disabled by default** — live WHC JSON often returns 403).
3. **Tenant toggles:** Table `guide_content_source_settings` + `GET/PUT /api/guides/content-sources` merge catalog `enabledByDefault` with per-tenant overrides. Guides UI exposes a simple enable/disable list (not a separate plugin).
4. **Produce pipeline:** On `text_derivation` planning, resolve enabled keys → fetch pack from place snapshot → store on `job_options.sourcePack` → generate **one** `text_derivation` item per language presentation (place-level; see [`P-GUIDES_PLACE_PRESENTATION.md`](P-GUIDES_PLACE_PRESENTATION.md)). No length-variant chain (deep → normal/quick) and no deep-sibling wait.
5. **Honesty:** Readiness requires a **generatable** text adapter (not noop / not catalog-only providers). Default phases are text-only; translation is added automatically when other-language presentations exist (see P-TRANS).

## Consequences

- Empty narrative is OK when the pack has excerpts.
- Pack miss + empty narrative fails the item with `content_input_invalid`.
- Toggling sources affects the **next** job’s research pack, not in-flight jobs.
- **Supersedes** [`CONTENT_PRODUCTION_PIPELINE_V2.md`](CONTENT_PRODUCTION_PIPELINE_V2.md) precondition that every stop narrative must be `approved` before `startJob`. Narrative approval remains an editorial/publish gate only.
- **Auto-stop provisioning removed** — place presentations replace the stop × variant model; research-first remains at **place** level.
- **Known low risks (Security):** `getEnabledSourceKeys` fails open to catalog defaults on non-401 DB errors (self-scoped outbound research only).
