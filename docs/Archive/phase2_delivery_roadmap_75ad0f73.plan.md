---
name: phase2_delivery_roadmap
overview: Kort, leveransdriven plan med fokus på att få en liten Phase 2-batch helt korrekt först. Ingen uppskalning förrän kontrakt/krav och payloads är verifierade för CDON/Fyndiq/WooCommerce.
todos:
  - id: phase2-contract-hardening
    content: Slutför och lås create/full contract-validering i CDON/Fyndiq write-flöden.
    status: completed
  - id: channel-requirements-matrix
    content: Bygg och lås en requirements-matris per kanal (CDON/Fyndiq/WooCommerce) med obligatoriska fält, datatyper och affärsregler.
    status: completed
  - id: requirements-to-code-mapping
    content: Mappa varje krav i matrisen till exakt validator/mapper/controller-check i kodbasen.
    status: completed
  - id: phase2-preflight-runner
    content: Inför en enhetlig preflight-gate körning med tydlig stop/go-rapportering.
    status: completed
  - id: phase2-write-pilot
    content: Kör begränsad write-pilot (5–10) med strikt urval och felgating.
    status: completed
  - id: handover-runbook
    content: Slutför kort operativ runbook för ny agent (kommandon, tolkning, rollback).
    status: completed
isProject: false
---

> **ARKIVERAD:** Denna fil är arkiverad och kan användas som referens i sista hand. Den ska inte gälla som aktuellt dokument.

# Phase 2 Delivery Plan (Trimmed)

## Mål

Leverera `create/full article updates` för CDON/Fyndiq genom att först få en liten batch helt korrekt, med verifierade kanal-krav och strikt stop/go innan någon uppskalning ens övervägs.

## Scope (nu)

- Bygg vidare på befintlig preflight/contract-validering i:
- [plugins/cdon-products/controller.js](../../plugins/cdon-products/controller.js)
- [plugins/fyndiq-products/controller.js](../../plugins/fyndiq-products/controller.js)
- [plugins/cdon-products/mapToCdonArticle.js](../../plugins/cdon-products/mapToCdonArticle.js)
- [plugins/fyndiq-products/mapToFyndiqArticle.js](../../plugins/fyndiq-products/mapToFyndiqArticle.js)
- Inkludera kanal-krav för WooCommerce i samma kravmatris (även om write-pilot nu primärt gäller CDON/Fyndiq), så att payload- och fältkrav är kompletta.
- Kategori-spåret är **inte** ett separat fokus nu; endast håll canonical shape låst i import/mapper/UI (ingen ny redesign).

## Kravmatris (detaljerad, låses först)

### CDON (create/full update)

- **Obligatoriskt payload-innehåll**
- Artikelidentitet och mappad target per aktiv marknad.
- Namn/beskrivning enligt kanalens språkkrav.
- Positivt pris och giltig valuta per aktiv marknad.
- Lager/kvantitet som giltigt heltal enligt kontrakt.
- Exakt en giltig kategori för aktiva CDON-targets.
- **Blockerande valideringar**
- Stoppa om kategori saknas, är `0` eller flera olika kategorier krävs där en enda förväntas.
- Stoppa om effektivt pris inte är positivt finitt tal.
- Stoppa om required-fält saknas eller fel typ/format.
- Stoppa om ingen aktiv marknad finns för produkten.
- **Kodkoppling att verifiera**
- [plugins/cdon-products/mapToCdonArticle.js](../../plugins/cdon-products/mapToCdonArticle.js)
- [plugins/cdon-products/controller.js](../../plugins/cdon-products/controller.js)

### Fyndiq (create/full update)

- **Obligatoriskt payload-innehåll**
- Artikelidentitet och mappad target per aktiv marknad.
- Namn/beskrivning enligt kanalens språkkrav.
- Positivt pris och giltig valuta per aktiv marknad.
- Lager/kvantitet enligt kontrakt.
- Minst en giltig kategori från aktiva targets.
- **Blockerande valideringar**
- Stoppa om `article_id`/identifierare inte matchar förväntat format.
- Stoppa om kategorier saknas för aktiv target eller innehåller ogiltiga värden (`0`, tomt).
- Stoppa om effektivt pris inte är positivt finitt tal.
- Stoppa om required-fält saknas eller fel typ/format.
- **Kodkoppling att verifiera**
- [plugins/fyndiq-products/mapToFyndiqArticle.js](../../plugins/fyndiq-products/mapToFyndiqArticle.js)
- [plugins/fyndiq-products/controller.js](../../plugins/fyndiq-products/controller.js)

### WooCommerce (requirements only i detta steg)

- **Obligatoriskt payload-innehåll (för senare write-path)**
- Positivt pris (override först, baspris endast om override är `NULL`).
- Lager/stock-status enligt Woo-kontrakt.
- Kategoriuppsättning som stöder flera kategorier.
- **Blockerande valideringar**
- Stoppa om effektivt pris saknas/ogiltigt för aktiv target.
- Stoppa om payload avviker från definierad shape för update/create.
- **Kodkoppling att verifiera**
- [plugins/woocommerce-products/controller.js](../../plugins/woocommerce-products/controller.js)

## Execution Gates

1. **Gate A: Preflight green (read-only)**

- Kör 20 produkter per kanal/marknad med `dryRun: true`.
- Krav: endast förväntade skips (`expected_skip`), inga nya `contract_validation_failed`.
- Rapporten måste innehålla per-produkt reason code som går att mappa till kravmatrisen.

1. **Gate B: Write pilot (begränsad)**

- 5–10 produkter, utvalda med aktiv mappning och positivt effektivt pris.
- Krav: 0 oväntade channel errors, payload/resultat loggas per produkt.
- Endast CDON/Fyndiq i pilot; WooCommerce kvar som verifierad kravmatris i detta steg.

## Konkret leveransordning

1. **Lås requirements-matrisen** för CDON/Fyndiq/WooCommerce (obligatoriska fält, format, valideringsregler, vad som skickas i create/full update).
2. **Mappa krav -> kodpunkt** (validator/mapper/controller) och täpp till varje lucka innan pilot.
3. **Hårdgör create/full payload-kontrakt** i kod så att kravmatrisen är exekverbar och blockerar ogiltiga payloads.
4. **Inför tydlig preflight-gate runner** för CDON/Fyndiq med enhetlig rapport (requested/expected_skip/validation_error/channel_error).
5. **Aktivera write-pilot path** bakom explicit mode-flag (ingen implicit körning) och kör endast liten batch (5–10).
6. **Lägg till minimala regressionstester** för pris-/aktivitet-/mapping-invarians och kontraktsbrott.
7. **Runbook för ny agent**: exakta kommandon, tolkningsregler för rapport, stop/go-kriterier och rollback.

## Out of Scope (nu)

- Uppskalning av batchar (20/100+) innan liten batch är verifierat stabil och komplett enligt kravmatrisen
- UI-ombyggnad utöver rena blocker-fixar för Phase 2
- Bred refaktorering utanför exportflödena

## Definition of Done

- Kravmatrisen för CDON/Fyndiq/WooCommerce är låst och mappad mot faktisk valideringskod.
- Phase 2 write-pilot (5–10) körd med godkänt resultat och utan oväntade fel.
- Alla pilotfel går att härleda till explicit regel i kravmatrisen (inga diffusa "unknown").
- Regressionstester + runbook räcker för att nästa agent kan fortsätta utan kunskapstapp.
