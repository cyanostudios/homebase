# ADR: P-TRANS — Guide translation provider

**Status:** Accepted  
**Date:** 2026-07-18  
**Context:** Produce must translate approved source-language text into target-language variants with a real provider (not noop stubs).

## Decision

1. **Adapter:** `OpenAITranslationProvider` mirrors the text adapter (Chat Completions, rate limit, `failureCode`, usage/cost via `CostCalculator`). Prompts live under `plugins/guides/providers/translation/prompts/` (`v1`).
2. **Routing:** `TranslationProviderConfigResolver` uses the same Guides AI routing (`AIProviderRouter`) as text. Env fallbacks: `GUIDES_TRANSLATION_PROVIDER` → `GUIDES_TEXT_PROVIDER` → `noop`.
3. **Same-language skip:** Items are `skipped` when `targetLanguage` matches place `sourceLanguage` (clear `errorMessage`).
4. **Default phases:** `startJob` uses `['text_derivation']` only. If any in-scope variant has another language, phases become `['text_derivation', 'translation']`. Explicit `phases`/`steps` always win.
5. **Noop block:** Silent noop translation is blocked unless `GUIDES_ALLOW_NOOP_TEXT` is set (same flag as text).

## Consequences

- Translation review is a second HITL phase when other-language variants exist.
- Frontend shows the translation step when `job.phases` includes `translation`.
