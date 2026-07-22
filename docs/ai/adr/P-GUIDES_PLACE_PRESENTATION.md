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
5. **API:** `GET/PUT /api/guides/:id/presentations` (+ `/:language`); `POST /api/guides/:id/presentations` creates an empty language shell idempotently (`ensurePresentationForLanguage`); remove `/:id/stops/**` and nested audio.
6. **Public:** Expose place + presentations (not stop tree).
7. **Audio/TTS (2026-07-22):** Variant-/stop-skopad audio dropped with the place model. **Presentation-scoped** audio is in scope again as a prep epic — see [`P-AUDIO_GENERATION_PREP.md`](P-AUDIO_GENERATION_PREP.md) (`guide_audio.presentation_id` 1:1; manual generate; no pipeline `audio` phase yet; noop TTS only).
8. **HITL writeback (2026-07-22):** `applyProductionPresentationText` sets `approval_status = approved` so job-item approve is sufficient for the approval gate (publish still requires `approved` + `fresh`).

## Consequences

- Auto-stop provisioning removed.
- Review/produce UI is place-scoped.
- Existing multi-stop tours collapse to one presentation per language (data loss of other stops’ texts beyond migrate preference rule — accepted).
- Create UX may start source `text_derivation` immediately (**Save and produce**); translations remain a separate editor action from detail.
