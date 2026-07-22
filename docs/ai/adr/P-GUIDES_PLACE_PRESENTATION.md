# ADR: P-GUIDES_PLACE_PRESENTATION — One guide per place

**Status:** Accepted  
**Date:** 2026-07-19  
**Supersedes:** Stop × length-variant model (`guide_stops`, `variant_type` quick/normal/deep) in content production.

## Context

Guides previously modeled Place → MasterGuide → Stop → Variant(type × language). Production ran deep-first then summarized normal/quick per stop. Product direction is **one guide per place**: research → generate one text → review (optional translation by language).

## Decision

1. **Domain:** `guide_presentations` on `master_guide_id` + `language` (unique). Fields: `presentation_text`, `approval_status`, `publication_status`, `staleness_status`. No `variant_type`. No `guide_stops`.
2. **Migrate:** Prefer existing text in order `normal` → `deep` → `quick` per `(place, language)`; then drop audio, variants, stops.
3. **Production jobs:** Type `full_guide` only. Job items reference `presentation_id` (not stop/variant). No deep-sibling wait. One `text_derivation` item per language presentation; translation targets other-language presentations.
4. **Prompts:** Single text_derivation prompt set (no per-length folders). Prompt set **v1.4** targets a spoken audioguide narrative (~1200–1800 words; `maxCompletionTokens` 2800).
5. **API:** `GET/PUT /api/guides/:id/presentations` (+ `/:language`); remove `/:id/stops/**` and nested audio.
6. **Public:** Expose place + presentations (not stop tree).
7. **Audio/TTS:** Out of scope; `guide_audio` dropped with variants.

## Consequences

- Auto-stop provisioning removed.
- Review/produce UI is place-scoped.
- Existing multi-stop tours collapse to one presentation per language (data loss of other stops’ texts beyond migrate preference rule — accepted).
