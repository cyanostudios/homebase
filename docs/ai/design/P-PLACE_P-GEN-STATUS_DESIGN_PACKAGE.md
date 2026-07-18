# Design package — P-PLACE + P-GEN-STATUS (Grind 3)

**Status:** Implemented locally 2026-07-18 — awaiting commit/deploy by user decision  
**Sources:** Solution Architect Output Contract (Grind 2) + UI/UX Designer Output Contract (Grind 3)  
**ADRs:** [`P-PLACE_PLACE_IDENTIFICATION.md`](../adr/P-PLACE_PLACE_IDENTIFICATION.md), [`P-GEN-STATUS_GENERATION_READINESS_AND_COST.md`](../adr/P-GEN-STATUS_GENERATION_READINESS_AND_COST.md)

---

## TPM decisions on open UX questions

| ID  | Decision                                                                                   | Rationale                                                                       |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| F1  | Preflight runs **inside** `StartProductionDialog` on Confirm                               | Matches Architect fail-fast on Generate start; keeps pending/error in one place |
| F2  | Show Nominatim attribution in popover footer **when** active place provider is `nominatim` | Usage policy; hide for other adapters                                           |
| F3  | Display raw `currency` from contract with `~` prefix (no FX conversion in v1)              | Keeps Guides cost-naive; no new pricing logic in UI                             |
| F4  | `usageSummary` = **latest job only** (not lifetime aggregate)                              | Matches Architect ADR                                                           |

Legacy guides without `PlaceResolved`: show prior `geographicReference` in manual resolved state (implementation epic).

---

## Architecture summary (binding)

### Place identification

- New `places` capability plugin (registry + catalog); default adapter **Nominatim** (keyless).
- Additive columns on `guide_places`; keep `geographic_reference`.
- `PlaceResolved` snapshot on save; `placeContext` structured object into text generation prompts.
- Search: `GET /api/places/search?q=`

### Generate readiness

- `AIProviderRouter.checkReadiness` → `{ ready, failure?: { code } }` — never tokens/credit.
- Preflight before job create → **422** + stable `GenerationFailureCode`.
- Worker still maps runtime failures to same codes.

### Cost metadata

- Pricing + `CostCalculator` in `ai-providers`; store `usage` + `cost` in `provider_result`.
- Derived `usageSummary` on job payload; render in existing GuideView Information sidebar.

---

## UX summary (binding for Frontend)

### (a) PlaceSearch in GuideForm

- Autocomplete (Popover + Input pattern like TaskAssigneeSelect); ≥2 chars, ~300 ms debounce.
- Manual fallback always available; resolved chip + Change/Clear.
- i18n keys under `guides.place.*` (see Designer Output Contract).

### (b) Generate failures

- Pending: "Kontrollerar …" on Confirm; dialog stays open on 422.
- Retryable vs terminal button sets; settings link for not_configured / auth_failed.
- Swedish copy per code in Designer Output Contract; never show credit/token numbers in errors.

### (c) Genereringsinfo in Information panel

- DetailSection only when `usageSummary` present.
- Provider, Model, tokens in/out/total, ~estimated cost, latency; footnote that cost is estimated.

---

## Out of scope until implementation epic

Backend, Frontend, QA, Security, Documentation implementation. No production code in this phase beyond ADR/design docs.
