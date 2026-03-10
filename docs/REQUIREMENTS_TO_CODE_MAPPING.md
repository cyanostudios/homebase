# Requirements-to-Code Mapping

Exakt mappning från varje krav i [CHANNEL_REQUIREMENTS_MATRIX.md](CHANNEL_REQUIREMENTS_MATRIX.md) till valideringskod. Använd för spårbarhet, felsökning och verifiering att alla krav är täckta.

**Shipping_time:** CDON 1–10, Fyndiq 1–20 (behålls tills support bekräftar API-gränser).

---

## CDON (create/full update)

### Input-issues (före mappning – `getCdonArticleInputIssues`)

| Krav                            | Fil                 | Funktion                  | Rad     | Reason/error                                               |
| ------------------------------- | ------------------- | ------------------------- | ------- | ---------------------------------------------------------- |
| `sku` String 1–64               | mapToCdonArticle.js | getCdonArticleInputIssues | 188–189 | `missing_sku`, `invalid_sku_length`                        |
| `title` 5–150 tecken            | mapToCdonArticle.js | getCdonArticleInputIssues | 198–199 | `invalid_title_length`                                     |
| `main_image` giltig URL         | mapToCdonArticle.js | getCdonArticleInputIssues | 202–203 | `missing_main_image`, `invalid_main_image_url`             |
| `images` giltiga URL:er         | mapToCdonArticle.js | getCdonArticleInputIssues | 247–249 | `invalid_images_url`                                       |
| `quantity` ≥ 0                  | mapToCdonArticle.js | getCdonArticleInputIssues | 191     | `invalid_quantity`                                         |
| `description` 10–4096 tecken    | mapToCdonArticle.js | getCdonArticleInputIssues | 206–209 | `missing_or_short_description`                             |
| Positivt pris per aktiv marknad | mapToCdonArticle.js | getCdonArticleInputIssues | 216–225 | `missing_positive_price`                                   |
| Exakt en giltig kategori        | mapToCdonArticle.js | getCdonArticleInputIssues | 227–240 | `missing_category`, `conflicting_active_market_categories` |

### Mapper (returnerar null vid saknade fält – `mapProductToCdonArticle`)

| Krav                      | Fil                 | Funktion                | Rad     | Beteende                     |
| ------------------------- | ------------------- | ----------------------- | ------- | ---------------------------- |
| `sku`                     | mapToCdonArticle.js | mapProductToCdonArticle | 36–37   | return null om tom           |
| `title` 5–150             | mapToCdonArticle.js | mapProductToCdonArticle | 46–52   | return null om &lt;5         |
| `main_image`              | mapToCdonArticle.js | mapProductToCdonArticle | 36–37   | return null om tom           |
| `quantity` ≥ 0            | mapToCdonArticle.js | mapProductToCdonArticle | 37–38   | return null om ogiltig       |
| `description` 10–4096     | mapToCdonArticle.js | mapProductToCdonArticle | 55–64   | return null om &lt;10        |
| `price` per market &gt; 0 | mapToCdonArticle.js | mapProductToCdonArticle | 76–94   | return null om ingen positiv |
| `shipping_time` 1–10      | mapToCdonArticle.js | mapProductToCdonArticle | 105–109 | clamp 1–10                   |
| `category` exakt en       | mapToCdonArticle.js | mapProductToCdonArticle | 126–139 | return null om 0 eller &gt;1 |
| `status` for sale/paused  | mapToCdonArticle.js | mapProductToCdonArticle | 35      | default 'for sale'           |
| `markets` SE,DK,FI,NO     | mapToCdonArticle.js | mapProductToCdonArticle | 43      | från marketsFilter           |

### Payload-validering (efter mappning – `validateCdonArticlePayload`)

| Krav                                | Fil                 | Funktion                   | Rad     | Reason/error                                                             |
| ----------------------------------- | ------------------- | -------------------------- | ------- | ------------------------------------------------------------------------ |
| article objekt                      | mapToCdonArticle.js | validateCdonArticlePayload | 247–248 | `invalid_article_object`                                                 |
| `sku` 1–64                          | mapToCdonArticle.js | validateCdonArticlePayload | 250–253 | `missing_sku`, `invalid_sku_length`                                      |
| `status` for sale/paused            | mapToCdonArticle.js | validateCdonArticlePayload | 251–254 | `invalid_status`                                                         |
| `quantity` integer ≥ 0              | mapToCdonArticle.js | validateCdonArticlePayload | 256–257 | `invalid_quantity`                                                       |
| `main_image` giltig URL             | mapToCdonArticle.js | validateCdonArticlePayload | 281–283 | `missing_main_image`, `invalid_main_image_url`                           |
| `images` giltiga URL:er             | mapToCdonArticle.js | validateCdonArticlePayload | 345–347 | `invalid_images_url`                                                     |
| `markets` array                     | mapToCdonArticle.js | validateCdonArticlePayload | 285–292 | `missing_markets`, `invalid_market`                                      |
| `title` 5–150                       | mapToCdonArticle.js | validateCdonArticlePayload | 271–275 | `missing_title_rows`, `invalid_title_value`                              |
| `description` 10–4096               | mapToCdonArticle.js | validateCdonArticlePayload | 278–284 | `missing_description_rows`, `invalid_description_value`                  |
| `price` amount_including_vat &gt; 0 | mapToCdonArticle.js | validateCdonArticlePayload | 286–299 | `missing_price_rows`, `invalid_amount_including_vat`, `invalid_currency` |
| `shipping_time` 1–10                | mapToCdonArticle.js | validateCdonArticlePayload | 302–314 | `invalid_shipping_time_range`                                            |
| `category`                          | mapToCdonArticle.js | validateCdonArticlePayload | 317–318 | `missing_category`                                                       |

### Controller-anrop

| Steg                | Fil                         | Rad       | Beskrivning                                             |
| ------------------- | --------------------------- | --------- | ------------------------------------------------------- |
| Mappning            | cdon-products/controller.js | 1007      | mapProductToCdonArticle                                 |
| Payload-check       | cdon-products/controller.js | 1009–1017 | validateCdonArticlePayload → contract_validation_failed |
| Input-issues        | cdon-products/controller.js | 1021–1027 | getCdonArticleInputIssues → mapper_rejected             |
| Ingen aktiv marknad | cdon-products/controller.js | 993–1005  | expected_skip, no_active_channel_market                 |

---

## Fyndiq (create/full update)

### Input-issues (före mappning – `getFyndiqArticleInputIssues`)

| Krav                            | Fil                   | Funktion                    | Rad     | Reason/error                                          |
| ------------------------------- | --------------------- | --------------------------- | ------- | ----------------------------------------------------- |
| `sku` String 1–64               | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 182–183 | `missing_sku`, `invalid_sku_length`                   |
| `title` 5–150 tecken            | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 192–193 | `invalid_title_length`                                |
| `main_image` giltig URL         | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 196–197 | `missing_main_image`, `invalid_main_image_url`        |
| `images` giltiga URL:er         | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 248–250 | `invalid_images_url`                                  |
| `quantity` ≥ 0                  | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 185     | `invalid_quantity`                                    |
| `description` 10–4096 tecken    | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 200–203 | `missing_or_short_description`                        |
| Minst en giltig kategori        | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 206–216 | `missing_category_for_market:X`, `missing_categories` |
| Positivt pris per aktiv marknad | mapToFyndiqArticle.js | getFyndiqArticleInputIssues | 220–229 | `missing_positive_price`                              |

### Mapper (returnerar null vid saknade fält – `mapProductToFyndiqArticle`)

| Krav                      | Fil                   | Funktion                  | Rad     | Beteende                     |
| ------------------------- | --------------------- | ------------------------- | ------- | ---------------------------- |
| `sku`                     | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 36–37   | return null om tom           |
| `title` 5–150             | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 56–61   | return null om &lt;5         |
| `main_image`              | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 36–37   | return null om tom           |
| `quantity` ≥ 0            | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 37–38   | return null om ogiltig       |
| `description` 10–4096     | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 65–73   | return null om &lt;10        |
| `price` per market &gt; 0 | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 76–94   | return null om ingen positiv |
| `shipping_time` 1–20      | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 105–110 | clamp 1–20                   |
| `categories` minst en     | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 114–129 | return null om tom           |
| `status` for sale/paused  | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 35      | default 'for sale'           |
| `markets` SE,DK,FI,NO     | mapToFyndiqArticle.js | mapProductToFyndiqArticle | 51      | från marketsFilter           |

### Payload-validering (efter mappning – `validateFyndiqArticlePayload`)

| Krav                     | Fil                   | Funktion                     | Rad     | Reason/error                                            |
| ------------------------ | --------------------- | ---------------------------- | ------- | ------------------------------------------------------- |
| article objekt           | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 236–237 | `invalid_article_object`                                |
| `sku` 1–64               | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 239–242 | `missing_sku`, `invalid_sku_length`                     |
| `status` for sale/paused | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 241–244 | `invalid_status`                                        |
| `quantity` integer ≥ 0   | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 245–246 | `invalid_quantity`                                      |
| `main_image` giltig URL  | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 262–264 | `missing_main_image`, `invalid_main_image_url`          |
| `images` giltiga URL:er  | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 324–326 | `invalid_images_url`                                    |
| `categories` array       | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 249–250 | `missing_categories`                                    |
| `markets` array          | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 252–259 | `missing_markets`, `invalid_market`                     |
| `title` 5–150            | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 262–266 | `missing_title_rows`, `invalid_title_value`             |
| `description` 10–4096    | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 269–275 | `missing_description_rows`, `invalid_description_value` |
| `price` amount &gt; 0    | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 277–289 | `invalid_amount`, `invalid_currency`                    |
| `shipping_time` 1–20     | mapToFyndiqArticle.js | validateFyndiqArticlePayload | 292–304 | `invalid_shipping_time_range`                           |

### article_id/UUID vid update (update_only_strict)

| Krav                           | Fil                           | Rad                                        | Beskrivning                                   |
| ------------------------------ | ----------------------------- | ------------------------------------------ | --------------------------------------------- |
| external_id måste vara UUID v4 | fyndiq-products/controller.js | 812–825                                    | Validerar innan update_article_price/quantity |
| Action-envelope id             | fyndiq-products/controller.js | validateFyndiqUpdateActionEnvelope 591–597 | invalid_article_id om inte UUID               |

### Controller-anrop

| Steg                | Fil                           | Rad     | Beskrivning                                               |
| ------------------- | ----------------------------- | ------- | --------------------------------------------------------- |
| Mappning            | fyndiq-products/controller.js | 434     | mapProductToFyndiqArticle                                 |
| Input-issues        | fyndiq-products/controller.js | 436–454 | getFyndiqArticleInputIssues → mapper_rejected             |
| Payload-check       | fyndiq-products/controller.js | 456–474 | validateFyndiqArticlePayload → contract_validation_failed |
| Ingen aktiv marknad | fyndiq-products/controller.js | 419–431 | expected_skip, no_active_channel_market                   |

---

## WooCommerce

### update_only_strict (endast uppdatering)

| Krav                                    | Fil                                | Funktion/plats                 | Rad          | Reason/error                               |
| --------------------------------------- | ---------------------------------- | ------------------------------ | ------------ | ------------------------------------------ |
| product.id krävs                        | woocommerce-products/routes.js     | body('products').custom        | 120          | "product.id is required"                   |
| quantity ≥ 0                            | woocommerce-products/routes.js     | body('products').custom        | 121–124      | "product.quantity must be non-negative"    |
| priceAmount ≥ 0 (request)               | woocommerce-products/routes.js     | body('products').custom        | 125–131      | "product.priceAmount must be non-negative" |
| Mappad target (external_id)             | woocommerce-products/controller.js | exportProductsUpdateOnlyStrict | 610–624      | skipped_no_map, no_mapped_target           |
| Effektivt pris: blockera null, tillåt 0 | woocommerce-products/controller.js | exportProductsUpdateOnlyStrict | 639–647      | missing_or_invalid_effective_price         |
| quantity finitt tal                     | woocommerce-products/controller.js | exportProductsUpdateOnlyStrict | 627, 634–635 | missing_or_invalid_effective_price         |

### create/update (full batch)

| Krav                             | Fil                                | Funktion                      | Rad       | Beskrivning                                            |
| -------------------------------- | ---------------------------------- | ----------------------------- | --------- | ------------------------------------------------------ |
| instanceIds krävs                | woocommerce-products/controller.js | \_getInstancesFromBodyOrThrow | 53–80     | 400 om tomt                                            |
| Positivt pris (override först)   | woocommerce-products/controller.js | mapProductToWoo               | 1495      | regular_price från priceAmount                         |
| main_image/images giltiga URL:er | woocommerce-products/controller.js | exportProducts create/update  | 406–428   | invalid_main_image_url, invalid_images_url             |
| Lager/quantity                   | woocommerce-products/controller.js | mapProductToWoo               | 1481      | stock_quantity                                         |
| Kategorier (multi)               | woocommerce-products/controller.js | mapProductToWoo               | 1483–1487 | categories från override                               |
| Payload-shape                    | woocommerce-products/controller.js | mapProductToWoo               | 1475–1490 | sku, name, status, regular_price, stock_quantity, etc. |

### create/update – lokal validering (ny)

| Krav               | Fil                                | Rad     | Beskrivning                                       |
| ------------------ | ---------------------------------- | ------- | ------------------------------------------------- |
| Blockera null pris | woocommerce-products/controller.js | 393–406 | validation_error om priceAmount null/undefined    |
| Tillåt pris 0      | woocommerce-products/controller.js | 639–641 | overridePrice/basePrice >= 0 (update_only_strict) |

### Luckor (ej explicit validering i create/update-path)

- ~~**Positivt pris vid create:**~~ Åtgärdat: blockera null, tillåt 0.
- **stock_status:** mapProductToWoo använder `manage_stock: true` + `stock_quantity`; ingen explicit stock_status-validering.
- **Ingen preflight:** create/update-path har ingen dry-run/validering före API-anrop (skillnad mot CDON/Fyndiq Phase 2).

---

## Öppna frågor (för att fylla planen helt)

### 1. CDON/Fyndiq – sku längd 1–64

Kravmatrisen säger `sku` String 1–64. Koden validerar inte längden explicit (bara att den inte är tom). Ska vi lägga till längdvalidering?

### 2. CDON/Fyndiq – main_image URL-format

Kravmatrisen säger "giltig URL". Koden validerar bara att fältet inte är tomt. Ska vi validera URL-format (t.ex. `https://`)?

### 3. Fyndiq – article_id/UUID vid update ✓ (implementerat)

Kravmatrisen nämner "Stoppa om article_id/identifierare inte matchar förväntat format (UUID vid update)". **Implementerat i:** `plugins/fyndiq-products/controller.js` rad 812–825 (update_only_strict) och `validateFyndiqUpdateActionEnvelope` rad 591–597. external_id från channel_product_map valideras mot UUID v4-regex innan update skickas.

### 4. WooCommerce – create/update preflight ✓ (implementerat)

Lokal payload-validering före API-anrop tillagd. Inga extra WooCommerce-anrop – endast validering av effektivt pris (blockera null).

### 5. WooCommerce – pris: blockera null, tillåt 0 ✓ (implementerat)

Create/update: produkter med null/undefined pris blockeras (validation_error). Pris 0 tillåts. update_only_strict: samma logik (blockera null, tillåt 0).

### 6. CDON – category som "optional" i API ✓ (bekräftat)

Kravmatrisen kräver category. Kvar som krav enligt användaren.

### 7. Dokumentationsreferens ✓ (implementerat)

CHANNEL_REQUIREMENTS_MATRIX.md uppdaterad med länk till denna fil.
