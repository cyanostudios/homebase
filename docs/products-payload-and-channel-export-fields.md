# Produkter: fält för Homebase-CRUD och kanalexport

Referens för vilka parametrar som används i API/modell respektive i CDON-, Fyndiq- och WooCommerce-export (`mapToCdonArticle`, `mapToFyndiqArticle`, `mapProductToWoo` / `validateWooExportTextsForWoo`). Uppdatera vid ändringar i `plugins/products/model.js`, `controller.js`, `routes.js` och respektive kanal-plugin.

---

## 1. Homebase – gemensamma fält (CRUD + DB)

Källa: `plugins/products/routes.js`, `requireSku` + `normalizeInput` i `plugins/products/model.js`, `Product`-typ i klienten.

| Parameter (API / modell)                                                                | Obligatorisk för skapa via API\* | Default / notering                                                                         |
| --------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `sku`                                                                                   | **Ja** (`requireSku`)            | —                                                                                          |
| `title`                                                                                 | **Ja** (validator 1–255)         | —                                                                                          |
| `status`                                                                                | **Ja** (`for sale` \| `paused`)  | `for sale` i modell om saknas                                                              |
| `quantity`                                                                              | **Ja** (heltal ≥ 0)              | `0`                                                                                        |
| `priceAmount`                                                                           | **Ja** (≥ 0)                     | `0`                                                                                        |
| `vatRate`                                                                               | **Ja** (0–100)                   | `25`                                                                                       |
| `description`                                                                           | Nej                              | `null`                                                                                     |
| `currency`                                                                              | Nej                              | `SEK` om ogiltig kod                                                                       |
| `mpn`                                                                                   | Nej                              | sätts till **samma som `sku`** om tom                                                      |
| `mainImage`                                                                             | Nej                              | `null`                                                                                     |
| `images`                                                                                | Nej                              | `[]` (URL-lista)                                                                           |
| `categories`                                                                            | Nej                              | `[]` (katalog-taggar; **inte** samma som CDON/Fyndiq-kategori-ID)                          |
| `brand`                                                                                 | Nej                              |                                                                                            |
| `brandId` / `supplierId` / `manufacturerId`                                             | Nej                              | lookup-ID:n                                                                                |
| `ean`, `gtin`                                                                           | Nej                              |                                                                                            |
| `knNumber`                                                                              | Nej                              | finns i `normalizeInput`; kan saknas i route-validering men följer med om klienten skickar |
| `purchasePrice`                                                                         | Nej                              |                                                                                            |
| `lagerplats`                                                                            | Nej                              |                                                                                            |
| `condition`                                                                             | Nej                              | `new`                                                                                      |
| `privateName`                                                                           | Nej                              |                                                                                            |
| `groupId`                                                                               | Nej                              | variantgrupp / “parent”-koppling                                                           |
| `volume`, `volumeUnit`                                                                  | Nej                              |                                                                                            |
| `notes`                                                                                 | Nej                              |                                                                                            |
| `color`, `colorText`, `size`, `sizeText`, `pattern`, `material`, `patternText`, `model` | Nej                              |                                                                                            |
| `weight`, `lengthCm`, `widthCm`, `heightCm`, `depthCm`                                  | Nej                              |                                                                                            |
| `channelSpecific`                                                                       | Nej                              | JSON-objekt: `textsExtended`, `textsStandard`, `cdon`, `fyndiq`, `woocommerce`, m.m.       |

\*Utöver express-validator: **`sku` krävs** i `create`/`update` via `requireSku`.

**Lista (mapp):** egen endpoint `PUT /api/products/:id/list` med `listId` – ingår inte i standard POST-body.

---

## 2. `channelSpecific` – översikt

| Nyckel          | Används till                                      | Typiskt innehåll                                                         |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `textsExtended` | CDON, Fyndiq, Woo – titel/beskrivning per marknad | `se` / `dk` / `fi` / `no` → `name`, `description`, ev. `bulletpoints`    |
| `textsStandard` | Vilken marknad som är standard för texter         | t.ex. `se`                                                               |
| `cdon`          | CDON-export                                       | `category`, `shipping_time[]`, m.m.                                      |
| `fyndiq`        | Fyndiq-export                                     | `categories[]`, leveranstider, `properties`, `variational_properties`, … |
| `woocommerce`   | Woo                                               | t.ex. `backorders`                                                       |
| `weightUnit`    | CDON/Fyndiq numeriska properties, Woo vikt        | `g` / `kg`                                                               |

**Pris per kanal/marknad** kommer ofta från **`channel_product_overrides`** (UI eller Sello-lik import), inte enbart `products.price_amount`.

---

## 3. CDON (`mapToCdonArticle`)

Källa: `plugins/cdon-products/mapToCdonArticle.js`.

| Källa                                                                                        | Obligatoriskt för att payload inte ska bli `null` | Kommentar                                                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `product.id` (som artikel-SKU mot API)                                                       | **Ja**                                            | Sträng 1–64 tecken; i koden = **Homebase produkt-id**    |
| `title` + ev. `channelSpecific.textsExtended`                                                | **Ja**                                            | Titlar ≥ 5 tecken per språk som exporteras               |
| `description` + ev. `textsExtended`                                                          | **Ja**                                            | Beskrivning ≥ 10 tecken                                  |
| `mainImage`                                                                                  | **Ja**                                            | Giltig `http(s)`-URL                                     |
| `quantity`                                                                                   | **Ja**                                            | ≥ 0                                                      |
| Aktiva marknader i overrides                                                                 | **Ja**                                            | Minst en av `se` / `dk` / `fi` / `no` med `active: true` |
| Pris per aktiv marknad                                                                       | **Ja**                                            | `> 0` (override eller `priceAmount`)                     |
| `channelSpecific.cdon.category`                                                              | **Ja**                                            | Utan kategori → ingen artikel                            |
| `channelSpecific.cdon.shipping_time`                                                         | Nej                                               | Default min/max per marknad (1–10 dagar i mapper)        |
| `brand`, `gtin`, `mpn`, `images`, `groupId` / `parentProductId`, bulletpoints, övrigt `cdon` | Nej                                               |                                                          |

---

## 4. Fyndiq (`mapToFyndiqArticle`)

Källa: `plugins/fyndiq-products/mapToFyndiqArticle.js`.

| Källa                                                                                      | Obligatoriskt | Kommentar                              |
| ------------------------------------------------------------------------------------------ | ------------- | -------------------------------------- |
| `product.id` som SKU                                                                       | **Ja**        | 1–64 tecken                            |
| Titel / `textsExtended`                                                                    | **Ja**        | Samma typ av språk-/längdkrav som CDON |
| Beskrivning                                                                                | **Ja**        | ≥ 10 tecken                            |
| `mainImage`                                                                                | **Ja**        | Giltig URL                             |
| `quantity`                                                                                 | **Ja**        |                                        |
| Aktiva marknader i overrides                                                               | **Ja**        |                                        |
| Pris per marknad `> 0`                                                                     | **Ja**        |                                        |
| `channelSpecific.fyndiq.categories`                                                        | **Ja**        | Minst ett kategori-ID; annars `null`   |
| `shipping_time`                                                                            | Nej           | Default (1–21 i mapper)                |
| `originalPrice` i override                                                                 | Nej           |                                        |
| `brand`, `gtin`, `knNumber`, bilder, `properties`, `pattern`, variationer, `delivery_type` | Nej           |                                        |

---

## 5. WooCommerce (`validateWooExportTextsForWoo` + `mapProductToWoo`)

Källa: `plugins/woocommerce-products/controller.js`.

| Källa                                             | Obligatoriskt för godkänd export | Kommentar                                                                                                                                   |
| ------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `channelSpecific.textsExtended[textMarket]`       | **Ja**                           | `name` och `description` för instansens **textMarket** (`se` \| `dk` \| `fi` \| `no`) – ingen fallback till `products.title` i valideringen |
| `mainImage` / `images`                            | Nej i validator                  | Rekommenderas; mappas om giltiga URL:er                                                                                                     |
| `priceAmount` / override                          | Nej i validator                  | `regular_price` om satt                                                                                                                     |
| `quantity`                                        | Nej                              | `stock_quantity` + `manage_stock`                                                                                                           |
| Attribut (brand, färg, storlek, modell, material) | Nej                              | Från produktfält                                                                                                                            |
| EAN/GTIN/MPN                                      | Nej                              | `meta_data`                                                                                                                                 |
| SEO i texter (`titleSeo`, `metaDesc`, …)          | Nej                              |                                                                                                                                             |
| `channelSpecific.woocommerce.backorders`          | Nej                              | default `no`                                                                                                                                |
| Vikt/mått                                         | Nej                              |                                                                                                                                             |

**Kategorier på Woo:** kommer som `overrideCategories` in i exportflödet, inte enbart från `products.categories`.

---

## 6. Skillnad: “komplett create i Homebase” vs “komplett kanalexport”

| Nivå              | Vad som krävs                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Homebase**      | `sku`, `title`, `status`, `quantity`, `priceAmount`, `vatRate` (+ validering); övrigt valfritt med defaults.                                               |
| **CDON / Fyndiq** | Utöver det: **huvudbild**, **aktiva marknader med pris**, **texter** (längd enligt mapper), plus **kategori** (`cdon.category` resp. `fyndiq.categories`). |
| **Woo**           | **Fullständiga texter** i `textsExtended` för rätt marknad – annars fel från `validateWooExportTextsForWoo`.                                               |

En import som bara fyller katalogfält ger alltså **inte** automatiskt en komplett kanal-create; fält måste mappas till `channelSpecific`, overrides och kanal-kategorier om export ska lyckas.

---

## Relaterat

- Produktimport (CSV/XLSX) skriver idag primärt katalog + (vid Sello-rader) `channel_product_overrides`; **kanalexport som batch-synk** är separat – se diskussion i kodbasen kring `importRowsCore`, `batchSyncJobRunner`, `upsertChannelOverride`.
