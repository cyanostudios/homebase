# Sello → Homebase → Channel Field Mapping

Schema- och fältmappningsdokument för Sello-import, Homebase-lagring och export till CDON, Fyndiq och WooCommerce.

**Schema verifierat mot Neon** (tenant_1) 2026-03-14.

---

## 1. Sello API – fält som hämtas

Sello-produkter hämtas via `GET /v5/products` eller `GET /v5/products/{id}`. Följande fält används vid import:

### 1.1 Fasta fält (root)

| Sello-fält          | Typ    | Används vid import                                              |
| ------------------- | ------ | --------------------------------------------------------------- |
| `id`                | number | ✅ Produkt-ID (Homebase `id`)                                   |
| `folder_id`         | string | ✅ Lista (via `listsModel.findOrCreateListForSelloFolder`)      |
| `folder_name`       | string | ✅ Listnamn                                                     |
| `brand_id`          | string | ✅ Märke (via `lookupsModel.findOrCreateBrandForSello`)         |
| `brand_name`        | string | ✅ Märke (fallback)                                             |
| `condition`         | string | ✅ `new` / `used` → `products.condition`                        |
| `tax`               | number | ✅ Moms → `products.vat_rate`                                   |
| `group_id`          | number | ✅ Produktgrupp → `products.group_id`                           |
| `private_name`      | string | ✅ Intern namn → `products.private_name`                        |
| `private_reference` | string | ✅ Egen referens → `products.sku`, `products.mpn` (vid tom MPN) |
| `quantity`          | number | ✅ Lagerantal → `products.quantity`                             |
| `stock_location`    | string | ✅ Lagerplats → `products.lagerplats`                           |
| `volume`            | number | ✅ Volym → `products.volume`                                    |
| `volume_unit`       | string | ✅ Volymenhet → `products.volume_unit`                          |
| `weight`            | number | ✅ Vikt (gram) → `products.weight`                              |
| `purchase_price`    | number | ✅ Inköpspris → `products.purchase_price`                       |
| `notes`             | string | ✅ Anteckningar → `products.notes`                              |
| `created_at`        | string | ✅ Skapad → `products.source_created_at`                        |
| `sold`              | number | ✅ Sålda → `products.quantity_sold`                             |
| `last_sold`         | string | ✅ Senast såld → `products.last_sold_at`                        |
| `manufacturer`      | object | ✅ Tillverkare (id, name)                                       |
| `manufacturer_id`   | string | ✅ Tillverkare-ID                                               |
| `manufacturer_name` | string | ✅ Tillverkare-namn                                             |

### 1.2 Texts (per språk)

| Sello-sökväg                            | Beskrivning              | Används vid import                                      |
| --------------------------------------- | ------------------------ | ------------------------------------------------------- |
| `texts.default.sv.name`                 | Produktnamn (sv)         | ✅ `title` (primär)                                     |
| `texts.default.sv.description`          | Beskrivning (sv)         | ✅ `description` (primär)                               |
| `texts.default.{lang}.name`             | Produktnamn (alla språk) | ✅ `channelSpecific.textsExtended.{market}.name`        |
| `texts.default.{lang}.description`      | Beskrivning (alla språk) | ✅ `channelSpecific.textsExtended.{market}.description` |
| `texts.default.{lang}.title`            | SEO-titel                | ✅ `channelSpecific.textsExtended`                      |
| `texts.default.{lang}.meta_description` | Meta-beskrivning         | ✅ `channelSpecific.textsExtended`                      |
| `texts.default.{lang}.meta_keywords`    | Meta-nyckelord           | ✅ `channelSpecific.textsExtended`                      |
| `texts.default.{lang}.bulletpoints`     | Bulletpunkter            | ✅ `channelSpecific.textsExtended`                      |

### 1.3 Properties (dynamiska)

| Property ID            | Sello        | Beskrivning     | Används vid import                                       |
| ---------------------- | ------------ | --------------- | -------------------------------------------------------- |
| EAN                    | `properties` | Streckkod       | ✅ `products.ean`                                        |
| GTIN                   | `properties` | Streckkod       | ✅ `products.gtin`                                       |
| Color / Färg           | `properties` | Färg            | ✅ `products.color` (preset) eller `products.color_text` |
| Size / Storlek         | `properties` | Storlek         | ✅ `products.size` (preset) eller `products.size_text`   |
| Material               | `properties` | Material        | ✅ `products.material`                                   |
| ColorPattern / Pattern | `properties` | Mönster         | ✅ `products.pattern`                                    |
| Mönster / Pattern      | `properties` | Mönster fritext | ✅ `products.pattern_text`                               |
| Model / Modell         | `properties` | Modell          | ✅ `products.model`                                      |

### 1.4 Övriga objekt

| Objekt           | Beskrivning                                     | Används vid import                                                                                                                                             |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `images`         | Array med bilder (url_large, url_small)         | ✅ Laddas ner till `user_files`, sparas som `main_image` + `images`                                                                                            |
| `categories`     | Kategorier per integration                      | ✅ `products.categories` (alla samman) + `channel_product_overrides.category`                                                                                  |
| `integrations`   | `active`, `item_id` per integration             | ✅ `channel_product_overrides.active`                                                                                                                          |
| `prices`         | Pris per integration (store, regular, campaign) | ✅ `store` → `channel_product_overrides.price_amount`; `regular` → `original_price` (Fyndiq); `campaign` → `sale_price` (WooCommerce). `currency` → overrides. |
| `delivery_times` | Leveranstid per marknad                         | ✅ `channelSpecific.cdon.shipping_time`, `channelSpecific.fyndiq.shipping_time`                                                                                |

### 1.5 Sello-fält som inte importeras

| Sello-fält               | Beskrivning                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `properties` (raw)       | Alla properties sparas inte som JSON. Endast EAN, GTIN, Color, Size, Material, Pattern, Model extraheras. |
| `unique_selling_points`  | Sello har inte. CDON: byggs från textsExtended.bulletpoints (fylls i efter import).                       |
| `specifications`         | –                                                                                                         |
| `classifications`        | –                                                                                                         |
| `delivery_type`          | –                                                                                                         |
| `kn_number`              | Sello har inte. Fylls i i Homebase (flik Detaljer), sparas i products.kn_number.                          |
| `shipped_from`           | –                                                                                                         |
| `manufacturer` (objekt)  | Endast namn/id importeras. Full struktur (address, website, etc.) sparas inte.                            |
| `variational_properties` | Sello har inte detta fält. Härleds från `groups.type` (color/size/model) vid import.                      |
| `texts` per integration  | Endast `default` används. Per-integration texts används inte.                                             |
| `shipping`               | Fraktkostnad per integration                                                                              |
| `auctions`               | Auktioner per integration                                                                                 |
| `updated_at`             | –                                                                                                         |
| `unsold`                 | –                                                                                                         |

---

## 2. Kanal-payload – required/optional

### 2.1 CDON (v2/articles/bulk)

| Fält                     | Required | Typ                                                            | Beskrivning                                                    |
| ------------------------ | -------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| `sku`                    | ✅       | string (1–64)                                                  | Unikt ID                                                       |
| `status`                 | ✅       | "for sale"                                                     | "paused"                                                       | –                              |
| `quantity`               | ✅       | int ≥ 0                                                        | Lagerantal                                                     |
| `main_image`             | ✅       | URL (1–1500)                                                   | Huvudbild                                                      |
| `markets`                | ✅       | ["SE","DK","FI","NO"]                                          | –                                                              |
| `title`                  | ✅       | [{language, value}] (5–150)                                    | Per språk                                                      |
| `description`            | ✅       | [{language, value}] (10–4096)                                  | Per språk                                                      |
| `price`                  | ✅       | [{market, value: {amount_including_vat, currency, vat_rate?}}] | Per marknad                                                    |
| `shipping_time`          | ✅       | [{market, min, max}] (1–10)                                    | Per marknad                                                    |
| `category`               | ✅       | string                                                         | En kategori per aktiv marknad                                  |
| `parent_sku`             | –        | string (1–64)                                                  | Grupp-ID                                                       |
| `brand`                  | –        | string (1–50)                                                  | –                                                              |
| `gtin`                   | –        | string (1–13)                                                  | –                                                              |
| `mpn`                    | –        | string                                                         | –                                                              |
| `images`                 | –        | string[] (max 10 URLs)                                         | –                                                              |
| `internal_note`          | –        | string                                                         | Egen referens → `products.sku`                                 |
| `unique_selling_points`  | –        | [{language, value}]                                            | Byggs från textsExtended.bulletpoints                          |
| `specifications`         | –        | –                                                              | Byggs från products.mpn (Identifikation) + cdon.specifications |
| `classifications`        | –        | [{name, value}]                                                | Byggs från products.condition.                                 |
| `delivery_type`          | –        | [{market, value}]                                              | mailbox, service_point, home_delivery                          |
| `kn_number`              | –        | string (1–48)                                                  | Från `products.kn_number`                                      |
| `shipped_from`           | –        | "EU"                                                           | "NON_EU"                                                       | UI: flik Detaljer. Default EU. |
| `manufacturer`           | –        | object { name }                                                | Från `products.manufacturerName` (manufacturer_id)             |
| `availability_dates`     | –        | [{market, value}]                                              | Per marknad. UI: flik Detaljer.                                |
| `properties`             | –        | –                                                              | –                                                              |
| `variational_properties` | –        | –                                                              | –                                                              |

### 2.2 Fyndiq (v1/articles)

| Fält                     | Required | Typ                                   | Beskrivning                    |
| ------------------------ | -------- | ------------------------------------- | ------------------------------ | --- |
| `sku`                    | ✅       | string (1–64)                         | –                              |
| `status`                 | ✅       | "for sale"                            | "paused"                       | –   |
| `quantity`               | ✅       | int ≥ 0                               | –                              |
| `main_image`             | ✅       | URL (1–1500)                          | –                              |
| `markets`                | ✅       | ["SE","DK","FI","NO"]                 | –                              |
| `title`                  | ✅       | [{language, value}] (5–150)           | –                              |
| `description`            | ✅       | [{language, value}] (10–4096)         | –                              |
| `price`                  | ✅       | [{market, value: {amount, currency}}] | Per marknad                    |
| `shipping_time`          | ✅       | [{market, min, max}] (1–21)           | Per marknad                    |
| `categories`             | ✅       | string[]                              | Max 5                          |
| `parent_sku`             | –        | string (1–64)                         | –                              |
| `legacy_product_id`      | –        | int                                   | –                              |
| `brand`                  | –        | string (1–50)                         | –                              |
| `gtin`                   | –        | string (1–13)                         | –                              |
| `images`                 | –        | string[] (max 10 URLs)                | –                              |
| `internal_note`          | –        | string                                | Egen referens → `products.sku` |
| `delivery_type`          | –        | [{market, value}]                     | mailbox, service_point         |
| `kn_number`              | –        | string (1–48)                         | Från `products.kn_number`      |
| `properties`             | –        | –                                     | –                              |
| `variational_properties` | –        | –                                     | –                              |

### 2.3 WooCommerce (REST API)

| Fält             | Required | Typ               | Beskrivning       |
| ---------------- | -------- | ----------------- | ----------------- | ------- | --- |
| `sku`            | –        | string            | –                 |
| `name`           | –        | string            | Titel             |
| `status`         | –        | publish           | draft             | private | –   |
| `regular_price`  | –        | string            | Pris (inkl. moms) |
| `manage_stock`   | –        | bool              | true              |
| `stock_quantity` | –        | number            | Lagerantal        |
| `description`    | –        | string            | –                 |
| `categories`     | –        | [{id}]            | –                 |
| `images`         | –        | [{src}]           | –                 |
| `attributes`     | –        | [{name, options}] | t.ex. brand       |
| `meta_data`      | –        | [{key, value}]    | ean, gtin         |

---

## 3. Homebase-schema (Neon)

### products (tenant_N)

`id`, `user_id`, `sku`, `title`, `description`, `status`, `quantity`, `price_amount`, `currency`, `vat_rate`, `main_image`, `images`, `categories`, `brand`, `brand_id`, `gtin`, `kn_number`, `mpn`, `ean`, `supplier_id`, `manufacturer_id`, `channel_specific`, `purchase_price`, `lagerplats`, `color`, `color_text`, `size`, `size_text`, `pattern`, `pattern_text`, `material`, `weight`, `length_cm`, `width_cm`, `height_cm`, `depth_cm`, `condition`, `group_id`, `volume`, `volume_unit`, `notes`, `private_name`, `source_created_at`, `quantity_sold`, `last_sold_at`, `parent_product_id`, `group_variation_type`, `model`, `created_at`, `updated_at`

(Reapris/sale_price ligger i `channel_product_overrides`; merchant_sku togs bort i migration 075.)

### channel_product_overrides (tenant_N)

`id`, `user_id`, `product_id`, `channel`, `instance`, `channel_instance_id`, `active`, `price_amount`, `currency`, `vat_rate`, `category`, `sale_price`, `original_price`, `created_at`, `updated_at`

---

## 4. Sello → Homebase

| Sello-källa                       | Homebase-kolumn / tabell                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                              | `products.id`                                                                                                                                  |
| `private_reference`               | `products.sku`, `products.mpn` (vid tom MPN)                                                                                                   |
| `private_name`                    | `products.private_name`                                                                                                                        |
| `texts.default.sv.name`           | `products.title`                                                                                                                               |
| `texts.default.sv.description`    | `products.description`                                                                                                                         |
| `quantity`                        | `products.quantity`                                                                                                                            |
| `tax`                             | `products.vat_rate`                                                                                                                            |
| `images` (nedladdade)             | `products.main_image`, `products.images`                                                                                                       |
| `categories` (alla)               | `products.categories`                                                                                                                          |
| `integrations` + `categories`     | `channel_product_overrides` (active, category)                                                                                                 |
| `prices`                          | `channel_product_overrides`: store → price_amount; regular → original_price (Fyndiq); campaign → sale_price (WooCommerce); currency, vat_rate. |
| `properties.EAN`                  | `products.ean`                                                                                                                                 |
| `properties.GTIN`                 | `products.gtin`                                                                                                                                |
| `brand_id` + `brand_name`         | `products.brand`, `products.brand_id`                                                                                                          |
| `manufacturer`                    | `products.manufacturer_id`                                                                                                                     |
| `purchase_price`                  | `products.purchase_price`                                                                                                                      |
| `properties.Color` (preset)       | `products.color`                                                                                                                               |
| `properties.Color` (fritext)      | `products.color_text`                                                                                                                          |
| `properties.Size` (preset)        | `products.size`                                                                                                                                |
| `properties.Size` (fritext)       | `products.size_text`                                                                                                                           |
| `properties.Material`             | `products.material`                                                                                                                            |
| `properties.ColorPattern`         | `products.pattern`                                                                                                                             |
| `properties.Mönster`              | `products.pattern_text`                                                                                                                        |
| `properties.Model`                | `products.model`                                                                                                                               |
| `stock_location`                  | `products.lagerplats`                                                                                                                          |
| `condition`                       | `products.condition`                                                                                                                           |
| `group_id`                        | `products.group_id`                                                                                                                            |
| `groups.type` (color/size/model)  | `products.group_variation_type`, `channel_specific.cdon.variational_properties`, `channel_specific.fyndiq.variational_properties`              |
| `volume`                          | `products.volume`                                                                                                                              |
| `volume_unit`                     | `products.volume_unit`                                                                                                                         |
| `weight`                          | `products.weight`                                                                                                                              |
| `notes`                           | `products.notes`                                                                                                                               |
| `created_at`                      | `products.source_created_at` (visas i ProductForm, flik Statistik, endast läs)                                                                 |
| `sold`                            | `products.quantity_sold` (visas i ProductForm, flik Statistik, endast läs)                                                                     |
| `last_sold`                       | `products.last_sold_at` (visas i ProductForm, flik Statistik, endast läs)                                                                      |
| `delivery_times`                  | `channel_specific.cdon.shipping_time`, `channel_specific.fyndiq.shipping_time`                                                                 |
| `integrations` + `categories`     | `channel_specific.cdon.markets`, `channel_specific.fyndiq.markets`                                                                             |
| `texts.default.{lang}.title` etc. | `channel_specific.textsExtended`                                                                                                               |

**Standardtext (textsStandard):** Vid import används språkprioritet (sv → fi → da → nb → no → en) för att välja standardtext. Användaren kan i ProductForm (Texter-fliken) välja vilken marknad som ska vara standard via radioknapp. Sparas i `channel_specific.textsStandard` (se, dk, fi, no).

---

## 5. Homebase → Kanal

### 5.1 Titel och beskrivning (CDON/Fyndiq)

- **Källa:** Titeln och beskrivningen till CDON/Fyndiq byggs från `**channelSpecific.textsExtended`** (per marknad) med `**channelSpecific.textsStandard\*\*` som fallback inom textsExtended (om en marknad saknar egen text används standardmarknadens text).
- **Fallback på produktnivå:** Endast när textsExtended (+ textsStandard) inte ger tillräcklig titel eller beskrivning för de valda marknaderna används `**products.title`** respektive `**products.description\*\*`.
- **UI:** Det finns inga kanalspecifika fält för titel/beskrivning (t.ex. `cdon.title`, `fyndiq.title`) i gränssnittet; användaren redigerar endast textsExtended per land/språk och products.title/description.

### 5.2 Homebase → CDON

| Homebase-källa                                    | CDON-payload                                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `products.id`                                     | `sku`                                                                                               |
| `channelSpecific.textsExtended` + `textsStandard` | `title`, `description` (se 5.1)                                                                     |
| `products.title`                                  | Endast när textsExtended (+ textsStandard) saknar titel för marknaderna                             |
| `products.description`                            | Endast när textsExtended (+ textsStandard) saknar beskrivning                                       |
| `products.mainImage`                              | `main_image`                                                                                        |
| `products.images`                                 | `images`                                                                                            |
| `products.quantity`                               | `quantity`                                                                                          |
| `products.status`                                 | `status`                                                                                            |
| `products.parentProductId`                        | `parent_sku`                                                                                        |
| `products.brand`                                  | `brand`                                                                                             |
| `products.gtin`                                   | `gtin`                                                                                              |
| `products.mpn`                                    | `mpn`                                                                                               |
| `channel_product_overrides` (active=true)         | `price`, `category`                                                                                 |
| `channelSpecific.cdon.shipping_time`              | `shipping_time`                                                                                     |
| `channelSpecific.textsExtended.bulletpoints`      | `unique_selling_points`                                                                             |
| `products.sku`                                    | `internal_note` (Egen referens)                                                                     |
| `products.kn_number`                              | `kn_number`                                                                                         |
| `products.mpn`                                    | `mpn`; används också för `specifications` (Identifikation → Tillverkarens artikelnummer, per språk) |
| `channelSpecific.cdon.specifications`             | `specifications` (slås ihop med MPN-sektion ovan)                                                   |
| `products.condition`                              | `classifications` (new→NEW, used→USED, refurb→REFURB)                                               |
| `channelSpecific.cdon.delivery_type`              | `delivery_type`                                                                                     |
| `channelSpecific.cdon.shipped_from`               | `shipped_from`                                                                                      |
| `channelSpecific.cdon.availability_dates`         | `availability_dates`                                                                                |
| `products.manufacturerName` (via manufacturer_id) | `manufacturer` (objekt { name })                                                                    |
| `channelSpecific.cdon.properties`                 | `properties`                                                                                        |
| `channelSpecific.cdon.variational_properties`     | `variational_properties`                                                                            |

**Variantprodukter (parent_product_id):** Om `channelSpecific.cdon.properties` saknas byggs `properties` från `products.color`/`colorText`, `size`/`sizeText` eller `model` beroende på `groupVariationType`. `variational_properties` tas från `channelSpecific.cdon.variational_properties` eller härleds från `groupVariationType`.

### 5.3 Homebase → Fyndiq

| Homebase-källa                                    | Fyndiq-payload                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `products.id`                                     | `sku`                                                                   |
| `channelSpecific.textsExtended` + `textsStandard` | `title`, `description` (se 5.1)                                         |
| `products.title`                                  | Endast när textsExtended (+ textsStandard) saknar titel för marknaderna |
| `products.description`                            | Endast när textsExtended (+ textsStandard) saknar beskrivning           |
| `products.mainImage`                              | `main_image`                                                            |
| `products.images`                                 | `images`                                                                |
| `products.quantity`                               | `quantity`                                                              |
| `products.status`                                 | `status`                                                                |
| `products.parentProductId`                        | `parent_sku`                                                            |
| `products.brand`                                  | `brand`                                                                 |
| `products.gtin`                                   | `gtin`                                                                  |
| `channel_product_overrides` (active=true)         | `price`, `categories`                                                   |
| `channelSpecific.fyndiq.shipping_time`            | `shipping_time`                                                         |
| `products.sku`                                    | `internal_note` (Egen referens)                                         |
| `products.kn_number`                              | `kn_number`                                                             |
| `channelSpecific.fyndiq.legacy_product_id`        | `legacy_product_id`                                                     |
| `channelSpecific.fyndiq.delivery_type`            | `delivery_type`                                                         |
| `channelSpecific.fyndiq.properties`               | `properties`                                                            |
| `channelSpecific.fyndiq.variational_properties`   | `variational_properties`                                                |

**Variantprodukter (parent_product_id):** Samma logik som CDON – properties och variational_properties byggs från product-fält respektive groupVariationType om channelSpecific saknas.

### 5.4 Homebase → WooCommerce

**Gruppering:** Produkter med `group_id` och `group_variation_type` (color/size/model) exporteras som **variable product** (SKU = group_id) och **variations** (SKU = V+product.id). Lookup görs via GET `?sku=…` (ingen sparad Woo-ID). Fristående produkter exporteras som enkla produkter (SKU = product.id).

| Homebase-källa                              | WooCommerce-payload                                           |
| ------------------------------------------- | ------------------------------------------------------------- |
| Grupperad: `products.group_id`              | Variable product: `sku` = group_id                            |
| Grupperad: produkter i grupp                | Variations: `sku` = V+product.id; attribut (color/size/model) |
| Fristående: `products.id`                   | Enkel produkt: `sku` = product.id                             |
| `products.title`                            | `name`                                                        |
| `products.description`                      | `description`                                                 |
| `textsExtended` (standard marknad).metaDesc | `short_description` (eller trunkerad description)             |
| `products.mainImage`                        | `images[0].src`                                               |
| `products.images`                           | `images[1..].src`                                             |
| `products.quantity`                         | `stock_quantity`                                              |
| `products.status`                           | `status` (mappad)                                             |
| `products.priceAmount` / override           | `regular_price`; override → `sale_price`                      |
| `products.brand`                            | `attributes` (brand)                                          |
| `products.color` / `products.colorText`     | `attributes` (color)                                          |
| `products.size` / `products.sizeText`       | `attributes` (size)                                           |
| `products.model`                            | `attributes` (model; för varianter)                           |
| `products.material`                         | `attributes` (material)                                       |
| `products.ean`                              | `meta_data` (ean)                                             |
| `products.gtin`                             | `meta_data` (gtin)                                            |
| `products.mpn`                              | `meta_data` (mpn)                                             |
| `textsExtended` (standard).titleSeo         | `meta_data` (seo_title)                                       |
| `textsExtended` (standard).metaDesc         | `meta_data` (seo_meta_desc)                                   |
| `textsExtended` (standard).metaKeywords     | `meta_data` (seo_meta_keywords)                               |
| `products.weight` (gram)                    | `weight` (konverterat till kg)                                |
| `products.lengthCm`, `widthCm`, `heightCm`  | `dimensions` (length, width, height)                          |
| `channel_product_overrides` (active)        | `categories`                                                  |

---

## 6. Luckor (gaps)

### 6.1 Sello-fält som inte importeras till Homebase

| Sello-fält                   | Beskrivning                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `unique_selling_points`      | Sello har inte. Bulletpoints fylls i i Homebase efter import, exportas till CDON. |
| `specifications`             | –                                                                                 |
| `classifications`            | –                                                                                 |
| `delivery_type`              | –                                                                                 |
| `kn_number`                  | –                                                                                 |
| `shipped_from`               | –                                                                                 |
| `manufacturer` (full objekt) | Endast namn/id importeras                                                         |
| `properties` (raw)           | Endast utvalda properties (EAN, GTIN, Color, Size, Material, Pattern, Model)      |
| `variational_properties`     | Härleds från `groups.type` vid import (Sello har inte detta fält)                 |
| `texts` per integration      | Endast `default` används. Per-integration texts används inte.                     |
| `shipping`                   | Fraktkostnad per integration                                                      |
| `auctions`                   | –                                                                                 |
| `updated_at`                 | –                                                                                 |
| `unsold`                     | –                                                                                 |

### 6.2 Kanal-fält som inte fylls från Homebase

| Kanal       | Fält                                               | Status                                                                                                                                                                          |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CDON        | `unique_selling_points`                            | Byggs från textsExtended.bulletpoints. Fylls i efter Sello-import.                                                                                                              |
| CDON        | `specifications`                                   | Byggs från `products.mpn` (Identifikation → Tillverkarens artikelnummer, per språk). Slås ihop med `channelSpecific.cdon.specifications` om befintliga.                         |
| CDON        | `classifications`                                  | Byggs från `products.condition` (new→NEW, used→USED, refurb→REFURB). UI: flik Detaljer (Skick).                                                                                 |
| CDON        | `delivery_type`                                    | Kräver `channelSpecific.cdon.delivery_type` – ej importerat                                                                                                                     |
| CDON        | `kn_number`                                        | Från `products.kn_number` (flik Detaljer)                                                                                                                                       |
| CDON        | `internal_note`                                    | Från `products.sku` (Egen referens)                                                                                                                                             |
| CDON        | `shipped_from`                                     | Från `channelSpecific.cdon.shipped_from`. UI: flik Detaljer (Skickas från). Default EU.                                                                                         |
| CDON        | `availability_dates`                               | Från `channelSpecific.cdon.availability_dates`. UI: flik Detaljer (per marknad).                                                                                                |
| CDON        | `manufacturer`                                     | Från `products.manufacturerName` (manufacturer_id). Skickas som objekt { name }. Ej channelSpecific.cdon.manufacturer.                                                          |
| CDON        | `properties`                                       | Kräver `channelSpecific.cdon.properties` – ej importerat                                                                                                                        |
| CDON        | `variational_properties`                           | Importeras från `groups.type` → `channelSpecific.cdon.variational_properties`                                                                                                   |
| Fyndiq      | `delivery_type`                                    | Kräver `channelSpecific.fyndiq.delivery_type` – ej importerat                                                                                                                   |
| Fyndiq      | `kn_number`                                        | Från `products.kn_number` (flik Detaljer)                                                                                                                                       |
| Fyndiq      | `internal_note`                                    | Från `products.sku` (Egen referens)                                                                                                                                             |
| Fyndiq      | `properties`                                       | Kräver `channelSpecific.fyndiq.properties` – ej importerat                                                                                                                      |
| Fyndiq      | `variational_properties`                           | Importeras från `groups.type` → `channelSpecific.fyndiq.variational_properties`                                                                                                 |
| WooCommerce | `meta_data` (ean, gtin, mpn, SEO)                  | Används: ean, gtin, mpn, seo_title, seo_meta_desc, seo_meta_keywords från textsExtended (standard marknad). Plugin-agnostiska nycklar så att t.ex. Yoast eller andra kan mappa. |
| Alla        | `textsExtended` (titleSeo, metaDesc, metaKeywords) | Sparas i Homebase. **CDON/Fyndiq:** API har inga sådana fält. **WooCommerce:** exporteras till meta_data (Yoast-nycklar). bulletpoints används i CDON.                          |

### 6.3 Import-status och Sello properties API

**Redan importerat:** bas, lager, vikt, volym, köpspris, anteckningar, färg (color + color_text), storlek (size + size_text), material, pattern, pattern_text, manufacturer_id, private_name, EAN/GTIN, texter/SEO, kanalpriser i channelSpecific, aktiva kanaler per integration.

**Aktiva kanaler:** `integrations.{integrationId}.active` → `channel_product_overrides.active`. Kräver att `channel_instances` har `sello_integration_id` satt. Kör "Bygg kanalkarta från Sello" eller mappa integrations-ID i kanalinställningarna.

**Saknas i Sello:** längd/bredd/höjd/djup, supplier – fylls i i Homebase UI vid behov.

**Sello properties API:** `GET /v5/products/properties` (paginerat). `POST /v5/products/properties/required` med `{"categories": {"integrationId": ["categoryId"]}}` → vilka properties som krävs/rekommenderas per kategori.

---

## 7. Referenser

- **Schema:** Verifierat mot Neon (projectId `wandering-snow-54010771`, tenant_1) via MCP run_sql
- **Sello API:** `docs/API-DOCS/SELLO-API.md`
- **CDON API:** `docs/API-DOCS/CDON-API-JSON.json`
- **Fyndiq API:** `docs/API-DOCS/FYNDIQ-API-JSON.json`
- **Sello-import:** `plugins/products/controller.js` (`importFromSelloApi`)
- **CDON-mappare:** `plugins/cdon-products/mapToCdonArticle.js`
- **Fyndiq-mappare:** `plugins/fyndiq-products/mapToFyndiqArticle.js`
- **WooCommerce-mappare:** `plugins/woocommerce-products/controller.js` (`mapProductToWoo`)

---

## 8. Komplett översiktstabell (alla egenskaper och parametrar)

En rad per logisk egenskap/parameter. Kolumnerna anger: vad som hämtas från Sello, var det sätts i Homebase, vad som skickas till respektive kanal (CDON, Fyndiq, WooCommerce) och vilken databaskolumn (Neon tenant_1) som används. Tomt = "—".

| Egenskap / parameter | Sello (vad vi hämtar) | Homebase (var vi sätter) | CDON (payload) | Fyndiq (payload) | WooCommerce (payload) | Databas (Neon tenant_1) |
| --- | --- | --- | --- | --- | --- | --- |
| Produkt-ID / kanal-SKU | `id` (Sello produkt-ID) | `products.id` (vid Sello-import sätts id = Sello id; används som primärnyckel) | `sku` (från product.id) | `sku` (från product.id) | `sku` (från product.id) | `products.id` |
| Egen referens (användarens SKU) | `private_reference` | Vid import: `products.sku`, `products.mpn` (båda sätts från private_reference). Redigerbart SKU i UI sparas i products.sku/mpn enligt modell. | `internal_note` (från products.sku) | `internal_note` (från products.sku) | — | `products.sku`, `products.mpn` |
| Intern namn / privat namn | `private_name` eller `product.private_name` | `products.private_name` | — | — | — | `products.private_name` |
| Titel (standard svenska) | `texts.default.sv.name` | `products.title` | `title` (fallback när textsExtended/textsStandard saknar titel för marknaderna) | `title` (samma fallback) | `name` (från products.title) | `products.title` |
| Beskrivning (standard svenska) | `texts.default.sv.description` | `products.description` | `description` (fallback när textsExtended saknar beskrivning) | `description` (samma) | `description` | `products.description` |
| Texter utökade: namn (per marknad/språk) | `texts.default.{lang}.name` (sv, da, fi, no, en) | `channel_specific.textsExtended.{market}.name` (market = se, dk, fi, no) | `title` (språkarray byggd från textsExtended + textsStandard) | `title` (samma) | — | channel_specific (JSON) |
| Texter utökade: beskrivning (per marknad) | `texts.default.{lang}.description` | `channel_specific.textsExtended.{market}.description` | `description` (språkarray från textsExtended + textsStandard) | `description` (samma) | — | channel_specific (JSON) |
| Texter utökade: SEO-titel | `texts.default.{lang}.title` | `channel_specific.textsExtended.{market}.titleSeo` | — | — | `meta_data` (nyckel `seo_title`) | channel_specific (JSON) |
| Texter utökade: meta-beskrivning | `texts.default.{lang}.meta_description` | `channel_specific.textsExtended.{market}.metaDesc` | — | — | `meta_data` (`seo_meta_desc`), `short_description` (eller trunkerad description) | channel_specific (JSON) |
| Texter utökade: meta-nyckelord | `texts.default.{lang}.meta_keywords` | `channel_specific.textsExtended.{market}.metaKeywords` | — | — | `meta_data` (`seo_meta_keywords`) | channel_specific (JSON) |
| Texter utökade: bulletpunkter | `texts.default.{lang}.bulletpoints` | `channel_specific.textsExtended.{market}.bulletpoints` | `unique_selling_points` (språkarray) | — | — | channel_specific (JSON) |
| Standardmarknad för texter | — | `channel_specific.textsStandard` (se, dk, fi, no; användaren väljer i Texter-fliken) | Används som fallback för title/description när en marknad saknar egen text | Samma som CDON | Används för att välja vilken marknad som ger SEO-fält (seo_title, seo_meta_desc, seo_meta_keywords) till meta_data | channel_specific (JSON) |
| Lagerantal | `quantity` | `products.quantity` | `quantity` | `quantity` | `stock_quantity` | `products.quantity` |
| Status | — (vid import alltid "for sale") | `products.status` | `status` (for sale/paused) | `status` (for sale/paused) | `status` (publish, draft, private/archived) | `products.status` |
| Pris (bas / ordinarie) | `prices[integrationId].store` (per marknad/språk) → sparas i overrides | `products.price_amount`, `channel_product_overrides.price_amount` (per instans) | `price` (array per market: amount_including_vat, currency, vat_rate; från overrides med active=true) | `price` (array per market: amount, currency; från overrides) | `regular_price` (från override priceAmount eller products.priceAmount) | `products.price_amount`, `channel_product_overrides.price_amount` |
| Reapris / kampanjpris | `prices[integrationId].campaign` (per marknad) | `channel_product_overrides.sale_price` (WooCommerce-instanser) | — | — | `sale_price` (från override salePrice om satt) | `channel_product_overrides.sale_price` |
| Ordinarie pris (Fyndiq-original) | `prices[integrationId].regular` (per marknad) | `channel_product_overrides.original_price` (Fyndiq-instanser) | — | `original_price` (array per market: amount, currency) | — | `channel_product_overrides.original_price` |
| Valuta | `prices[integrationId].currency` | `products.currency`, `channel_product_overrides.currency` | `price[].value.currency` (per market) | `price[].value.currency` (per market) | — | `products.currency`, `channel_product_overrides.currency` |
| Moms (vat rate) | `tax` | `products.vat_rate`, `channel_product_overrides.vat_rate` | `price[].value.vat_rate` (valfritt per market) | — | — | `products.vat_rate`, `channel_product_overrides.vat_rate` |
| Huvudbild | `images` (nedladdas till user_files; url_large) | `products.main_image` | `main_image` (URL) | `main_image` (URL) | `images[0].src` | `products.main_image` |
| Övriga bilder | `images` (array) | `products.images` | `images` (array av URL, max 10) | `images` (array, max 10) | `images[1..].src` | `products.images` (jsonb) |
| Kategorier (produktnivå, alla ID:n) | `categories` (alla integrationer: categories[integrationId]; alla unika ID:n samlas) | `products.categories` | — | — | — | `products.categories` (jsonb) |
| Kategori per kanal/marknad (CDON, en per aktiv marknad) | `categories[integrationId]` (första kategorin per integration) | `channel_product_overrides.category` (CDON), `channel_specific.cdon.markets[market].category` (vid import) | `category` (en sträng; kräver exakt en aktiv kategori över alla aktiva marknader) | — | — | `channel_product_overrides.category` |
| Kategorier per kanal (Fyndiq, array max 5) | `categories[integrationId]` | `channel_product_overrides.category` (Fyndiq: JSON-array eller kommaseparerad), `channel_specific.fyndiq.markets[market].categories` | — | `categories` (array av kategoristrängar) | — | `channel_product_overrides.category` |
| Kategorier per kanal (WooCommerce) | `categories[integrationId]` | `channel_product_overrides.category` (WooCommerce: JSON-array av Woo-kategori-ID) | — | — | `categories` (array av { id }) | `channel_product_overrides.category` |
| Aktiv per kanalinstans | `integrations[integrationId].active` | `channel_product_overrides.active`, `channel_specific.cdon.markets[market].active`, `channel_specific.fyndiq.markets[market].active` | Används för att välja vilka overrides som ska ge price och category till payload | Samma | Används för att välja override (price, categories) | `channel_product_overrides.active` |
| Leveranstid (CDON) | `delivery_times` (SE, DK, FI, NO: min, max; clamp 1–10) | `channel_specific.cdon.shipping_time` (array { market, min, max }) | `shipping_time` (array per market, min/max 1–10) | — | — | channel_specific (JSON) |
| Leveranstid (Fyndiq) | `delivery_times` (samma; clamp 1–21) | `channel_specific.fyndiq.shipping_time` | — | `shipping_time` (array per market, min/max 1–21) | — | channel_specific (JSON) |
| EAN | `properties` (property med namn "EAN"; value.default eller value.sv) | `products.ean` | — | — | `meta_data` (nyckel `ean`) | `products.ean` |
| GTIN | `properties` (property "GTIN") | `products.gtin` | `gtin` | `gtin` | `meta_data` (nyckel `gtin`) | `products.gtin` |
| Märke | `brand_id`, `brand_name` | `products.brand`, `products.brand_id` (via lookupsModel.findOrCreateBrandForSello) | `brand` | `brand` | `attributes` (name: brand, options: [brand]) | `products.brand`, `products.brand_id` |
| Tillverkare | `manufacturer`, `manufacturer_id`, `manufacturer_name` (vid behov fetchManufacturer för namn) | `products.manufacturer_id` (lookup findOrCreateManufacturerForSello) | `manufacturer` (objekt { name } från product.manufacturerName) | — | — | `products.manufacturer_id` |
| Inköpspris | `purchase_price` | `products.purchase_price` | — | — | — | `products.purchase_price` |
| Färg (preset, kanallista) | `properties` (Color/Färg; värde matchar CDON/Fyndiq/Woo preset) | `products.color` | Vid variant: `properties` (name: color, value, language) om groupVariationType color; annars channelSpecific.cdon.properties | Samma som CDON (fyndiq.properties) | `attributes` (name: color, options) | `products.color` |
| Färg (fritext) | `properties` (Color, Färg, ColorText, Färgtext) | `products.color_text` (när color preset saknas) | Samma som färg preset vid variant | Samma | `attributes` (color) | `products.color_text` |
| Storlek (preset) | `properties` (Size/Storlek; matchar CDON preset: one size, xxs–xxl) | `products.size` | Vid variant: `properties` (name: size) | Samma | `attributes` (name: size) | `products.size` |
| Storlek (fritext) | `properties` (Size/Storlek) | `products.size_text` (när size preset saknas) | Vid variant: `properties` (size) | Samma | `attributes` (size) | `products.size_text` |
| Material | `properties` (Material) | `products.material` | — (kan läggas i channelSpecific.cdon.specifications) | channelSpecific.fyndiq.properties om satt | `attributes` (name: material) | `products.material` |
| Mönster (preset) | `properties` (ColorPattern, Pattern) | `products.pattern` | channelSpecific.cdon.properties om satt | channelSpecific.fyndiq.properties | — | `products.pattern` |
| Mönster (fritext) | `properties` (Mönster, Pattern_text) | `products.pattern_text` | — | — | — | `products.pattern_text` |
| Modell | `properties` (Model, Modell) | `products.model` | Vid variant: `properties` (name: model) | Samma | — | `products.model` |
| Lagerplats | `stock_location` | `products.lagerplats` | — | — | — | `products.lagerplats` |
| Skick (condition) | `condition` (new/used; vid import used→used, annars new) | `products.condition` (new, used, refurb) | `classifications` (CONDITION: NEW, USED, REFURB) | — | `meta_data` (nyckel `condition`: new, used, refurbished) | `products.condition` |
| Grupp-ID (Sello produktgrupp) | `group_id` | `products.group_id` | parent_sku på barn = products.group_id (Sello group_id) | — | Variable product SKU = group_id; variations SKU = V+product.id | `products.group_id` |
| Varianttyp (grupp: color/size/model) | `groups.type` (color, size, model) | `products.group_variation_type`, `channel_specific.cdon.variational_properties`, `channel_specific.fyndiq.variational_properties` | `variational_properties` (array), `properties` (color/size/model vid variant) | `variational_properties`, `properties` (samma) | Variable product + variations; attribut color/size/model; Modell som attribut | `products.group_variation_type`, channel_specific (JSON) |
| Föräldraprodukt (huvudvariant) | `groups.main_product` (härleds vid import: barn får parent_product_id = main_product) | `products.parent_product_id` | `parent_sku` (för barnprodukter) | `parent_sku` (för barn) | Variable product = SKU group_id; varianter = SKU V+id; lookup via ?sku= (ingen sparad Woo-ID) | `products.parent_product_id` |
| Volym | `volume` | `products.volume` | `volume_ml` eller `volume_l` (properties; enhet från volume_unit) | `volume_ml` eller `volume_l` (samma) | — | `products.volume` |
| Volymenhet | `volume_unit` | `products.volume_unit` | mL → volume_ml, L → volume_l | Samma | — | `products.volume_unit` |
| Vikt | `weight` (gram i Sello) | `products.weight` | `weight_g` (gram) eller `weight_kg` (om channelSpecific.weightUnit = kg) | Samma | `weight` (kg) | `products.weight` |
| Skostorlek EU | — | `channel_specific.shoeSizeEu` (eller products.shoe_size_eu om finns) | `shoe_size_eu` (properties) | `shoe_size_eu` | — | channel_specific (JSON) / products |
| Längd | — | `products.length_cm` (UI Detaljer) | — | — | `dimensions.length` | `products.length_cm` |
| Bredd | — | `products.width_cm` | — | — | `dimensions.width` | `products.width_cm` |
| Höjd | — | `products.height_cm` | — | — | `dimensions.height` | `products.height_cm` |
| Djup | — | `products.depth_cm` | — | — | — | `products.depth_cm` |
| Anteckningar | `notes` | `products.notes` | — | — | — | `products.notes` |
| Skapad (källa) | `created_at` | `products.source_created_at` | — | — | — | `products.source_created_at` |
| Sålda antal | `sold` | `products.quantity_sold` | — | — | — | `products.quantity_sold` |
| Senast såld | `last_sold` | `products.last_sold_at` | — | — | — | `products.last_sold_at` |
| Lista / mapp | `folder_id`, `folder_name` | List: product_list_items.list_id (lists-tabell; findOrCreateListForSelloFolder) | — | — | — | product_list_items.list_id (ej i products) |
| MPN (tillverkarens artikelnummer) | `private_reference` (sätts också som mpn vid import) | `products.mpn` | `mpn`; används även för `specifications` (Identifikation → Tillverkarens artikelnummer per språk) | — | `meta_data` (nyckel `mpn`) | `products.mpn` |
| KN-nummer | — | `products.kn_number` (UI flik Detaljer) | `kn_number` | `kn_number` | — | `products.kn_number` |
| CDON: Specifications (övriga) | — | `channel_specific.cdon.specifications` | `specifications` (slås ihop med MPN-sektion Identifikation per språk) | — | — | channel_specific (JSON) |
| CDON: delivery_type | — | `channel_specific.cdon.delivery_type` | `delivery_type` (array per market: mailbox, service_point, home_delivery) | — | — | channel_specific (JSON) |
| CDON: shipped_from | — | `channel_specific.cdon.shipped_from` | `shipped_from` (EU / NON_EU) | — | — | channel_specific (JSON) |
| CDON: availability_dates | — | `channel_specific.cdon.availability_dates` | `availability_dates` (per marknad) | — | — | channel_specific (JSON) |
| CDON: properties (kanalspecifika) | — | `channel_specific.cdon.properties` | `properties` (array; annars byggs från variant color/size/model) | — | — | channel_specific (JSON) |
| Fyndiq: legacy_product_id | — | `channel_specific.fyndiq.legacy_product_id` | — | `legacy_product_id` | — | channel_specific (JSON) |
| Fyndiq: delivery_type | — | `channel_specific.fyndiq.delivery_type` | — | `delivery_type` | — | channel_specific (JSON) |
| Fyndiq: properties (kanalspecifika) | — | `channel_specific.fyndiq.properties` | — | `properties` (annars byggs från variant) | — | channel_specific (JSON) |
| WooCommerce: backorders | — | `channel_specific.woocommerce.backorders` (yes, no, notify) | — | — | `backorders` | channel_specific (JSON) |
| WooCommerce: manage_stock | — | — (alltid true i payload) | — | — | `manage_stock: true` | — |
| channel_instance_id | — | — (sätts av system vid koppling instans–produkt) | — | — | — | `channel_product_overrides.channel_instance_id` |
| user_id | — | — | — | — | — | `products.user_id`, `channel_product_overrides.user_id` |
| created_at / updated_at | — | — | — | — | — | `products.created_at`, `products.updated_at`; `channel_product_overrides.created_at`, `channel_product_overrides.updated_at` |
