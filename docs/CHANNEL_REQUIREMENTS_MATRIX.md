# Channel Requirements Matrix

Låst kravmatris för CDON, Fyndiq och WooCommerce. Varje regel är mappad till exakt validering i kod.

## CDON (create/full update)

- **Obligatoriskt payload-innehåll**
  - `sku` – String 1–64
  - `status` – `"for sale"` eller `"paused"`
  - `quantity` – integer ≥ 0
  - `main_image` – giltig URL
  - `markets` – array med SE, DK, FI eller NO
  - `title` – array per språk, `value` 5–150 tecken
  - `description` – array per språk, `value` 10–4096 tecken
  - `price` – per market, `amount_including_vat` > 0, giltig `currency` (ISO 4217)
  - `shipping_time` – per market, `min`/`max` 1–10 (heltal)
  - `category` – exakt en giltig kategori

- **Blockerande valideringar**
  - Stoppa om kategori saknas, är `0` eller flera olika kategorier krävs där en enda förväntas
  - Stoppa om effektivt pris inte är positivt finitt tal
  - Stoppa om required-fält saknas eller fel typ/format
  - Stoppa om ingen aktiv marknad finns för produkten

- **Kodkoppling**
  - `plugins/cdon-products/mapToCdonArticle.js`: `validateCdonArticlePayload`, `getCdonArticleInputIssues`
  - `plugins/cdon-products/controller.js`: `exportProducts` (Phase 2)

## Fyndiq (create/full update)

- **Obligatoriskt payload-innehåll**
  - `sku` – String 1–64
  - `status` – `"for sale"` eller `"paused"`
  - `quantity` – integer ≥ 0
  - `main_image` – giltig URL
  - `markets` – array med SE, DK, FI eller NO
  - `title` – array per språk, `value` 5–150 tecken
  - `description` – array per språk, `value` 10–4096 tecken
  - `price` – per market, `amount` > 0, giltig `currency`
  - `shipping_time` – per market, `min`/`max` 1–20 (heltal)
  - `categories` – minst en giltig kategori

- **Blockerande valideringar**
  - Stoppa om `article_id`/identifierare inte matchar förväntat format (UUID vid update)
  - Stoppa om kategorier saknas för aktiv target eller innehåller ogiltiga värden (`0`, tomt)
  - Stoppa om effektivt pris inte är positivt finitt tal
  - Stoppa om required-fält saknas eller fel typ/format

- **Kodkoppling**
  - `plugins/fyndiq-products/mapToFyndiqArticle.js`: `validateFyndiqArticlePayload`, `getFyndiqArticleInputIssues`
  - `plugins/fyndiq-products/controller.js`: `exportProducts` (Phase 2)

## WooCommerce (requirements)

- **Obligatoriskt payload-innehåll (för senare write-path)**
  - Positivt pris (override först, baspris endast om override är `NULL`)
  - Lager/stock-status enligt Woo-kontrakt
  - Kategoriuppsättning som stöder flera kategorier

- **Blockerande valideringar**
  - Stoppa om effektivt pris saknas/ogiltigt för aktiv target
  - Stoppa om payload avviker från definierad shape för update/create

- **Kodkoppling**
  - `plugins/woocommerce-products/controller.js`: `exportProducts`, `mapProductToWoo`
