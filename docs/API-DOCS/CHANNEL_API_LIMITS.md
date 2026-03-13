# Kanal-API: gränser och rekommendationer

Sammanställning från respektive kanals API-dokumentation. Använd för att sätta batch-storlekar, paginering och (där det stödjs) rate limiting i Homebase.

---

## Sello

**Källa:** `docs/API-DOCS/SELLO-API.md`

| Typ                              | Gräns                            | Kommentar                                                                                                         |
| -------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Rate limit**                   | **30 anrop per minut** (default) | Ökning kan begäras: support@sello.io. Headers: `X-RateLimit-Limit`, `X-RateLimit-Reset`, `X-RateLimit-Remaining`. |
| **Produkter – lista**            | max **100** per sida             | `size` upp till 100; värden > 100 sätts till 100. Paginering: `offset`.                                           |
| **Produkter – bulk-uppdatering** | max **100** produkter per anrop  | Endpoint som uppdaterar flera produkter med samma info.                                                           |
| **Ordrar – lista**               | max **300** per sida             | `size` upp till 300. Default 10. Paginering: `offset`.                                                            |
| **Meddelanden**                  | 100 per offset                   | Senaste 100 meddelanden; rensas efter 14 dagar.                                                                   |
| **Properties**                   | max 100 per sida                 | `size` upp till 100, default 10.                                                                                  |

**Rekommendation Homebase:** Håll under 30 anrop/minut mot Sello (t.ex. köa import/export eller sprida anrop). Använd `size` ≤ 100 för produktlistor, ≤ 300 för orderlistor.

---

## Fyndiq

**Källa:** `docs/API-DOCS/FYNDIQ-API-JSON.json`, `FYNDIQ_API_DOCUMENTATION.md`

| Typ                        | Gräns                               | Kommentar                                                                                                                      |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Bulk create (artiklar)** | max **100** skapanden per anrop     | POST till bulk-endpoint; en array med upp till 100 create-bodies.                                                              |
| **Bulk update (artiklar)** | max **200** uppdateringar per anrop | Fyra action-typer; olika actions för samma artikel i samma anrop tillåtet, men inte samma action två gånger för samma artikel. |
| **Lista artiklar**         | max **1000** per sida               | `limit` default 100, max 1000. Paginering: `page`.                                                                             |
| **Lista ordrar**           | max **1000** per sida               | Default 100, paginering: `limit` + `page`.                                                                                     |

**Rate limit:** Ej explicit angiven i de tillgängliga docs; vid 429 hantera retry/backoff.

**Rekommendation Homebase:** Batcha export create till max 100 produkter per anrop; update till max 200. Paginera produkt-/orderlistor med `limit` 100–1000 beroende på behov.

---

## CDON

**Källa:** `docs/API-DOCS/CDON-API-JSON.json`, `CDON_API_DOCUMENTATION.md` + extern info för Categorization API.

| Typ                             | Gräns                                  | Kommentar                                                                                                                                                                                 |
| ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merchants API – artiklar**    | Ingen explicit max i docs              | POST `/v2/articles/bulk` (create) och PUT `/v2/articles/bulk` (update/delete) – ingen dokumenterad max för antal `articles` eller `actions`. Säker batchstorlek: t.ex. 100–200 per anrop. |
| **Merchants API – ordrar**      | **100** default, **1000** max per sida | Parametrar: `limit` (default 100), `page`.                                                                                                                                                |
| **Categorization API** (extern) | **10 req/s**, **50 000 req/dag**       | Vid överskridande: HTTP 429. Gäller categorization; Merchants API (articles/orders) har inte samma gränser dokumenterade i vår doc.                                                       |

**Rekommendation Homebase:** För articles bulk – batcha t.ex. 100–200 per request. För orderlista använd `limit` 100 eller 1000 och `page`. Vid 429 (Categorization eller annat) implementera backoff/retry.

---

## WooCommerce

**Källa:** Ingen lokal API-doc i repo. WooCommerce REST API (wc/v3) har inte en entydig dokumenterad global rate limit för admin/product-API.

| Typ                               | Gräns                                               | Kommentar                                                                                                                    |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Store API** (frontend/checkout) | 25 req / 10 s (default); checkout 3 / 60 s          | Gäller Store API, inte nödvändigtvis wp-json/wc/v3.                                                                          |
| **REST API (wc/v3)**              | Ej angiven i officiella docs                        | Begränsning kan vara per installation (PHP/timeouts, säkerhetsplugins). Vid 429: respektera Retry-After / RateLimit-headers. |
| **Batch-endpoints**               | Woo batch stödjer create/update/delete i en request | Storlek begränsas i praktiken av request size/timeout.                                                                       |

**Rekommendation Homebase:** Undvik att skicka hundratals parallella anrop mot samma WooCommerce-instans. Batcha produkter där Woo stödjer batch (t.ex. `/products/batch`); vid 429 eller timeout – minska batchstorlek eller lägg in fördröjning mellan batchar.

---

## Inkommande anrop till Homebase

Detta dokument beskriver **utgående** anrop från Homebase till Sello, Fyndiq, CDON och WooCommerce. Gränser för **inkommande** anrop (t.ex. webhooks eller API-anrop från kanaler till er server) styrs av er egen infrastruktur och konfiguration, inte av kanalernas dokumentation.

---

## Kort referens – batch/pagination i kod

| Kanal           | Export create (batch max) | Export update (batch max) | Lista produkter (sida) | Lista ordrar (sida) |
| --------------- | ------------------------- | ------------------------- | ---------------------- | ------------------- |
| **Sello**       | –                         | 100 (bulk update)         | 100                    | 300                 |
| **Fyndiq**      | 100                       | 200                       | 1000                   | 1000                |
| **CDON**        | rekomm. 100–200           | rekomm. 100–200           | –                      | 1000                |
| **WooCommerce** | per batch-endpoint        | per batch-endpoint        | per store              | per store           |

| Kanal           | Rate limit (utgående)                              |
| --------------- | -------------------------------------------------- |
| **Sello**       | 30/min (default)                                   |
| **Fyndiq**      | ej angiven                                         |
| **CDON**        | Categorization 10/s, 50k/dag; Merchants ej angiven |
| **WooCommerce** | ej angiven för wc/v3                               |
