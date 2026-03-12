# Sello → Homebase → Channel Field Mapping

Schema- och fältmappningsdokument för Sello-import, Homebase-lagring och export till CDON, Fyndiq och WooCommerce.

**Schema verifierat mot Neon** (tenant_1) 2025-03-04.

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

| Fält                     | Required | Typ                                                            | Beskrivning                           |
| ------------------------ | -------- | -------------------------------------------------------------- | ------------------------------------- |
| `sku`                    | ✅       | string (1–64)                                                  | Unikt ID                              |
| `status`                 | ✅       | "for sale" \| "paused"                                         | –                                     |
| `quantity`               | ✅       | int ≥ 0                                                        | Lagerantal                            |
| `main_image`             | ✅       | URL (1–1500)                                                   | Huvudbild                             |
| `markets`                | ✅       | ["SE","DK","FI","NO"]                                          | –                                     |
| `title`                  | ✅       | [{language, value}] (5–150)                                    | Per språk                             |
| `description`            | ✅       | [{language, value}] (10–4096)                                  | Per språk                             |
| `price`                  | ✅       | [{market, value: {amount_including_vat, currency, vat_rate?}}] | Per marknad                           |
| `shipping_time`          | ✅       | [{market, min, max}] (1–10)                                    | Per marknad                           |
| `category`               | ✅       | string                                                         | En kategori per aktiv marknad         |
| `parent_sku`             | –        | string (1–64)                                                  | Grupp-ID                              |
| `brand`                  | –        | string (1–50)                                                  | –                                     |
| `gtin`                   | –        | string (1–13)                                                  | –                                     |
| `mpn`                    | –        | string                                                         | –                                     |
| `images`                 | –        | string[] (max 10 URLs)                                         | –                                     |
| `unique_selling_points`  | –        | [{language, value}]                                            | Byggs från textsExtended.bulletpoints |
| `specifications`         | –        | –                                                              | –                                     |
| `classifications`        | –        | [{name, value}]                                                | Byggs från products.condition.        |
| `delivery_type`          | –        | [{market, value}]                                              | mailbox, service_point, home_delivery |
| `kn_number`              | –        | string (1–48)                                                  | –                                     |
| `shipped_from`           | –        | "EU" \| "NON_EU"                                               | UI: flik Detaljer. Default EU.        |
| `manufacturer`           | –        | object                                                         | –                                     |
| `availability_dates`     | –        | [{market, value}]                                              | Per marknad. UI: flik Detaljer.       |
| `properties`             | –        | –                                                              | –                                     |
| `variational_properties` | –        | –                                                              | –                                     |

### 2.2 Fyndiq (v1/articles)

| Fält                     | Required | Typ                                   | Beskrivning            |
| ------------------------ | -------- | ------------------------------------- | ---------------------- |
| `sku`                    | ✅       | string (1–64)                         | –                      |
| `status`                 | ✅       | "for sale" \| "paused"                | –                      |
| `quantity`               | ✅       | int ≥ 0                               | –                      |
| `main_image`             | ✅       | URL (1–1500)                          | –                      |
| `markets`                | ✅       | ["SE","DK","FI","NO"]                 | –                      |
| `title`                  | ✅       | [{language, value}] (5–150)           | –                      |
| `description`            | ✅       | [{language, value}] (10–4096)         | –                      |
| `price`                  | ✅       | [{market, value: {amount, currency}}] | Per marknad            |
| `shipping_time`          | ✅       | [{market, min, max}] (1–21)           | Per marknad            |
| `categories`             | ✅       | string[]                              | Max 5                  |
| `parent_sku`             | –        | string (1–64)                         | –                      |
| `legacy_product_id`      | –        | int                                   | –                      |
| `brand`                  | –        | string (1–50)                         | –                      |
| `gtin`                   | –        | string (1–13)                         | –                      |
| `images`                 | –        | string[] (max 10 URLs)                | –                      |
| `delivery_type`          | –        | [{market, value}]                     | mailbox, service_point |
| `kn_number`              | –        | string (1–48)                         | –                      |
| `properties`             | –        | –                                     | –                      |
| `variational_properties` | –        | –                                     | –                      |

### 2.3 WooCommerce (REST API)

| Fält             | Required | Typ                         | Beskrivning       |
| ---------------- | -------- | --------------------------- | ----------------- |
| `sku`            | –        | string                      | –                 |
| `name`           | –        | string                      | Titel             |
| `status`         | –        | publish \| draft \| private | –                 |
| `regular_price`  | –        | string                      | Pris (inkl. moms) |
| `manage_stock`   | –        | bool                        | true              |
| `stock_quantity` | –        | number                      | Lagerantal        |
| `description`    | –        | string                      | –                 |
| `categories`     | –        | [{id}]                      | –                 |
| `images`         | –        | [{src}]                     | –                 |
| `attributes`     | –        | [{name, options}]           | t.ex. brand       |
| `meta_data`      | –        | [{key, value}]              | ean, gtin         |

---

## 3. Homebase-schema (Neon)

### products (tenant_N)

`id`, `user_id`, `sku`, `title`, `description`, `status`, `quantity`, `price_amount`, `currency`, `vat_rate`, `main_image`, `images`, `categories`, `brand`, `brand_id`, `gtin`, `kn_number`, `mpn`, `ean`, `supplier_id`, `manufacturer_id`, `channel_specific`, `purchase_price`, `sale_price`, `lagerplats`, `color`, `color_text`, `size`, `size_text`, `pattern`, `pattern_text`, `material`, `weight`, `length_cm`, `width_cm`, `height_cm`, `depth_cm`, `condition`, `group_id`, `volume`, `volume_unit`, `notes`, `private_name`, `source_created_at`, `quantity_sold`, `last_sold_at`, `parent_product_id`, `group_variation_type`, `model`, `created_at`, `updated_at`

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

- **Källa:** `channelSpecific.cdon.title` / `channelSpecific.fyndiq.title` (byggda arrays) eller `channelSpecific.textsExtended` + `channelSpecific.textsStandard`.
- **Fallback:** Om en marknad saknar egen titel/beskrivning används `textsExtended[textsStandard]` (vald standardmarknad).
- **Ingen fallback:** Om både marknad och standard är tomma används inte `products.title` eller `products.description`. Marknaden hoppas över (null). Varning visas vid sparande om marknaden har aktiva CDON/Fyndiq-kanaler.

### 5.2 Homebase → CDON

| Homebase-källa                                    | CDON-payload                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `products.id`                                     | `sku`                                                                   |
| `channelSpecific.textsExtended` + `textsStandard` | `title`, `description` (se 5.1)                                         |
| `products.title`                                  | Endast när varken cdon.title eller textsExtended finns (helproduktnivå) |
| `products.description`                            | Samma som ovan                                                          |
| `products.mainImage`                              | `main_image`                                                            |
| `products.images`                                 | `images`                                                                |
| `products.quantity`                               | `quantity`                                                              |
| `products.status`                                 | `status`                                                                |
| `products.parentProductId`                        | `parent_sku`                                                            |
| `products.brand`                                  | `brand`                                                                 |
| `products.gtin`                                   | `gtin`                                                                  |
| `products.mpn`                                    | `mpn`                                                                   |
| `channel_product_overrides` (active=true)         | `price`, `category`                                                     |
| `channelSpecific.cdon.title`                      | `title`                                                                 |
| `channelSpecific.cdon.description`                | `description`                                                           |
| `channelSpecific.cdon.shipping_time`              | `shipping_time`                                                         |
| `channelSpecific.textsExtended.bulletpoints`      | `unique_selling_points`                                                 |
| `products.kn_number`                              | `kn_number`                                                             |
| `channelSpecific.cdon.specifications`             | `specifications`                                                        |
| `products.condition`                              | `classifications` (new→NEW, used→USED, refurb→REFURB)                   |
| `channelSpecific.cdon.delivery_type`              | `delivery_type`                                                         |
| `channelSpecific.cdon.shipped_from`               | `shipped_from`                                                          |
| `channelSpecific.cdon.availability_dates`         | `availability_dates`                                                    |
| `channelSpecific.cdon.manufacturer`               | `manufacturer`                                                          |
| `channelSpecific.cdon.properties`                 | `properties`                                                            |
| `channelSpecific.cdon.variational_properties`     | `variational_properties`                                                |

**Variantprodukter (parent_product_id):** Om `channelSpecific.cdon.properties` saknas byggs `properties` från `products.color`/`colorText`, `size`/`sizeText` eller `model` beroende på `groupVariationType`. `variational_properties` tas från `channelSpecific.cdon.variational_properties` eller härleds från `groupVariationType`.

### 5.3 Homebase → Fyndiq

| Homebase-källa                                    | Fyndiq-payload                                           |
| ------------------------------------------------- | -------------------------------------------------------- |
| `products.id`                                     | `sku`                                                    |
| `channelSpecific.textsExtended` + `textsStandard` | `title`, `description` (se 5.1)                          |
| `products.title`                                  | Endast när varken fyndiq.title eller textsExtended finns |
| `products.description`                            | Samma som ovan                                           |
| `products.mainImage`                              | `main_image`                                             |
| `products.images`                                 | `images`                                                 |
| `products.quantity`                               | `quantity`                                               |
| `products.status`                                 | `status`                                                 |
| `products.parentProductId`                        | `parent_sku`                                             |
| `products.brand`                                  | `brand`                                                  |
| `products.gtin`                                   | `gtin`                                                   |
| `channel_product_overrides` (active=true)         | `price`, `categories`                                    |
| `channelSpecific.fyndiq.title`                    | `title`                                                  |
| `channelSpecific.fyndiq.description`              | `description`                                            |
| `channelSpecific.fyndiq.shipping_time`            | `shipping_time`                                          |
| `channelSpecific.fyndiq.legacy_product_id`        | `legacy_product_id`                                      |
| `channelSpecific.fyndiq.delivery_type`            | `delivery_type`                                          |
| `channelSpecific.fyndiq.properties`               | `properties`                                             |
| `channelSpecific.fyndiq.variational_properties`   | `variational_properties`                                 |

**Variantprodukter (parent_product_id):** Samma logik som CDON – properties och variational_properties byggs från product-fält respektive groupVariationType om channelSpecific saknas.

### 5.4 Homebase → WooCommerce

| Homebase-källa                       | WooCommerce-payload  |
| ------------------------------------ | -------------------- |
| `products.id`                        | `sku`                |
| `products.title`                     | `name`               |
| `products.description`               | `description`        |
| `products.mainImage`                 | `images[0].src`      |
| `products.images`                    | `images[1..].src`    |
| `products.quantity`                  | `stock_quantity`     |
| `products.status`                    | `status` (mappad)    |
| `products.priceAmount`               | `regular_price`      |
| `products.brand`                     | `attributes` (brand) |
| `products.ean`                       | `meta_data` (ean)    |
| `products.gtin`                      | `meta_data` (gtin)   |
| `channel_product_overrides` (active) | `categories`         |

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

| Kanal       | Fält                                               | Status                                                                                                        |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| CDON        | `unique_selling_points`                            | Byggs från textsExtended.bulletpoints. Fylls i efter Sello-import.                                            |
| CDON        | `specifications`                                   | Kräver `channelSpecific.cdon.specifications` – ej importerat                                                  |
| CDON        | `classifications`                                  | Byggs från `products.condition` (new→NEW, used→USED, refurb→REFURB). UI: flik Detaljer (Skick).               |
| CDON        | `delivery_type`                                    | Kräver `channelSpecific.cdon.delivery_type` – ej importerat                                                   |
| CDON        | `kn_number`                                        | Från `products.kn_number` (flik Detaljer)                                                                     |
| CDON        | `shipped_from`                                     | Från `channelSpecific.cdon.shipped_from`. UI: flik Detaljer (Skickas från). Default EU.                       |
| CDON        | `availability_dates`                               | Från `channelSpecific.cdon.availability_dates`. UI: flik Detaljer (per marknad).                              |
| CDON        | `manufacturer`                                     | Kräver `channelSpecific.cdon.manufacturer`. `products.manufacturer_id` finns men mappas inte till CDON-format |
| CDON        | `properties`                                       | Kräver `channelSpecific.cdon.properties` – ej importerat                                                      |
| CDON        | `variational_properties`                           | Importeras från `groups.type` → `channelSpecific.cdon.variational_properties`                                 |
| Fyndiq      | `delivery_type`                                    | Kräver `channelSpecific.fyndiq.delivery_type` – ej importerat                                                 |
| Fyndiq      | `kn_number`                                        | Från `products.kn_number` (flik Detaljer)                                                                     |
| Fyndiq      | `properties`                                       | Kräver `channelSpecific.fyndiq.properties` – ej importerat                                                    |
| Fyndiq      | `variational_properties`                           | Importeras från `groups.type` → `channelSpecific.fyndiq.variational_properties`                               |
| WooCommerce | `mpn`                                              | Finns i `products.mpn` men används inte i `mapProductToWoo`                                                   |
| WooCommerce | `meta_data` (ean, gtin)                            | Används                                                                                                       |
| Alla        | `textsExtended` (titleSeo, metaDesc, metaKeywords) | Sparas men används inte i kanal-payload. bulletpoints används i CDON.                                         |

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
