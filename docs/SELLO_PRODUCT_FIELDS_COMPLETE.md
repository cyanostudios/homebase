# Komplett produktfält – Sello & Homebase

Översikt över alla produktfält för att bygga ett produktdetaljfönster. Sello har fasta fält + dynamiska properties (hämtas från API).

---

## 1. Sello – fasta produktfält

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| `id` | number | Sello produkt-ID (read-only) |
| `folder_id` | string | Mapp-ID |
| `folder_name` | string | Mappnamn (read-only, endast i list) |
| `brand_id` | string | Märkes-ID |
| `brand_name` | string | Märkesnamn (read-only, endast i list) |
| `condition` | string | `new` eller `used` |
| `tax` | number | Moms: 0, 6, 12, 25 |
| `group_id` | number | Produktgrupp (read-only) |
| `private_name` | string | Intern produktnamn (visas inte för kund) |
| `private_reference` | string | SKU/referens |
| `quantity` | number | Lagerantal |
| `stock_location` | string | Lagerplats |
| `volume` | number | Volym |
| `volume_unit` | string | Volymenhet (t.ex. m3) |
| `weight` | number | Vikt i gram |
| `purchase_price` | number | Inköpspris |
| `notes` | string | Anteckningar |
| `created_at` | string | Skapad (read-only) |
| `updated_at` | string | Uppdaterad (read-only) |
| `sold` | number | Sålda (read-only) |
| `unsold` | number | Osålda auktioner (read-only) |
| `last_sold` | string | Senast såld (read-only) |

---

## 2. Sello – texts (per språk)

Per språk (en, sv, no, da, fi m.fl.):

| Fält | Beskrivning |
|------|-------------|
| `name` | Produktnamn |
| `description` | Beskrivning |
| `title` | SEO-titel |
| `meta_description` | Meta-beskrivning |
| `meta_keywords` | Meta-nyckelord |
| `bulletpoints` | Array med punkter (t.ex. ["Snabb leverans", "24k guld"]) |

Kan vara `default` (alla integrationer) eller per integration-ID.

---

## 3. Sello – properties (dynamiska)

Properties hämtas från `GET /v5/products/properties` (paginerat, 10–100 per sida). Varje property har:
- `id` – t.ex. "Color", "EAN"
- `name` – visningsnamn
- `type` – `text` eller `enum`
- `values` – vid `enum`: tillåtna värden

**Exempel från dokumentationen:**

| Property ID | Beskrivning |
|-------------|-------------|
| EAN | Streckkod EAN |
| GTIN | Streckkod GTIN |
| UPC | Streckkod UPC |
| ISBN | Streckkod ISBN |
| Color | Färg |
| Material | Material |
| ColorPattern | Färgmönster |
| MaximumManufacturerWeightRecommended | Max vikt (tillverkare) |
| MaximumManufacturerAgeRecommended | Max ålder (tillverkare) |
| MinimumWeightRecommendation | Min vikt |
| CountryAsLabeled | Ursprungsland |
| Battery | Batteri |

**Vilka som krävs/rekommenderas** beror på kategori och hämtas via:
`POST /v5/products/properties/required` med `{"categories": {"integrationId": ["categoryId"]}}`.

Exempel: `{"required": ["Color", "Material"], "recommended": ["ColorPattern"]}`.

---

## 4. Sello – övriga objekt

| Objekt | Beskrivning |
|--------|-------------|
| `shipping` | Fraktkostnad per integration |
| `prices` | Pris per integration (store, regular, campaign, auction) |
| `categories` | Kategorier per integration |
| `integrations` | `active` (true/false), `item_id` per integration |
| `images` | Array med bilder (url_large, url_small) |
| `auctions` | Auktioner per integration (endast i list) |

---

## 5. Homebase – produkttabell (nuvarande)

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | SERIAL | PK |
| user_id | INT | Ägare |
| product_number | VARCHAR(50) | Artikelnummer |
| sku | VARCHAR(255) | SKU (Sello ID vid import) |
| mpn | VARCHAR(255) | Tillverkares artikelnummer |
| title | VARCHAR(255) | Titel |
| description | TEXT | Beskrivning |
| status | VARCHAR(50) | t.ex. "for sale" |
| quantity | INT | Lagerantal |
| price_amount | NUMERIC | Pris |
| currency | VARCHAR(10) | Valuta |
| vat_rate | NUMERIC | Moms |
| main_image | VARCHAR(500) | Huvudbild |
| images | JSONB | Bildarray |
| categories | JSONB | Kategorier |
| merchant_sku | VARCHAR(255) | Merchant SKU |
| brand | VARCHAR(255) | Märke (text) |
| brand_id | INT | FK till brands |
| ean | VARCHAR(14) | EAN |
| gtin | VARCHAR(14) | GTIN |
| supplier_id | INT | FK till suppliers |
| manufacturer_id | INT | FK till manufacturers |
| channel_specific | JSONB | Kanalöversättningar |
| purchase_price | NUMERIC | Inköpspris |
| sale_price | NUMERIC | Försäljningspris |
| lagerplats | VARCHAR(100) | Lagerplats |
| color | VARCHAR(100) | Färg (kod) |
| color_text | VARCHAR(255) | Färg (text) |
| size | VARCHAR(50) | Storlek (kod) |
| size_text | VARCHAR(255) | Storlek (text) |
| pattern | VARCHAR(100) | Mönster |
| weight | NUMERIC | Vikt (gram) |
| length_cm | NUMERIC | Längd |
| width_cm | NUMERIC | Bredd |
| height_cm | NUMERIC | Höjd |
| depth_cm | NUMERIC | Djup |

---

## 6. Rekommendation för produktdetaljfönster

1. **Fasta fält** – visa/redigera alla relevanta Homebase-kolumner.
2. **Properties** – hämta dynamiskt via `GET /v5/products/properties` (med Sello API-nyckel) och visa fält som matchar produktens kategori.
3. **Krävs/rekommenderas** – använd `POST /v5/products/properties/required` med produktens kategorier för att markera obligatoriska och rekommenderade fält.
4. **Flexibla properties** – överväg en `product_properties` JSONB-kolumn för att spara godtyckliga Sello-properties utan att ändra schema för varje ny property.
