# Sello-import → Homebase (sektion 5): vanliga fält

Översikt över Homebase-kolumner som är **ganska vanliga** att fylla från Sello, med källa och status.

---

## Tabell: vanliga fält

| Homebase-kolumn | Sello-källa | Typ | Redan importerat? | Kommentar |
|-----------------|-------------|-----|-------------------|-----------|
| **sku** | `id` | fast | ✅ Ja | Sello Art.Nr / produkt-ID |
| **merchant_sku** | `private_reference` | fast | ✅ Ja | "Din" SKU |
| **title** | `texts.default.{sv}.name` (eller standard) | texts | ✅ Ja | Produktnamn |
| **description** | `texts.default.{sv}.description` | texts | ✅ Ja | Beskrivning |
| **quantity** | `quantity` | fast | ✅ Ja | Lagerantal |
| **vat_rate** | `tax` | fast | ✅ Ja | 0, 6, 12, 25 |
| **main_image** / **images** | `images` | fast | ✅ Ja | Nedladdade bilder |
| **categories** | `categories` (aggregerat) | fast | ✅ Ja | Kategorier |
| **channel_specific** | categories + textsExtended + priser per instans | fast + texts | ✅ Ja | Kanalöversättningar, SEO, priser |
| **brand** / **brand_id** | `brand_id`, `brand_name` | fast | ✅ Ja | Lista/märke |
| **ean** | properties: `EAN` | property | ✅ Ja | Streckkod |
| **gtin** | properties: `GTIN` | property | ✅ Ja | Streckkod |
| **purchase_price** | `purchase_price` | fast | ✅ Ja | Inköpspris |
| **lagerplats** | `stock_location` | fast | ✅ Ja | Lagerplats |
| **condition** | `condition` | fast | ✅ Ja | new / used |
| **volume** / **volume_unit** | `volume`, `volume_unit` | fast | ✅ Ja | Volym (t.ex. m³) |
| **weight** | `weight` | fast | ✅ Ja | Vikt (gram) – viktigt för frakt |
| **notes** | `notes` | fast | ✅ Ja | Anteckningar |
| **color_text** | properties: `Color` | property | ✅ Ja | Färg (text) |
| **group_id** | `group_id` | fast | ✅ Ja | Produktgrupp (Sello) |
| **price_amount** | `prices` (per kanal) | fast | ❌ Nej | Sparas i channelSpecific som override; ingen global core-pris från Sello |
| **color** | properties: `Color` (kod) | property | ❌ Nej | Om Sello har enum-värde kan det mappas till `color` |
| **size** / **size_text** | properties (t.ex. `Size`) | property | ❌ Nej | Vanligt; Sello har ingen fast `size`, kan finnas som dynamisk property |
| **pattern** | properties: `ColorPattern` | property | ❌ Nej | Färgmönster – ganska vanligt i mode/living |
| **length_cm** / **width_cm** / **height_cm** / **depth_cm** | — | — | ❌ Saknas i Sello | Sello har inte mått i fasta fält; eventuellt via properties om det finns |
| **supplier_id** / **manufacturer_id** | — | — | ❌ Saknas i Sello | Sello har inte dessa entiteter |
| **sale_price** | — | — | ❌ Nej | Homebase-fält; kan sättas från prislogik, inte direkt från Sello |

---

## Sammanfattning

- **Redan importerat:** de flesta vanliga fälten (bas, lager, vikt, volym, köpspris, anteckningar, färg som text, EAN/GTIN, texter/SEO, kanalpriser i channelSpecific).
- **Vettigt att lägga till vid behov:**
  - **size / size_text** – om Sello har en property typ "Size" (vanligt i kläder/skor).
  - **pattern** – från property `ColorPattern` om det används.
  - **color** (kod) – om vi vill spara enum-värde från Sello `Color` vid sidan om `color_text`.
- **Saknas i Sello:** längd/bredd/höjd/djup, supplier/manufacturer; dessa fylls i Homebase eller från annan källa.

Om du vill kan nästa steg vara att implementera import av **size/size_text** och **pattern** från Sello properties (liknande `getSelloColorFromProperties`).
