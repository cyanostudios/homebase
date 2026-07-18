# ADR — P-GEN-STATUS: Generation Readiness + Cost Metadata

**Status:** Implementerad lokalt 2026-07-18. QA-verifierad (enhetstester + typecheck). Ej commit/deploy.  
**Epic:** P-GEN-STATUS  
**Relaterad:** [`P-TEXT_TEXT_PROVIDER.md`](P-TEXT_TEXT_PROVIDER.md), [`P-AI-SETTINGS_PROVIDER_CONFIGURATION.md`](P-AI-SETTINGS_PROVIDER_CONFIGURATION.md)  
**Grund:** TPM Output Contract (Grind 1 godkänd) + Solution Architect Output Contract (Grind 2)

---

## Sammanfattning

Vid Generate ska AI Providers äga validering och exekvering. Guides får aldrig veta tokens, saldo eller kredit. En preflight-readiness (ägd av AI Providers) körs vid klick och returnerar stabila, kreditfria felkoder. Efter lyckad generering returnerar AI Providers normaliserad usage + cost (pricing ägs av AI Providers) som visas i Guides befintliga info-panel.

---

## Låsta principer

| ID  | Princip                       | Uttryck                                         |
| --- | ----------------------------- | ----------------------------------------------- |
| GS1 | Guides är kredit-/prisokunnig | Endast `ready` + stabil kod, samt färdig `cost` |
| GS2 | Preflight + worker-mappning   | Fail fast vid klick; robust mappning i workern  |
| GS3 | Pricing i AI Providers        | `PROVIDER_CATALOG.pricing` + `CostCalculator`   |
| GS4 | Stabil felkod-taxonomi        | Ägs av ai-providers; Guides mappar till i18n    |

---

## Beslut

| Beslut      | Val                                                                   | Motivering                               |
| ----------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Readiness   | `AIProviderRouter.checkReadiness(req, { pluginKey })`                 | Byggs ovanpå befintlig `resolve()`       |
| Preflight   | `POST …/production-jobs` anropar readiness; **422** + kod om ej ready | Tydligt fel vid klick; inget jobb skapas |
| Runtime     | Worker mappar adapterfel till samma taxonomi                          | Försvar på djupet                        |
| Pricing     | `pricing` per modell i `PROVIDER_CATALOG` + `CostCalculator`          | Kostnad är provider-fråga                |
| Lagring     | `usage` + `cost` i befintlig `provider_result` JSONB                  | Ingen migration; P4-linje                |
| Aggregering | Härledd `usageSummary` på jobb-payload                                | Undviker dubbellagring                   |
| UI          | Befintlig `GuideView` info-panel                                      | Ingen separat kostnadsvy                 |

### Readiness-svar

```
{ ready: boolean, providerKey?: string, model?: string, failure?: { code: GenerationFailureCode } }
```

---

## GenerationFailureCode (SSOT i `ai-providers`)

```ts
type GenerationFailureCode =
  | 'provider_not_configured'
  | 'provider_not_generation_capable' // provider configured but no Guides text adapter
  | 'provider_auth_failed'
  | 'provider_quota_exhausted' // abstraherar kredit/saldo — aldrig siffror till Guides
  | 'provider_rate_limited' // retrybart
  | 'provider_unavailable' // retrybart
  | 'provider_invalid_request'
  | 'content_input_invalid'
  | 'provider_unknown_error';
```

Guides mappar `code → i18n`. Retrybart = `provider_rate_limited | provider_unavailable`.

### Kostnad (OpenAI-only idag)

`CostCalculator` läser `PROVIDER_CATALOG[provider].models[].pricing`. **Endast OpenAI-katalogmodeller har pricing-block**; övriga providers/modeller ger `null` (ingen kostnadssiffra i UI). Det är avsiktligt tills fler textadaptrar + pricing-tabeller läggs till.

### Kvot / saldo före start

**Behåll GS1:** `checkReadiness` är credit-free — ingen OpenAI balance-API, inga kreditsiffror. Kvot syns först via runtime-fel (`provider_quota_exhausted`) efter leverantörens HTTP-svar. Förbättrad fel-UX i Guides räcker; ingen förkoll planeras.

---

## GenerationUsage + GenerationCost

```ts
interface GenerationUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

interface GenerationCost {
  currency: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  estimated: true; // alltid uppskattad, aldrig faktisk fakturering
  pricingSource: string; // t.ex. 'catalog@2026-07'
}
```

Info-panel `usageSummary` (härledd): Provider, Model, tokens, estimated cost, latency — summerad över completed items i senaste jobbet.

---

## UX-constraints (för Designer)

- Tydligt, handlingsbart meddelande per kod; skilj retrybart vs terminalt.
- `provider_not_configured` / `provider_not_generation_capable` / `provider_auth_failed` → länk till AI Providers-inställningar.
- Inga token-/kredit-/saldosiffror i fel-UI.
- Kostnad alltid märkt som uppskattad.
- Preflight-pending (spinner) behövs; mål &lt;~1–2 s.

---

## Risker (flaggor)

- Pricing-katalog blir inaktuell → tydlig "uppskattad"-märkning + `effectiveDate`.
- Kredit/saldo-detektering är leverantörsspecifik — mappning i adaptrar, inte i Guides.
- Preflight ökar en round-trip (acceptabelt; billig `resolve()`).

---

## Status

**Implementerad** (readiness, failure taxonomy inkl. `provider_not_generation_capable`, usage/cost metadata, OpenAI-only pricing). Local first; credit-free preflight (GS1) oförändrad. Ej separat prod-deploy som del av denna dokumentationspass.
