> **ARKIVERAD:** Denna fil är arkiverad och kan användas som referens i sista hand. Den ska inte gälla som aktuellt dokument. Den ersattes av `docs/CHANNEL_REQUIREMENTS_MATRIX.md`.

---

# Required Matrix — Phase 2 (CDON + Fyndiq)

Purpose: strict preflight contract before create/full article export.  
Policy: no fallback guessing, no silent coercion, fail fast with explicit reason.

## Common product-level requirements

- `sku`: required, non-empty string
- `status`: required, allowed `for sale` or `paused`
- `quantity`: required, integer `>= 0`
- `main_image`: required, non-empty string URL
- `markets`: required, array with `SE|DK|FI`
- `title[]`: required, each row `value` length `5..150`
- `description[]`: required, each row `value` length `10..4096`
- `shipping_time[]`: required, each row:
  - `market` in `SE|DK|FI`
  - `min/max` integers in `1..9`
  - `min <= max`

## CDON article requirements (bulk create/update payload)

- `price[]`: required, at least one row
  - `market` in `SE|DK|FI`
  - `value.amount_including_vat` positive number (`> 0`)
  - `value.currency` ISO-4217 (`[A-Z]{3}`)
- Optional fields are allowed but never inferred.

Current validation failure prefix:

- `contract_validation_failed:<reason>`

## Fyndiq article requirements (bulk create/update payload)

- `categories[]`: required, non-empty
- `price[]`: required, at least one row
  - `market` in `SE|DK|FI`
  - `value.amount` positive number (`> 0`)
  - `value.currency` ISO-4217 (`[A-Z]{3}`)
- Optional fields are allowed but never inferred.

Current validation failure prefix:

- `contract_validation_failed:<reason>`

## Implemented in code

- `plugins/cdon-products/mapToCdonArticle.js`
  - `validateCdonArticlePayload()`
- `plugins/fyndiq-products/mapToFyndiqArticle.js`
  - `validateFyndiqArticlePayload()`
- Export flows now run mapper + contract validator before API call:
  - `plugins/cdon-products/controller.js`
  - `plugins/fyndiq-products/controller.js`
