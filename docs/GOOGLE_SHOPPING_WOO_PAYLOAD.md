# Google Shopping – krav vs WooCommerce-payload

Google kräver vissa produktattribut för att produkter ska kunna visas i **Shopping-annonser** och **gratis Shopping-listningar**. Tabellen nedan visar Googles krav (enligt [Product data specification](https://support.google.com/merchants/answer/7052112)) och var dessa fylls från vår **WooCommerce-payload** (`mapProductToWoo` i `plugins/woocommerce-products/controller.js`).

**Källor:**

- Google: [Product data specification](https://support.google.com/merchants/answer/7052112), [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- Homebase: `plugins/woocommerce-products/controller.js` → `mapProductToWoo`

---

## Tabell: Google krav ↔ Woo-payload

| Google-attribut (Shopping / Merchant Center) | Krav                                                                                                                    | Vår Woo-payload (fält vi skickar till Woo)                                                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **id**                                       | Obligatoriskt. Unikt produkt-ID (max 50 tecken). SKU rekommenderas.                                                     | `sku` ← `products.id`                                                                                                                                                  |
| **title**                                    | Obligatoriskt. Produktnamn, max 150 tecken.                                                                             | `name` ← `products.title`                                                                                                                                              |
| **description**                              | Obligatoriskt. Beskrivning, max 5000 tecken.                                                                            | `description` ← `products.description`                                                                                                                                 |
| **link**                                     | Obligatoriskt. Produktens landningssida (URL).                                                                          | **Ej i payload.** URL:en byggs av Woo/butiken (t.ex. `https://butik.se/product/slug/`). Feed eller plugin (t.ex. Google Listings & Ads) använder produktens permalink. |
| **image_link**                               | Obligatoriskt. URL till huvudbild (http/https).                                                                         | `images[0].src` ← `products.mainImage`                                                                                                                                 |
| **additional_image_link**                    | Valfritt. Fler bild-URL:er.                                                                                             | `images[1..].src` ← `products.images`                                                                                                                                  |
| **availability**                             | Obligatoriskt. `in_stock`, `out_of_stock`, `preorder`, `backorder`.                                                     | Härleds från Woo: `manage_stock: true` + `stock_quantity` → i feed vanligtvis `in_stock` / `out_of_stock`. Vi sätter `stock_quantity` ← `products.quantity`.           |
| **price**                                    | Obligatoriskt. Pris med valuta (ISO 4217).                                                                              | `regular_price` ← `products.priceAmount` eller override. Valuta sätts på butiksnivå i Woo.                                                                             |
| **sale_price**                               | Valfritt. Reapris.                                                                                                      | `sale_price` ← override (channel_product_overrides) om angiven.                                                                                                        |
| **condition**                                | Obligatoriskt om produkt är begagnad/återbrukad; valfritt för ny (standard: new). Värden: `new`, `refurbished`, `used`. | Alltid skickat: `products.condition` → `meta_data` (condition: `new`, `used` eller `refurbished`).                                                                     |
| **brand**                                    | Obligatoriskt för nya produkter (undantag: film, böcker, musikinspelningar). Valfritt övriga. Max 70 tecken.            | `attributes` (brand) ← `products.brand`                                                                                                                                |
| **gtin**                                     | Starkt rekommenderat om tillgängligt (EAN/UPC/ISBN etc.).                                                               | `meta_data` (gtin) ← `products.gtin`                                                                                                                                   |
| **mpn** (Manufacturer Part Number)           | Obligatoriskt om produkten saknar GTIN. Annars valfritt. Max 70 tecken.                                                 | `meta_data` (mpn) ← `products.mpn`                                                                                                                                     |
| **google_product_category**                  | Valfritt men rekommenderat. Google-produktkategori (taxonomi-ID eller sökväg).                                          | **Ej i payload.** Kan mappas i Merchant Center eller från Woo-kategorier vid feed-export.                                                                              |
| **product_type**                             | Valfritt. Er egen produkttyp/kategori, max 750 tecken.                                                                  | **Ej i payload.** Woo `categories` kan användas av feed/plugin som product_type.                                                                                       |
| **identifier_exists**                        | Valfritt. `yes` / `no` om GTIN/brand/MPN finns.                                                                         | **Ej i payload.** Kan sättas i feed om identifierare saknas.                                                                                                           |

---

## Sammanfattning

- **Täcks av Woo-payloaden:** id (sku), title (name), description, image_link + additional (images), availability (via lager), price (regular_price), sale_price, brand (attributes), gtin och mpn (meta_data).
- **Link:** Byggs alltid av Woo/butiken; behöver inte skickas i create/update-payloaden.
- **condition** – skickas alltid som `meta_data` (condition): `products.condition` → `new` | `used` | `refurbished`.
- **Saknas / hanteras i feed:** **google_product_category** och **product_type** – hanteras normalt i feed eller Merchant Center utifrån Woo-kategorier.

För att möta Googles krav fullt ut från Homebase behöver butiken antingen använda en Woo-feed/plugin (t.ex. Google Listings & Ads) som bygger `link`, `availability` och eventuellt `condition` från Woo, eller så kan vi lägga till `condition` i Woo-payloaden (meta_data) så att sådana plugins kan läsa det.
