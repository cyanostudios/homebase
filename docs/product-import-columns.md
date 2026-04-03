# Produktimport: kolumnreferens (CSV/XLSX)

Rubriker normaliseras enligt `plugins/products/importParse.js`: gemener, mellanslag/`_`/`-` tas bort, punktnotation bevaras (t.ex. `title.se` → `title.se` efter normalisering av mellanslag — skriv **`title.se`** som kolumnrubrik).

## Matchnyckel (en per rad)

| Kolumn | Beskrivning                                                                             |
| ------ | --------------------------------------------------------------------------------------- |
| `sku`  | Artikelnummer (krävs som produktens SKU om inte befintlig rad hittas via annan nyckel). |
| `id`   | Homebase produkt-id (vid matchnyckel `id`).                                             |
| `gtin` | Vid matchnyckel `gtin` (Sello: även `propertygtin`).                                    |
| `ean`  | Vid matchnyckel `ean` (Sello: även `propertyean`).                                      |

## Sello-rad

| Kolumn    | Beskrivning                                                                    |
| --------- | ------------------------------------------------------------------------------ |
| `issello` | Sätt `1` för att tolka Sello-kolumnnamn (`standardnamesv`, `propertygtin`, …). |

## Basfält

| Kolumn                                                                                  | Mappning                                                                                                                          |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `status`                                                                                | `for sale` / `paused`                                                                                                             |
| `quantity`                                                                              | Heltal                                                                                                                            |
| `priceamount`                                                                           | Katalogpris                                                                                                                       |
| `currency`                                                                              | T.ex. `SEK`                                                                                                                       |
| `vatrate`                                                                               | 0–50 (Sello: kolumn `tax` kan ersätta)                                                                                            |
| `brand`                                                                                 | Text                                                                                                                              |
| `mpn`                                                                                   | / Sello: `manufacturerno`                                                                                                         |
| `privatename`                                                                           | `privateName`                                                                                                                     |
| `purchaseprice`                                                                         | `purchasePrice`                                                                                                                   |
| `knnumber`                                                                              | `knNumber`                                                                                                                        |
| `lagerplats`                                                                            |                                                                                                                                   |
| `condition`                                                                             | `new` \| `used` \| `refurb`                                                                                                       |
| `color`, `colortext`, `size`, `sizetext`, `pattern`, `material`, `patterntext`, `model` |                                                                                                                                   |
| `weight`, `volume`, `volumeunit`                                                        |                                                                                                                                   |
| `notes`                                                                                 |                                                                                                                                   |
| `lengthcm`, `widthcm`, `heightcm`, `depthcm`                                            | Dimensioner                                                                                                                       |
| `brandid`, `supplierid`, `manufacturerid`                                               | Positiva heltal                                                                                                                   |
| `listid`                                                                                | Efter lyckad skrivning: produkt kopplas till listan (samma som API `PUT /api/products/:id/list`).                                 |
| `mainimage`                                                                             | En http(s)-URL; **HEAD/GET** måste svara med `Content-Type` som `image/*`.                                                        |
| `images`                                                                                | Kommaseparerade http(s)-URL:er; samma validering som ovan. Ogiltig URL → rad hoppas (`invalid_main_image` / `invalid_image_url`). |
| `categories`                                                                            | Kommaseparerade strängar (som `categories: string[]` i UI).                                                                       |

## Texter per marknad (`se`, `dk`, `fi`, `no`)

| Kolumn              | Innehåll                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `title.<mk>`        | Produktnamn                                                                                          |
| `description.<mk>`  | Beskrivning (HTML tillåtet)                                                                          |
| `titleseo.<mk>`     | SEO-titel                                                                                            |
| `metadesc.<mk>`     | Meta description                                                                                     |
| `metakeywords.<mk>` | Meta keywords                                                                                        |
| `bulletpoints.<mk>` | Flera punkter: **kommaseparerade** (som `categories`). En punkt utan komma räknas som en enda punkt. |

**`textsstandard`**: `se` \| `dk` \| `fi` \| `no` — styr vilken marknad som används som **katalog** `title` / `description` när per-marknadstexter används. Standard: `se`. Krav: vald marknad måste ha **både** namn och icke-tom beskrivning (plain text efter HTML-strippning). Felkod: `standard_market_texts_incomplete`.

**Icke-Sello** utan per-marknadskolumner: generiska **`title`** och **`description`** används.

**Sello** utan per-marknadskolumner: **`standardnamesv`** / **`standarddescriptionsv`** (och generiska `title`/`description`) används som flat titel/beskrivning och skrivs **inte** in i `textsExtended` om inga per-marknadskolumner finns.

## `channelSpecific`

### Kolumn `channelspecificjson`

Ett **JSON-objekt** (strikt). **Tillåtna topnivånycklar:** `textsExtended`, `textsStandard`, `weightUnit`, `cdon`, `fyndiq`, `woocommerce`. Övriga nycklar ger fel: `invalid_channelspecificjson`.

**Merge-ordning:** befintligt `channelSpecific` → JSON från kolumnen → kolumn `weightunit` → per-marknadstextkolumner (som patchar `textsExtended`). Senare steg i den kedjan skriver över samma lövnivå som tidigare steg.

### Kolumn `weightunit`

`kg` eller `g` → `channelSpecific.weightUnit`.

### Punktnotation kanalpriser (exempel)

`cdon.se.price`, `cdon.se.active`, `fyndiq.<instance>.category`, `woocommerce.<shop>.categories`, … — samma som tidigare; **körs även när `issello` inte är 1** om kolumnen finns.

Se även API-referens / `GET /api/products/import/column-reference` för dynamiska kanalexempel.

## Felkoder (urval)

| Kod                                | Situation                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `standard_market_texts_incomplete` | Standardmarknad saknar komplett namn+beskrivning                            |
| `invalid_channelspecificjson`      | JSON saknas, ogiltig, fel typ, eller otillåten nyckel                       |
| `invalid_main_image`               | Första bild-URL i valideringen är huvudbild och är inte en giltig image-URL |
| `invalid_image_url`                | En extra bild-URL är ogiltig                                                |
| `missing_title`                    | Create utan titel (varken flat eller via `textsExtended`-upplösning)        |

## Variantgrupper

Importer stöder **inte** `groupId` / `parentProductId` / variantgruppering via kolumner (avsiktligt utelämnat).
