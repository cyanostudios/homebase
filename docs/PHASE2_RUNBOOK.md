# Phase 2 Runbook

Operativ runbook för Phase 2 (create/full article updates) CDON/Fyndiq. Använd av ny agent för att fortsätta utan kunskapstapp.

## Läsordning

1. [docs/CHANNEL_REQUIREMENTS_MATRIX.md](CHANNEL_REQUIREMENTS_MATRIX.md) – krav per kanal
2. [docs/Archive/phase2_delivery_roadmap_75ad0f73.plan.md](Archive/phase2_delivery_roadmap_75ad0f73.plan.md) – plan (arkiverad)
3. Denna runbook

## Kommandon

### Preflight (read-only, dryRun)

Kör innan write-pilot. Stop/Go: endast `expected_skip` tillåtna; inga `contract_validation_failed`.

```bash
PHASE1_PILOT_USER_ID=1 node scripts/phase2-preflight.js
```

Med limit och marknader:

```bash
PHASE2_PREFLIGHT_LIMIT=20 PHASE2_PREFLIGHT_MARKETS=se,fi PHASE1_PILOT_USER_ID=1 node scripts/phase2-preflight.js
```

### Write pilot (5–10 produkter)

Kör endast efter grön preflight. Gör faktiska API-anrop till CDON/Fyndiq.

```bash
PHASE1_PILOT_USER_ID=1 node scripts/phase2-write-pilot.js
```

Med limit:

```bash
PHASE2_WRITE_LIMIT=5 PHASE1_PILOT_USER_ID=1 node scripts/phase2-write-pilot.js
```

## Tolkningsregler

### Preflight-rapport

- `gate: "GO"` – inga validation_error, kan köra write-pilot
- `gate: "STOP"` – minst en validation_error, fixa innan write
- `validationErrors` – lista med `productId`, `error`, `channel`; mappa till [CHANNEL_REQUIREMENTS_MATRIX.md](CHANNEL_REQUIREMENTS_MATRIX.md)

### Felkoder

- `contract_validation_failed:<reason>` – payload bryter mot kanalens kontrakt (se kravmatrisen)
- `mapper_rejected:<reason>` – input saknar obligatoriska fält (t.ex. `missing_category`, `missing_positive_price`)
- `expected_skip` – produkten ska inte exporteras (t.ex. ingen aktiv marknad)

### Stop/Go-kriterier

- **GO för preflight:** `validation_error === 0`
- **GO för write-pilot:** HTTP-status < 400 för både CDON och Fyndiq, inga oväntade channel_error

## Rollback

Om write-pilot orsakat fel på kanalerna:

1. Stoppa vidare export
2. Återställ produkter manuellt i CDON/Fyndiq om nödvändigt
3. Analysera `validationErrors` från senaste preflight
4. Uppdatera produkter/overrides i Homebase så att kravmatrisen uppfylls
5. Kör preflight igen tills gate är GO

## Kodkoppling

| Krav              | Fil                                             |
| ----------------- | ----------------------------------------------- |
| CDON contract     | `plugins/cdon-products/mapToCdonArticle.js`     |
| CDON controller   | `plugins/cdon-products/controller.js`           |
| Fyndiq contract   | `plugins/fyndiq-products/mapToFyndiqArticle.js` |
| Fyndiq controller | `plugins/fyndiq-products/controller.js`         |
| WooCommerce       | `plugins/woocommerce-products/controller.js`    |
