# ADR: Guide content source registry (research pack)

**Status:** Accepted  
**Date:** 2026-07-18  
**Context:** Guides editor vision — research-first from place via an extensible source list (v1: Wikipedia + UNESCO), then deep → normal/quick.

## Decision

1. **Content sources** live in `plugins/guides/sources/` as a catalog + registry (same pattern as places / AI providers). Guides orchestration only consumes a **source pack** (`sourceKey`, excerpts, URLs) — never Wikipedia/UNESCO-specific APIs.
2. **v1 adapters:** Wikipedia (geosearch/search + extracts) and UNESCO WHC list match. New sources = catalog entry + adapter registration.
3. **Produce pipeline:** On `text_derivation` planning, fetch pack from place snapshot → store on `job_options.sourcePack` → deep generates from pack → normal/quick wait for deep sibling and summarize.
4. **Honesty:** Readiness requires a **generatable** text adapter (not noop / not catalog-only providers). Default phases are text-only until real translation exists.

## Consequences

- Empty narrative is OK when the pack has excerpts.
- Pack miss + empty narrative fails the item with `content_input_invalid`.
- Translation remains available as an explicit phase but is not default.
