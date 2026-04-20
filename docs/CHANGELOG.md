# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner.

---

## 2026-04-20 – Leveranslogg: lokala commits före push till origin

Branch **`Homebase-V3.2.2`** kan ligga **flera commits före** `origin/Homebase-V3.2.2`. Nedan en **översikt** av vad som ingick i den leveransen (fullständiga beskrivningar finns under respektive datum längre ned i filen):

- **Ordrar:** bokföringsexport, anpassad Excel-export, PDF (plocklista/kvitto), interna anteckningar — se **2026-04-16**.
- **Produkter:** utkast, import/export-kolumner, kanaletiketter — se **2026-04-14** (första blocket).
- **Produkter:** Sello/Woo-överskridningar, export, lagerhändelser m.m. — se **2026-04-14** (andra blocket).
- **Media:** strikt delete-policy, felkoder, loggning — se **2026-04-08**.
- **Produktmedia:** asset-modell (varianter), batch-pipeline — se **2026-04-04**.
- **Backblaze B2**, Sello-hosting, importpipeline — se **2026-04-03**.
- **Kodstil:** ESLint i `ProductList` (eqeqeq m.m.) — ingen separat produktrelease.
- **Woo `textMarket` per butik**, dedikerad produktimport-vy — se **2026-04-02**.

---

## 2026-04-16 – Ordrar: bokföringsexport, anpassad Excel-export, PDF (plocklista/kvitto), interna anteckningar

### Databas

- **`096-orders-staff-note.sql`:** kolumn **`staff_note`** på **`orders`** (intern personalanteckning, max **2000** tecken via **`chk_orders_staff_note_len`**).

### Backend (`plugins/orders`)

- **Bokföringsunderlag (Excel):** **`accountingExportBuilder.js`**, **`POST /api/orders/accounting/xlsx`** — kolumner enligt bokföringsunderlag (frakt m.m.), sortering på **Homebase ordernummer** (**`order_number`**). **`getAccountingExportLineRows`** i modellen.
- **Anpassad orderexport:** **`orderExportBuilder.js`**, **`GET /api/orders/export/fields`**, **`POST /api/orders/export/xlsx`** — två blad (**Order** / **Rader**), valbara fält, datumintervall på **`placed_at`**, max **731** dagar, tak **100 000** rader.
- **Intern anteckning:** **`GET/PUT /api/orders/:id/note`** (lazy), **`PUT /api/orders/batch/note`** — samma text på flera order (upp till **500** id:n per anrop).
- **PDF:** plocklista (**`POST /api/orders/plocklista/pdf`**), kvitto (**`POST /api/orders/kvitto/pdf`**), delade hjälpare **`orderPdfPayload.js`**, **`ordersPdfCommon.js`**, mallar **`plocklistaPdfTemplate.js`**, **`kvittoPdfTemplate.js`**.

### Klient

- **Hel sida `orders-export`:** **`OrderExportPage.tsx`** (period, snabbval, kryssrutor Orderfält/Radfält, nedladdning) — samma navigationsmönster som produktimport/export.
- **`ordersApi`:** bokföring Excel, anpassad export, fältreferens, batch-anteckning.
- **`OrdersList`:** Hantera (bl.a. bokföring, kvitto, plocklista), **Alternativ → Exportera order**, anteckning för **en eller flera** valda order via **`OrderStaffNoteDialog`**.
- **App-shell:** **`App.tsx`**, **`Sidebar`** (nav **`orders-export`**, aktiv under Ordrar), **`TopBar`**, **`panelRendering`**, **`appCurrentPageStore`** (bootstrap ordrar även på export-sidan).

## 2026-04-14 – Produkter: utkast (`is_draft`), import/export-kolumner, kanaletiketter

### Databas

- **`095-products-drafts.sql`:** kolumn **`is_draft`** på **`products`** (dolda utkast som reserverar ett riktigt produkt-id innan första sparning) samt partiellt index **`idx_products_is_draft_true`**.

### API och modell

- **`POST /api/products/draft`:** skapar utkast via **`createDraft`** (tom titel, **`is_draft: true`**).
- **Listor och antal** i katalogen filtrerar **`is_draft = FALSE`** så utkast syns inte i den vanliga produktlistan.
- **`plugins/products/model.js`**, **`controller.js`**, **`routes.js`:** stöd för utkast och **`isDraft`** i API-svar.
- **`plugins/products/productMediaService.js`:** **`uploadPendingManualFiles`** tar valfritt **`options.productId`** så manuella filer kan laddas upp direkt till produktens lagringspath när id redan finns (annars pending **`manual/<userId>`** som tidigare).

### Import och export

- **Borttaget från filimport/export:** kolumnerna **`categories`** och **`channelSpecificJson`** (samt motsvarande parsning/validering i **`importProductRowMapper.js`**). **`applyTextsAndChannelSpecific`** slår ihop **`textsExtended`** och **`weightUnit`** utan bulk-JSON-kolumn.
- **Export:** katalogpris-kolumnen heter **Baspris** med tydligare beskrivning (kanalpris via t.ex. **`woocommerce.<id>.price`**). **`exportColumnReference.js`** / **`productExportBuilder.js`** rensade i linje med borttagna fält.

### Klient

- **`ProductContext`**, **`productsApi`**, **`ProductForm`**, **`ProductImportPage`**, **`ProductExportPage`:** reservation av utkast-produkt (stabilt id innan sparning) och relaterad UI.
- **`client/src/plugins/channels/utils/channelInstanceLabel.ts`:** **`formatChannelInstanceLabel`** / **`formatChannelTitle`** för läsbara kanalinstansetiketter i import/export (färre upprepningar som samma marknad flera gånger).

### Dokumentation

- **`docs/product-import-columns.md`**, **`docs/SELLO_CHANNEL_FIELD_MAPPING.md`**, **`docs/products-image-hosting-follow-up.md`:** uppdaterat mot kolumn- och flödesändringar.

### Tester

- **`server/__tests__/productMediaService.test.js`:** utökade fall.
- **`server/__tests__/importProductRowMapper.test.js`:** uppdaterat efter borttagen **`channelSpecificJson`** / **`categories`**.

### Övrigt

- **`.cursor/rules/agent-execution.mdc`:** förtydligande om Neon-migrationer efter ny SQL-fil.
- **`.cursor/TODO-potential-catalog-i18n.md`**, **`.cursor/todo-image_hosting.md`**, **`.cursor/todo-image_hosting_part_2_custom_domain.md`:** interna uppföljningsanteckningar.

## 2026-04-14 – Produkter, Sello/Woo, lagerhistorik, UI och bygg

### Sello-import och WooCommerce-kanalöverskridningar

- **Woo-instansidentifierare:** Vid import från Sello API skickas för `channel === 'woocommerce'` **`String(channel_instances.id)`** till `upsertChannelOverride` (samma semantik som filimportens kolumnprefix `woocommerce.<numerisktId>.*`). Tidigare användes `instance_key`, vilket inte matchade `upsertChannelOverride`-vägens lookup mot **`channel_instances.id`** (`bigint`), så pris, kategori och övriga Woo-specifika fält kunde utebli i **`channel_product_overrides`**.
- **Store- och kampanjpris:** `getSelloStorePriceForInstance` och `getSelloCampaignPriceForInstance` läser efter språk/marknad även **versalerade marknadsnycklar** (`SE`, `DK`, …) i Sello `prices`-data, i linje med `getSelloRegularPriceForInstance`, så t.ex. Merchbutik/store-priser inte tappas när payload använder stora bokstäver.

### Produkter: modell, export och media

- **`plugins/products/model.js`**, **`controller.js`**, **`routes.js`**, **`selloModel.js`**, **`importColumnReference.js`**, **`productMediaService.js`:** utökad affärslogik (bl.a. lagerhändelser, Sello-historik vid import, exportstöd).
- **Produktexport:** `plugins/products/productExportBuilder.js`, `plugins/products/exportColumnReference.js`; klient **`ProductExportPage.tsx`**, **`productsApi.ts`**, **`ProductContext.tsx`**, **`products.ts`**.

### Databas (migrationer 091–094)

- **`091-product-stock-events.sql`:** tabell **`product_stock_events`** (tidigare/on-hand kvantitet, källa, tidsstämpel) med index per produkt.
- **`092-prune-product-stock-events-per-product.sql`:** rensning av befintliga rader till max **50** per produkt (första retention-steget).
- **`093-product-stock-events-cap-100.sql`:** höjd retention till **100** rader per produkt (`ProductModel.MAX_STOCK_EVENTS_PER_PRODUCT`).
- **`094-product-sello-import-history.sql`:** tabell för **Sello-produkthistorik** (`/v5/products/{id}/history`) vid import — händelsetyp, kanal, orderreferens, saldo m.m. för tidslinje/statistik.

### Klient: layout, produkter, ordrar, analytics

- **App-shell:** `ContentToolbar`, `ContentHeader`, `ContentLayoutContext`, `MainLayout`, `Sidebar`, `TopBar`, `panelRendering`, `App`, `appCurrentPageStore` — verktygsrad, rubriker och panelrendering.
- **Produkter:** `ProductList`, `ProductForm` (omfattande uppdateringar).
- **Ordrar:** `OrdersList`, `ordersApi` (förenklad klient och borttag av oanvänd backend-yta i **`plugins/orders/*`**).
- **Analytics:** `AnalyticsList`, `AnalyticsContext`, ny **`datePresets.ts`**.
- **Kanaler:** `ChannelsView` (fel- och instanslista; **React hooks** flyttade före `item`-guard så `eslint`/`react-hooks/rules-of-hooks` uppfylls). **Woo (server):** **`plugins/woocommerce-products/controller.js`** — t.ex. **GTIN/EAN** som `global_unique_id` och `meta_data`, samt **`short_description`** från `wooTexts` istället för auto-trunkerad `description`.

### Server och lagring

- **`server/core/services/storage/b2ObjectStorage.js`**, **`server/core/lists/listsModel.js`:** kompletteringar.

### Tester

- **`server/__tests__/productMediaService.test.js`:** utökade fall.
- **Nya:** **`server/__tests__/b2ObjectStorage.test.js`**, **`server/__tests__/productExport.test.js`**.

### Bygg

- **`package.json`:** byggsteg **`copy:artifacts`** via **`scripts/copy-build-artifacts.js`**.

## 2026-04-08 – Produktmedia

### B2 custom domain: root-path-URL:er och nya object keys (nya uploads)

- **`B2_PUBLIC_BASE_URL`:** Om basen **inte** börjar med `/file/` (t.ex. `https://media.syncer.se`) normaliseras den till **root-path** — ingen injektion av `/file/{B2_BUCKET}`. Publika länkar blir `https://media.syncer.se/<object-key>` (samma bucket bakom Cloudflare/custom domain som i B2).
- **Nya B2-nycklar** (endast nya uppladdningar, ingen backfill):  
  `{tenantId}/products/{productId}/{variant}/{position}_{assetId}_{hash}.{ext}`
  - utan prefixet `tenants/`
  - `productId` i path: **`sello-<id>` → `<id>`** via `normalizeProductIdForStorageKey` (endast lagringspath).
  - **Sello-import innan produktrad finns:** `pendingScope` använder bara Sello-id (inte `sello/…` som tidigare blev `sello-<id>` i path); pending-segment normaliseras också med samma `sello-`-strippning om `/` ersätts med `-`.
- **`objectKeyFromB2FileUrl`:** kan härleda samma object key från **Friendly URL** (`/file/<bucket>/…`) och från **custom domain** (`/<key>`), så reconcile/delete fortsätter fungera vid blandade URL-format.
- **Tester:** `server/__tests__/b2ObjectStorage.test.js`; utökade fall i `server/__tests__/productMediaService.test.js`.

### Strikt delete-policy, felkoder och loggning

#### Delete-policy (B2 ↔ DB)

- **Strikt per produkt:** produkt tas **inte** bort ur databasen om associerad media inte kunde raderas från B2.
- **Bulk delete är partial:** `DELETE /api/products/batch` raderar de produkter vars media-delete lyckas och returnerar en tydlig fel-lista för resten.
  - Se ny doc: **`docs/products-bulk-delete.md`**

#### Felkoder (PRODUCT*MEDIA*\*) och tydligare kontrakt

- **`PRODUCT_MEDIA_MISSING_FOR_CHANNEL`:** används när CDON/Fyndiq saknar giltig huvudbild (t.ex. missing/invalid `main_image`).
- Standardiserad error-wrapping i produktmedia så att mediafel alltid får en tydlig `PRODUCT_MEDIA_*`-kod vid delete/fetch/process/upload.

#### Loggning (utan credential-läckage)

- Strukturerade loggar för:
  - fetch start/success/fail
  - upload start/success/skipped (reused)
  - preview/thumbnail generation
  - delete start/success/fail (inkl. counts + productId)
  - Woo export: valda bild-URL:er (original)

#### Tester (delete / kanaler)

- Nya/utökade tester för:
  - strict delete och partial bulk delete (**`server/__tests__/productDeletePolicy.test.js`**, samt nya fall i **`productMediaService.test.js`**)
  - kanal-validering som bär `PRODUCT_MEDIA_MISSING_FOR_CHANNEL` (**`productMediaChannels.test.js`**)

## 2026-04-04 – Produktmedia: asset-modell (original/preview/thumbnail), batch-pipeline, kanaler

### Datamodell och lagring

- **`server/migrations/090-product-media-asset-metadata.sql`:** utökar **`product_media_objects`** med bl.a. **`position`**, **`content_hash`**, **`mime_type`**, **`size_bytes`**, **`width`**, **`height`**, **`variants`** (JSONB).
- **`plugins/products/productImageAssets.js`:** normalisering av **`ProductImageAsset`**, hjälp för original/preview/thumbnail-URL:er och **`collectAssetVariantDeleteTargets`** för B2-radering.
- **`server/core/services/storage/imageProcessingService.js`:** **`sharp`** – metadata, SHA256-hash, **`preview`** (WebP, max 500×500) och **`thumbnail`**.
- **`server/core/services/storage/mediaAssetService.js`:** skapar hostade assets (uppladdning av alla varianter).
- **`server/core/services/storage/b2ObjectStorage.js`:** deterministiska nycklar via **`buildAssetVariantKey`**, **`VersionId`** vid upload, **`deleteObjects`** med versionsmedveten radering (**`ListObjectVersionsCommand`**) för versionerade buckets.

### Service och produktmodell

- **`plugins/products/productMediaService.js`:** **`ensureProductMedia`**, hash-baserad dedupe, **`reconcileAttachedProductMedia`** mot asset-ID/nycklar/URL:er; Sello-flöde via **`ensureHostedSelloMedia`**; skydd mot felaktig återanvändning av **`assetId`** från annan produkt.
- **`plugins/products/productMediaObjectModel.js`**, **`plugins/products/model.js`**, **`plugins/products/controller.js`:** sparad **`images`** som JSONB med asset-objekt; create/update/import via samma media-pipeline.

### Batch och import

- **`plugins/products/batchSyncJobRunner.js`:** batch med **`mainImage`** / **`images`** går via **`ensureProductMedia`** och **`reconcileHostedProductMedia`** per produkt (export **`patchTouchesManagedMedia`**, **`buildBatchPatchWithHostedMedia`** för tester).

### Kanalexport

- **`plugins/cdon-products/mapToCdonArticle.js`**, **`plugins/cdon-products/controller.js`**, **`plugins/fyndiq-products/mapToFyndiqArticle.js`**, **`plugins/woocommerce-products/controller.js`:** läser **`original.url`** från sparade assets (inte preview).

### Klient

- **`client/src/plugins/products/types/products.ts`**, **`ProductContext.tsx`**, **`productsApi.ts`**, **`ProductForm.tsx`:** **`ProductImageAsset`**, preview i galleri, klick öppnar original, tydligare fel vid upload/save och vid batch med delvisa fel.

### Dokumentation och tester

- **`docs/products-payload-and-channel-export-fields.md`:** **`images`** som sparad asset-lista, inte enbart URL-lista.
- **`server/__tests__/productMediaService.test.js`**, **`productMediaChannels.test.js`**, **`productMediaWoo.test.js`**, **`batchProductMedia.test.js`**.

### Beroenden

- **`package.json` / `package-lock.json`:** **`sharp`** (och tillhörande låsning).

---

## 2026-04-03 – Hostade produktbilder (Backblaze B2), Sello-import, media-DB, CLI-env

### Lagring (B2)

- **`server/core/services/storage/b2ObjectStorage.js`:** S3-klient mot B2 med **`forcePathStyle: true`** (path-style mot `B2_ENDPOINT`). Normalisering av **`B2_PUBLIC_BASE_URL`** så bucket i `/file/{bucket}` stämmer med **`B2_BUCKET`**. Hjälpfunktion **`objectKeyFromB2FileUrl`** för att plocka objektnyckel ur Friendly URL.
- **Dokumentation i kod:** publika `<img>`-URL:er kräver att bucket tillåter **anon läsning**; annars 403 trots lyckad uppladdning.

### Produktmedia (service + DB)

- **`plugins/products/productMediaService.js`:** `ensureHostedSelloMedia` hämtar Sello-URL:er, laddar upp till B2, skapar rader i **`product_media_objects`**. **`mainImage`** = första hostade URL; **`images`** = endast **extrabilder** (`slice(1)`), så huvudbild dupliceras inte i `images`. **`allHostedUrls`** används internt till **`reconcileAttachedProductMedia`** (behåll/radera enligt full lista).
- **`reconcileAttachedProductMedia` / `rowMediaUrlMatchesKeep`:** matchar även på **objektnyckel** om Friendly URL skiljer sig (t.ex. olika `f003`/`f004`) så felaktiga B2-raderingar och hide-markers undviks.
- **Parallella uppladdningar** (begränsad samtidighet, standard 8): env **`PRODUCT_MEDIA_UPLOAD_CONCURRENCY`** (max 12 i kod).
- **`plugins/products/productMediaObjectModel.js`**, migration **`089-product-media-objects.sql`**.

### Sello-import & controller

- **`plugins/products/controller.js`:** `getSelloImageUrls` — unwrap av nästlade **`data`**, protokoll-relativa `//…` → `https:`, refetch av full produkt om listan saknar bild-URL:er. **`upsertSelloProductWithHostedImages`** skickar **`allHostedUrls`** till reconcile. Import-svar per rad: **`media: { uploaded, reused, failed }`**.

### Async filimport (referens)

- Migration **`088-product-import-jobs.sql`**, workers (`importJobRunner`, `importParse`, `importStorage`, `importProductRowMapper`, `importColumnReference`), tester och klientrelaterade produktfiler i samma leverans.

### CLI-scripts

- **`scripts/sget.js`**, **`import-single-sello-product.js`**, **`sync-all-sello-products.js`:** laddar env som API: **`.env`** först, sedan **`.env.local`** med **`override: true`**. `sget` skriver kort B2-statistik per rad.

### Tester

- **`server/__tests__/productMediaService.test.js`**, **`importProductRowMapper.test.js`**, **`validateImageUrl.test.js`**.

### Övrigt dokumentation (API-referens)

- Tillagda/uppdaterade filer under **`docs/API-DOCS/`** (PostNord m.m.) och **`docs/products-*.md`** där relevant.

---

## 2026-04-02 – Full produktimport (Excel/CSV): fältparitet, bild-URL, `channelSpecificJson`, lista

- **Import:** `plugins/products/importProductRowMapper.js` mappar basfält (bl.a. inköp, dimensioner, lookup-id, bilder, kategorier), utökade per-marknadstexter (SEO, bulletpoints), valfri kolumn **`channelSpecificJson`** (whitelistade nycklar) med **djup merge** mot befintligt `channelSpecific`.
- **Bilder:** `server/core/utils/validateImageUrl.js` — endast `http`/`https`, validering via **HEAD** / **GET** och `Content-Type` `image/*`; ogiltig rad → `invalid_main_image` / `invalid_image_url`.
- **Lista:** kolumn **`listId`** → efter lyckad create/update anropas `model.setProductList` (samma som `PUT /api/products/:id/list`).
- **Kanalpriser:** punktnotation / `parseSelloOverridesFromRow` → **`upsertChannelOverride`** även när **`issello` ≠ 1** om override-kolumner finns.
- **Dokumentation:** `docs/product-import-columns.md`; kolumnreferens i `plugins/products/importColumnReference.js` uppdaterad.

## 2026-04-02 – WooCommerce texter per butik; produktimport till `textsExtended`; importvy (routing)

### WooCommerce

- **Migration `087-woocommerce-instance-text-market.sql`:** sätter `channel_instances.market = 'se'` för Woo-rader där `market` saknas (tom sträng inkluderad).
- **Instans:** kolumn **`market`** (API **`textMarket`**) styr vilken **`channelSpecific.textsExtended[se|dk|fi|no]`** som matar Woo **name**, **description** och valfri SEO i export. Ingen fallback till `products.title` / huvudbeskrivning.
- **Export:** validering (`validateWooExportTextsForWoo`); variabla produkter använder samma texter för parent; **`mapProductToWoo`** bygger kundtext från **`wooTexts`** ( vald marknad ).
- **API:** POST/PUT `/api/woocommerce-products/instances` med valfri **`textMarket`** (`se`|`dk`|`fi`|`no`).
- **Klient:** `WooSettingsForm` (marknadsval), `WooCommerceContext`, `WooExportPanel` (edit), typer och API.

### Produkter – CSV/XLSX-import (icke-Sello)

- Kolumner **`title.se`**, **`description.se`**, samma för **`.dk` / `.fi` / `.no`** (punkt i rubrik) mappas till **`channelSpecific.textsExtended`**. Generiska **`title`** / **`description`** ignoreras.
- **Standard** för katalog **`title`** / **`description`** och **`textsStandard`:** **`se`** om kolumnen **`textsStandard`** saknas; valfri kolumn kan sätta t.ex. **`fi`** (då krävs kompletta texter för den marknaden). Vid fel: **`standard_market_texts_incomplete`** (med **`market`** i svaret där relevant).
- **Importmall (kanaler):** `plugins/channels/model.js` **`buildImportTemplateCsv`** – kolumner per land + **`textsStandard`**.

### Produkter – async CSV/XLSX-import (Sello-lik)

- **Migration `088-product-import-jobs.sql`:** tabell `product_import_jobs` (status, matchnyckel, räknare, `detected_headers`, `storage_path`). Max **5** sparade jobb per tenant (äldre rader + filer rensas vid ny insert).
- **API:** POST `/api/products/import` svarar **202** med `jobId`; GET `/api/products/import/jobs/:jobId` (polling), GET `/api/products/import/history`, GET `/api/products/import/history/:jobId/file` (nedladdning), GET `/api/products/import/column-reference` (allmänt / Sello / per kanalinstans).
- **Matchnyckel:** `sku` | `id` | `gtin` | `ean` (dubblett GTIN/EAN → **lägsta id**). **Worker:** `importJobRunner.js` under `productImportLock`.
- **Klient:** `ProductImportPage` – matchnyckel, live-räknare via polling, historik med nedladdning, kolumnreferens (collapsible), tabeller mappar och kanalinstanser.

### Övrigt (samma release)

- **plugins/products/model.js**, **batchSyncJobRunner.js**, **cdon/fyndiq mapTo\*Article**, **ProductForm** / **ProductContext** / **AppContext:** tillhörande justeringar i samma branch.
- **Klient:** produktimport flyttad från modal till **dedikerad vy** **`products-import`** (knappen **Import** på produktlistan öppnar vyn). Routning: **`NavPage` `products-import`**, **`panelRendering`** → **`ProductImportPage`**, **`registerAppNavigate`** i **`MainLayout`**, **`isEcommerceCatalogBootstrapPage`**, sidtitel/ikon i **`App`** / **`TopBar`**, **`Sidebar`** markerar **Products** som aktiv på importsidan.

---

## 2026-03-29 – Homebase v3.2.2: batch-synk (async jobb), Synkstatus, `expectedUpdatedAt`

**Release:** npm-version **3.2.2**, branch **Homebase-V3.2.2**.

**Revertpunkt (före batch-redigering / batch-synk-jobb):** Sista commit **utan** denna implementation är **`3b80fe0`** (_Produkter: status till salu/pausad, migration 085, batch max 250; orders counter & Woo-status_). Vill du tillbaka till läget innan batch-redigeringen och tillhörande jobb/köer: `git checkout 3b80fe0` eller skapa en branch därifrån (`git switch -c backup-pre-batch-edit 3b80fe0`).

### Async batch & kanaler

- **PATCH `/api/products/batch`** och **POST `/api/products/batch/sync-job`** skapar nu ett **jobb** (svar **202** med `jobId`). Worker skriver **DB per produkt** (radlås vid batch-patch), därefter **kanaler** (CDON quantity i bulk om 50, Fyndiq bulk om 200, Woo sekventiellt i jobbet). **GET `/api/products/batch/sync-jobs`** och **GET `.../sync-jobs/:jobId`** för status/historik (max **50** jobb per tenant, äldsta rensas vid insert).
- **Migration `086-product-batch-sync-jobs.sql`:** tabell `product_batch_sync_jobs`.
- **Mutex:** ett aktivt batch-jobb per tenant tills kanalfasen är klar; **409** `SYNC_ALREADY_IN_PROGRESS` / `PRODUCT_IMPORT_IN_PROGRESS` vid import.
- **plugins/products/stockPushQueue.js:** batch-lagerpush köas före order-lagerpush.
- **plugins/orders/controller.js:** quantity-uppdatering med **lock_timeout** + backoff; misslyckade lås loggas som snabb jobb-rad (`order_stock`) för Synkstatus.

### UI

- **Synkstatus** under Kanaler: **client/src/plugins/channels/components/BatchSyncStatusModal.tsx** (+ knapp i `ChannelsList`).
- **Single save:** klient skickar **`expectedUpdatedAt`**; server **`UPDATE … WHERE updated_at = ?`** → **409 CONFLICT** vid konflikt.
- **Batch-redigering i produktpanelen:** obligatorisk **förhandsgranskning** (modal) före spara; **dirty-only** mot inläst snapshot för alla fält som serverns batch-patch stöder (bl.a. status, texter, pris/lager, media-listor, detaljer, `channelSpecific`). Död **mini-batch-modal** i `ProductList` bort; knappen **Batch-redigera…** med tydligare hjälptext.

### WooCommerce lagerpush

- **`syncStock`:** vid **429** eller **5xx** upp till **5** försök med **Retry-After** eller exponentiell backoff (max 60s / 120s vid header).

### Tester

- `server/__tests__/stockPushQueue.test.js` – ordning batch före order i kön.

---

## 2026-03-28 – Produkter: status till salu/pausad, batch 250, orders counter & Woo-mappning

### Produktstatus

- **Produktstatus** är nu endast **`for sale`** (till salu) eller **`paused`** (pausad). Tidigare värden som draft/archived normaliseras bort; **server/migrations/085-products-status-for-sale-paused.sql** sätter ogiltiga rader till `for sale`.
- **client/src/plugins/products/types/products.ts:** `ProductStatus`, `normalizeProductStatus`.
- **client/src/plugins/products/components/ProductForm.tsx:** Fält **Status** (NativeSelect) med Till salu / Pausad.
- **client/src/plugins/products/context/ProductContext.tsx:** Validering och normalisering mot de två statusvärdena.
- **plugins/products/model.js**, **plugins/products/routes.js:** API-validering och persistens med samma två värden.
- **plugins/woocommerce-products/controller.js:** `mapStatusToWoo` / `mapWooStatusToHomebase` mappar `paused` ↔ Woo **private**, övrigt till **publish** / **for sale** (ingen draft-läge kvar i Homebase-status).

### Batch-operationer

- **plugins/products/controller.js**, **plugins/products/routes.js:** Max **250** id per batch (PATCH/DELETE m.m.), i linje med list-sidans tak (`PRODUCTS_BATCH_MAX_IDS`).

### Orders

- **plugins/orders/model.js:** `allocateOrderNumbers` använder inte längre kolumnen `id` (saknas efter multitenant); uppdatering sker via **`ctid`** mot högsta `next_number`. Justerade parameterindex i upsert av ordrar så att antal placeholders stämmer.

### Tester

- **server/**tests**/phase2ContractValidators.test.js:** Förväntan uppdaterad till `missing_categories` för Fyndiq-kategoriissue.

---

## 2026-03-27 – Homebase v3.2.1: kanallänkar, exportfixar och script-tenant-context

### Produktlänkar per kanal

- **plugins/channels/model.js:** `getProductChannelLinks` returnerar nu även `storeUrl` för WooCommerce och filtrerar CDON/Fyndiq till giltiga storefront-id (UUID/hex-slug), utan numeriska fallback-id.
- **client/src/plugins/channels/api/channelsApi.ts:** Typstöd för `storeUrl` i channel-links.
- **client/src/plugins/products/hooks/useProductChannelLinks.ts:** Robust URL-byggare: normaliserar `storeUrl`, bygger Woo-länk som `?p=<externalId>`, och använder strikt slug-logik för CDON/Fyndiq (endast giltiga article-id).

### Produktexport och overrides

- **client/src/plugins/products/components/ProductForm.tsx:** Nyvalda CDON/Fyndiq-targets (och aktivering av override-rad) triggar full export i stället för `update_only_strict` så nya marknader kan skapas korrekt.
- **plugins/products/controller.js:** Fixat parameterindex i upsert för `channel_product_overrides.category` (`$12` i stället för felaktig `$13`).
- **plugins/cdon-products/controller.js**, **plugins/fyndiq-products/controller.js:** Tydligare loggning för "no products/articles to send" och avslutad export; Fyndiq-map sparar inte längre SKU som `externalId` vid fallback.
- **plugins/cdon-products/mapToCdonArticle.js:** Mindre justeringar i artikelmappning för exportflödet.

### Produktlistor och scripts

- **plugins/products/model.js:** `setProductList` använder explicit `user_id` för `product_list_items` delete/insert i multitenant-flödet.
- **scripts/scriptTenantContext.js:** Ny helper som skapar syntetisk tenant-aware `req` för CLI-scripts via `TenantContextService` + `applyTenantContextToRequest`.
- **scripts/sget.js**, **scripts/sello-fetch-one.js**, **scripts/import-single-sello-product.js:** Migrerade till `scriptTenantContext` i stället för egen bootstrap/session-kod.

---

## 2026-03-26 – Multi-tenant: schema-/DB-isolering, kontrollplan, borttag av `user_id` i tenantdata

**Release:** npm-version **3.2.0**, branch **Homebase-V3.2.0**.

Översikt: Tenantdata isoleras genom **routing** (PostgreSQL `search_path` mot rätt schema lokalt, eller separat anslutningssträng per tenant i Neon), inte genom `user_id`-kolumner på varje rad i plugin-tabeller. **Public** (`DATABASE_URL`) bär identitet, medlemskap och plugin-rättigheter; **tenant** bär affärsdata.

### Arkitektur och modell

- **LocalTenantProvider:** Ett schema per tenant (`tenant_<ownerUserId>` eller motsvarande namnkonvention), `SET search_path` / `SET LOCAL search_path` så att `SELECT * FROM products` implicit är inom rätt tenant utan `WHERE user_id = …`.
- **NeonTenantProvider:** En databas (eller anslutning) per tenant; isolation är fysisk separation, inte radfilter.
- **Kanonical ägarskap:** `public.tenants.owner_user_id` pekar på plattformsanvändaren som äger tenanten. **Superuser** kan byta aktiv tenant via admin-API; session bär `tenantId`, `tenantRole`, `tenantOwnerUserId` (ägarens user-id för den aktiva tenanten), inte en separat “current tenant user id” som duplicerar `user.id` för vanliga användare.
- **Database-lager:** `PostgreSQLAdapter` / `Database.get(req)` **skriver inte om** SQL med `AND user_id = …`; tenantgränsen följer av vilken pool / vilket schema som är aktivt. Plugin-kod ska inte förlita sig på magisk injektion av `user_id` i tenantqueries.

### Kontrollplan (public schema)

- **`public.tenants`:** Koppling tenant ↔ ägare, ev. Neon-URL m.m. Kolumnen **`user_id` på `tenants` är borttagen** (migration `084-drop-user-id-from-public-tenants.sql`); **`owner_user_id`** är den enda ägarreferensen.
- **`public.tenant_memberships`:** Vilken plattformsanvändare (`user_id` här = FK till `users`, medlemskapsrad) som tillhör vilken tenant och med roll (`admin`/`editor`/…).
- **`public.tenant_plugin_access`:** Ersätter tidigare per-användar-modell; plugin-tillgång styrs per **tenant** (och eventuellt roll), inte via gammal `user_plugin_access`-semantik för tenantdata.

**Viktigt:** `user_id` finns kvar i **public** där det är korrekt semantiskt (t.ex. `user_settings.user_id`, `activity_log.user_id`, `user_mfa`, `tenant_memberships.user_id`). Det är **inte** samma sak som den gamla “tenantrad = filtrera på user_id”-modellen i plugin-tabeller.

### Session, middleware och typer

- **`express-session` / `SessionData`:** `tenantId`, `tenantConnectionString` (Neon), `tenantRole`, `tenantOwnerUserId`. Fältet **`currentTenantUserId` är borttaget** (var förvirrande och redundant).
- **`TenantContextService` / `resolveTenantForUser`:** Enhetlig upplösning av tenant från inloggad användare eller admin-byte; syntetiska `req` (scheduler, intake) sätter samma fält utan legacy-alias.
- **`packages/core` `Context`:** `getTenantUserId` dokumenterat som **tenantägarens** user-id (`tenantOwnerUserId`), inte “rad-user_id” i tabeller.
- **`server/types/express.d.ts`:** Uppdaterade kommentarer och borttag av `currentTenantUserId`.
- **`server/core/routes/admin.js`:** Vid lyckat tenant-byte returneras **`tenantOwnerUserId`** (tidigare `tenantUserId`) i JSON och loggfält, i linje med sessionfält.

### Klient

- **`AppContext` / `getMe`:** Aktiv tenant spåras som **`activeTenantId`** (svar från API med `tenantId`), inte `currentTenantUserId`.
- **`TopBar`:** Markerar vald tenant mot `activeTenantId`.

### Databasförändringar (migrationer, urval)

- **`081-tenant-memberships-and-plugin-access.sql`:** Inför medlemskap och `tenant_plugin_access`; idempotent backfill `owner_user_id` från legacy `tenants.user_id` endast om kolumnen fortfarande finns (så omkörning efter `084` inte fallerar).
- **`082`–`083`:** Tar bort `user_id` från kärn- och övriga tenant-tabeller (dynamiska `DROP COLUMN … CASCADE` där beroenden krävs, nya index utan `user_id`).
- **`084-drop-user-id-from-public-tenants.sql`:** Tar bort `user_id` från `public.tenants` efter att `owner_user_id` är kanonisk.

Singleton-upserts och constraints som tidigare använt `ON CONFLICT (user_id)` har uppdaterats till tenant-scoped nycklar (t.ex. per `cache_key` eller en rad per tenant-schema).

### Drift: `run-all-migrations` och idempotens

- **`scripts/run-all-migrations.js`:** Historiktabeller (`hb_public_migration_history` / `hb_migration_history`) så att **samma migration inte körs om** i onödan; **bootstrap** av historik för befintliga scheman där `user_id` redan är borttagen men gamla migrationsfiler annars skulle försöka skapa/alter:a bort dem.
- Syfte: `npm run migrate:all` ska vara **säker att köra upprepade gånger** mot redan migrerade miljöer utan att gamla SQL med `user_id` kraschar.

### Hjälpjobb och modeller (exempel)

- **`scripts/category-cache-job.js`**, **`server/core/categoryCacheScheduler.js`:** Tenantlista via `owner_user_id`; kategori-cache utan `user_id` på rader i tenant-schema.
- **`plugins/orders/orderSyncScheduler.js`:** Itererar tenants med `tenant_plugin_access`; syntetisk request utan `currentTenantUserId`.
- **`plugins/shipping/model.js`:** `requireTenantId(req)` i stället för missvisande `getUserId` som returnerade tenant-id.
- **`server/core/lists/listsModel.js`**, **`plugins/products/lookupsModel.js`:** `requireTenantId` / `getTenantId` för tydlig namnsättning.

### Dokumentation och terminologi

- Arkitektur- och säkerhetsdokument uppdaterade: **tenant routing / schema-isolering** i stället formler som “automatic `user_id` filtering”; exempel-SQL i guider justerade mot `tenant_plugin_access` och utan felaktig `WHERE user_id` på tenantdata där det inte längre gäller.
- **`docs/CHANGELOG.md`**, **`LESSONS_LEARNED`**, **`MIGRATIONS_AND_TENANTS`**, m.fl.:\*\* Konsekvent beskrivning av auth DB vs tenantdata.

### Borttagna gamla debug/testskript

Engångs- och lokala hjälpskript som inte längre behövs är borttagna från `scripts/` (t.ex. `check-channel-map.js`, `debug-sello-woo-map.js`, `debug-product-channel-links.js`, `debug-overrides-for-product.js`, `debug-sello-integrations-per-product.js`, `debug-channel-instances.js`, `fetch-fyndiq-article-properties.js`, `run-quantity-push-test.js`, `test-push-109512000.js`, `list-products-in-db.js`, `run-phase1-pilot-2-products.js`, `test-status-filtering.js`). **`SELLO_WOO_MAP_FIX.md`** och **`PRODUCT_CHANNEL_LINKS_INVESTIGATION.md`** pekar på SQL mot tenant-schema i stället för borttagna skript. Drift kvar: `run-all-migrations.js`, `setup-database.js`, övriga migrationsrelaterade npm-script i `package.json`.

---

## 2026-03-27 – Tenant/migration: public-schema, SET LOCAL, import-renumber, tenant-guards

### Migrationer och `search_path`

- **server/migrations/policy.js:** Gemensam lista över public-only migrationer; `scripts/run-all-migrations.js` kör varje migration i egen transaktion med **`SET LOCAL search_path`** (public eller tenant-schema) i stället för sessionslång `SET search_path`.
- **scripts/run-all-migrations.js:** Använder `policy.js` för att filtrera public vs tenant-migrationer.

### Huvuddatabas (public) – explicit kvalificering

- **server/core/routes/auth.js**, **server/core/routes/admin.js**, **server/core/routes/settings.js** m.fl.: SQL mot auth-tabeller kvalificerad som **`public`** (t.ex. `public.users`, `public.tenant_plugin_access`) för att undvika felaktig upplösning vid varierande `search_path`.
- **Diverse `scripts/*.js` och SQL under `scripts/db/manual/`:** Samma mönster där mot huvuddatabasen.

### Tenant-plugins (CDON/Fyndiq/Woo)

- **plugins/cdon-products/model.js**, **plugins/fyndiq-products/model.js**, **plugins/woocommerce-products/model.js:** Tenant-queries (`tenant_*`) körs i transaktion med **`SET LOCAL search_path`** och validering av schema-namn där det behövs.

### Orders

- **plugins/orders/orderSyncScheduler.js:** Läser `public.tenant_plugin_access`; **en retry** vid tillfälligt fel på tenantlistan så inte hela ticken kastas.
- **client/…/OrdersList.tsx:** Vid import från alla kanaler: `pullOrders(..., renumber: false)` per kanal, därefter **ett** `ordersApi.renumber()` med fel synligt i import-resultatet om det misslyckas.
- **client/…/cdonApi.ts**, **fyndiqApi.ts**, **woocommerceApi.ts:** `pullOrders` tar valfri `renumber?: boolean`.

### Verktyg och repo

- **scripts/check-tenant-guards.js** + **`npm run check:tenant-guards`:** Statisk kontroll (förbjuder `SET search_path TO` utanför allowlist, varnar för oanmäld auth-SQL från tenant-kod).
- **.gitignore:** `Homebase-V3.5/` ignoreras (lokal parallell träd, inte repo-innehåll).

---

## 2026-03-26 – Orders: Product-ID i UI, channel-map backfill, renumber efter sync

### Orders/kanaler – produktkoppling och nummerordning

- **server/migrations/080-backfill-order-items-product-id-from-channel-map.sql:** Backfill som fyller `order_items.product_id` från `channel_product_map.external_id` för CDON/Fyndiq/Woo där match finns.
- **plugins/orders/model.js:** Ny `loadProductIdsByChannelExternalId(req, channel, externalIds, instanceId)` som läser produktkoppling via `channel_product_map` istället för numerisk SKU-heuristik.
- **plugins/cdon-products/controller.js**, **plugins/fyndiq-products/controller.js:** Orders-normalisering använder nu `loadProductIdsByChannelExternalId(..., 'cdon'/'fyndiq', ...)`.

### Sync-flöde

- **plugins/orders/orderSyncService.js:** Kör `renumberOrderNumbersByPlacedAt` en gång efter lyckad slot-claim/sync-runda.
- **plugins/cdon-products/controller.js**, **plugins/fyndiq-products/controller.js**, **plugins/woocommerce-products/controller.js:** Tvingar renumber efter import/sync i respektive endpoint.
- **client/src/plugins/orders/components/OrdersList.tsx:** Lokal `ordersApi.renumber()` efter sync/import borttagen; renumber sker nu server-side.

### Klient – visning

- **client/src/plugins/orders/components/OrderDetailInline.tsx**, **client/src/plugins/orders/components/OrdersView.tsx:** Ny kolumn **Product-ID** i orderradstabeller.

---

## 2026-03-25 – Order sync scheduler, manuell Sync orders, force quick-sync

### Server – periodisk order-synk

- **plugins/orders/orderSyncScheduler.js:** Scheduler som för alla tenants med `tenant_plugin_access` (orders, enabled) kör `orderSyncService.runSync` med syntetisk `req` (samma tenant-resolution som middleware via **server/core/helpers/resolveTenantForUser.js**). Intervall = `SYNC_INTERVAL_MINUTES` (15), första körning efter 10 s, sedan var 15:e minut. Fel per tenant loggas utan att stoppa övriga.
- **server/core/routes/index.js:** `startOrderSyncScheduler(pool)` startas vid serverstart (samma mönster som FX och category-cache).
- **plugins/orders/orderSyncService.js:** Exporterar `SYNC_INTERVAL_MINUTES` för scheduler.
- **server/migrations/079-orders-sync-fingerprint-and-channel-map-index.sql:** Index/stöd för orders sync-data och snabbare uppslag.

### API – force quick-sync

- **plugins/orders/controller.js:** `POST /api/orders/sync` accepterar `force=true` (query eller body) och hoppar då över `shouldRunQuickSync`; `locked` gäller fortfarande.

### Klient

- **client/…/ordersApi.ts:** `sync({ force?: true })` skickar body `{ force: true }` vid behov.
- **client/…/OrdersList.tsx:** Auto-synk vid öppning borttagen. Ny knapp **Sync orders** som anropar `sync({ force: true })` med samma polling/renumber/reload som tidigare.

---

## 2026-03-14 – Navigering-store, analytics-gating, cache/fetch-optimering

### Navigering och analytics bootstrap

- **client/src/core/navigation/appCurrentPageStore.ts:** Ny sync-store för aktuell sida i appen.
- **client/src/App.tsx:** Publicerar aktuell sida till store via `useLayoutEffect` för korrekt ordning mot providers.
- **client/src/plugins/analytics/context/AnalyticsContext.tsx:** Hämtar analytics bara när aktiv sida är bootstrap-sida för analytics; reset när sida/auth inte matchar.

### API/cache-förbättringar i klient

- **client/src/plugins/channels/api/channelsApi.ts:** Ny cache för channels summary + cache-invalidering vid mutationer.
- **client/src/plugins/files/context/FilesContext.tsx:** Separerar bootstrap-laddning (folders/cloud settings) från item-fetch vid mappbyten.
- **TopBar och API-klienter (CDON/Fyndiq/Products/Woo/AppContext):** Stabiliserade fetch-flöden och mindre onödiga anrop.

---

## 2026-03-14 – Delad CSRF-klient, API-klientförbättringar, category-cache-job

### Delad CSRF-hantering i klienten

- **client/src/core/api/csrf.ts:** Ny central CSRF-helper med delad token/promise och reset-funktion.
- **API-klienter uppdaterade:** Channels, Products, WooCommerce, CDON och Fyndiq använder nu delad CSRF-hämtning i stället för lokala varianter.

### API-förbättringar och produkter

- **client/src/core/api/AppContext.tsx:** Små justeringar i API-anrop/flöden.
- **client/src/plugins/products/components/ProductForm.tsx, useProductChannelLinks.ts:** Förbättringar kring produktkanallänkar och formulärintegration.

### Server/script

- **scripts/category-cache-job.js:** Uppdaterat jobbflöde för kategori-cache.

---

## 2026-03-14 – TypeScript-fixar (npm run check)

### RichTextEditor (TipTap)

- **setContent:** Andra argumentet `false` → `{ emitUpdate: false }` (TipTap v3 API).
- **useEffect cleanup:** Returnerar inte längre Editor från cleanup-funktionen.
- **BubbleMenu:** `tippyOptions` borttagen (finns inte i TipTap v3).

### Övriga typproblem

- **statusDisplay.ts:** Returnerar `String(status)` för garanterad string-typ.
- **shippingApi.ts:** Lokal variabel `token` för korrekt narrowing efter null-check.
- **FilesContext.tsx:** humanSize – explicit variabel `val` för numerisk beräkning.
- **AnalyticsList.tsx:** Tooltip-typer – `payload` optional i nested struktur för Recharts-kompatibilitet.
- **formatters.ts:** Ny typ `BucketRow`, borttagna osäkra casts.

---

## 2026-03-14 – CDON article ID, HTML-dekod, kanaler-modell, produkter

### CDON – article ID för länkar

- **078-channel-product-map-cdon-article-id.sql:** Ny kolumn `cdon_article_id` i `channel_product_map` – CDON URL använder artikel-ID, API använder SKU i `external_id`.
- **plugins/cdon-products, channels/model.js:** Stöd för att spara och använda `cdon_article_id` vid export/länkbyggnad.

### HTML till ren text / dekodning

- **server/core/utils/htmlToPlainText.js:** Ny util – konverterar HTML till plain text och dekoderar entiteter. Används av CDON- och Fyndiq-mappning vid export.
- **client/core/utils/decodeHtmlEntities.ts:** Ny util för visning av produktitel/beskrivning (Sello-import kan innehålla &amp;#x27; etc.). Används i ProductForm, ProductContext, ProductTitleWithLinksHover, AnalyticsList.

### Kanaler, produkter, CDON/Fyndiq/Woo

- **plugins/channels/model.js:** Utökad logik för channel_product_map.
- **plugins/products/controller.js, routes.js:** Justeringar och nya endpoints.
- **plugins/cdon-products, fyndiq-products, woocommerce-products:** Controllers, maps och modeller uppdaterade.
- **scripts/category-cache-job.js:** Justeringar.

### Övrigt

- **server/core/middleware/validation.js:** Ytterligare validering.
- **docs/SELLO_CHANNEL_FIELD_MAPPING.md:** Uppdateringar.

---

## 2026-03-14 – Kanallänkar på hover i produktlistan, ProductView borttagen

### Produktlistan – hover visar kanallänkar

- **client/…/ProductTitleWithLinksHover.tsx, useProductChannelLinks.ts:** Hover på produktitel i listan öppnar en HoverCard med länkar till CDON, Fyndiq och WooCommerce (Sello-format: UUID utan bindestreck, första 16 tecken).
- **client/src/components/ui/hover-card.tsx:** Ny UI-komponent (Radix HoverCard).
- **ChannelsContext, products controller:** Stöd för att föredra Sello-rader i channel_product_map och korrekt URL-byggnad.

### Produkter – ProductView borttagen

- **ProductView.tsx borttagen:** Vy/redigering hanteras via ProductForm och listan; ProductList och ProductContext uppdaterade.

### CDON / Fyndiq – map

- **plugins/cdon-products/mapToCdonArticle.js, plugins/fyndiq-products/mapToFyndiqArticle.js:** Justeringar för kategori/artikel-mappning.

### Dokumentation och script

- **docs/PRODUCT_CHANNEL_LINKS_INVESTIGATION.md:** Beskriver kanallänkar (Sello vs sync), URL-format och nuvarande fix.

---

## 2026-03-14 – Kategori-cache scheduler, CDON/Fyndiq/Woo förbättringar, produkt-UI

### Kategori-cache – schemalagd jobb

- **server/core/categoryCacheScheduler.js:** Ny scheduler som kör category-cache-jobbet för alla tenants vid start och sedan var 4:e timme (CDON, Fyndiq, WooCommerce).
- **server/core/routes/index.js, server/index.ts:** Scheduler startas vid server-bootstrap.

### CDON / Fyndiq / WooCommerce

- **plugins/cdon-products/controller.js, mapToCdonArticle.js:** Utökad logik för artiklar och kategori-cache.
- **plugins/fyndiq-products/controller.js, mapToFyndiqArticle.js:** Förbättringar och kategori-cache.
- **plugins/woocommerce-products/controller.js, routes.js:** Utökad Woo-stöd och routes.
- **client:** cdonApi, fyndiqApi, woocommerceApi och WooExportPanel uppdaterade.

### Produkter (backend + frontend)

- **plugins/products/controller.js, model.js, routes.js:** Justeringar och nya endpoints.
- **client/…/ProductForm.tsx, ProductList.tsx, ProductContext.tsx:** UI- och kontextförbättringar.

### Övrigt

- **scripts/check-product-main-image.js, scripts/sello-fetch-one.js:** Nya diagnostikscripts.

---

## 2026-03-14 – Orders optimistic update, API-fellogg, Orders view-only

### Orders – optimistisk uppdatering

- **client/…/OrdersContext.tsx, OrdersList.tsx, OrderDetailInline.tsx:** Status- och spårningsuppdateringar (enskilt eller batch) uppdaterar listan direkt utan att vänta på API-svar. Vid ändring till status som inte matchar aktiv filter (t.ex. processing → delivered) tas ordrarna bort ur listan direkt och `totalOrders` uppdateras.
- Fire-and-forget: API-anrop körs i bakgrunden; popup stängs direkt.

### API-fellogg (global)

- **client/src/core/errorLog/:** Ny modul – `apiErrorStore` (localStorage), `installFetchWrapper` (loggar misslyckade /api/ anrop), `ErrorLogContext`, `ErrorLogButton`. Knapp med badge visas i ContentToolbar (högerställd) när det finns fel. Popup med expanderbara rader, Close och Clear and Close.
- **App.tsx, ContentToolbar.tsx:** ErrorLogProvider och knappen integrerade.

### Orders – view-only panel

- **OrdersForm borttagen:** Orders-panelen är endast view. Edit-knappen dold; PanelFooter och OrdersView uppdaterade.

---

## 2026-03-14 – Docs: Sello-dokumentation konsoliderad

### Dokumentation slagen ihop

- **docs/SELLO_CHANNEL_FIELD_MAPPING.md:** Nu enda referensen för Sello-fältmappning. Innehållet från `SELLO_IMPORT_SEKTION5_VANLIGA_FALT.md` och `SELLO_PRODUCT_FIELDS_COMPLETE.md` har slagits in (sektion 6.3: import-status, aktiva kanaler, Sello properties API). HTML (style, div, table) i översiktstabellen (sektion 8) är ersatt med Markdown.
- **Borttagna filer:** `docs/SELLO_IMPORT_SEKTION5_VANLIGA_FALT.md`, `docs/SELLO_PRODUCT_FIELDS_COMPLETE.md`.

---

## 2026-03-13 – Sello Woo map-fix, lager-push fire-and-forget, quantity-popup

### Sello-import – channel_product_map för WooCommerce när item_id saknas

- **plugins/products/controller.js:** Sello returnerar ofta `item_id: null` för WooCommerce-integrationer. Vid import görs nu en WooCommerce API-lookup (SKU = productId eller V+productId) när `item_id` saknas. Om produkten hittas i WooCommerce fylls `channel_product_map` med `external_id`, så att lager-push fungerar direkt utan export. Gäller båda importvägarna (selloProductIds och sidindelad).
- **docs/SELLO_WOO_MAP_FIX.md:** Dokumentation av problem och lösning.

### Lager-push – fire-and-forget

- **plugins/products/controller.js:** `pushStockToChannels` körs nu asynkront i bakgrunden efter batch update (quantity-ändring). API:t svarar direkt; CDON-, Fyndiq- och WooCommerce-synk sker i bakgrunden. Ger snabb respons i UI även vid långsamma kanal-API:er.
- **.cursor/rules/fire-and-forget-async.mdc:** Regel – använd fire-and-forget för synk mot externa tjänster där det är rimligt.

### Produktlistan – quantity-popup

- **client/…/ProductList.tsx, ProductContext.tsx:** Plus- och minus-knapparna öppnar nu en popup som frågar "Hur mycket vill du öka/minska lagersaldot med?" – användaren anger ett heltal (inget minustecken) och bekräftar.

---

## 2026-03-13 – CDON Delete, produktlistan grupp + icke-klickbara rader, docs, create-fix

### CDON – Delete mot plattformen

- **plugins/cdon-products/controller.js:** `batchDelete` anropar nu CDON Merchants API **PUT /v2/articles/bulk** med action `delete_article`. SKU hämtas från `channel_product_map.external_id`. Vid lyckad delete rensas mappning; vid fel eller saknad SKU rapporteras status. Create/Update var redan aktiva; Delete mot CDON är därmed komplett.

### Produktlistan (ProductList)

- **Visuell gruppindikation:** Produkter som tillhör samma variantgrupp (samma `group_id`, minst 2 st) visas med grön vänsterkant (`border-emerald-400`), ljusgrön bakgrund och badge "N varianter · Färg/Storlek/Modell" (samma stil som sammanhängande ordrar i orderlistan). Gäller både tabellvy och mobilvy.
- **Rader inte klickbara:** Tabellrader öppnar inte längre redigeringsfönstret vid klick. Text i kolumnerna kan markeras och kopieras. Redigering sker endast via knappen **Edit**.

### Produkter – create-fix (Sello-import)

- **plugins/products/model.js:** Vid skapande med explicit id (t.ex. Sello-import av borttagen produkt) stämde inte antal parametrar mot INSERT. Fix: `parent_product_id` tillagd i INSERT-kolumnlistan för explicit-id-grenen och `null` skickas som 47:e parameter.

### Migrations

- **076-drop-products-sale-price.sql:** Droppar `products.sale_price` (reapris ligger i `channel_product_overrides`).
- **077-drop-parent-product-id-fk.sql:** Droppar FK `products_parent_product_id_fkey` så att Sello-import kan lagra `parent_product_id` även när parent inte finns i DB.

### Dokumentation

- **docs/API-DOCS/CHANNEL_API_LIMITS.md:** Ny fil – sammanställning av rate limits, batch- och sidstorlekar för Sello (30/min, 100 produkter/sida, 300 ordrar/sida), Fyndiq (100 create, 200 update per anrop; 1000/sida), CDON (ordrar 1000/sida; rekomm. 100–200 artiklar per bulk), WooCommerce (inga explicita gränser i docs).
- **SELLO_CHANNEL_FIELD_MAPPING.md:** `products.sale_price` borttagen från schema; enproduktsgrupper från Sello (productCount === 1) får ingen gruppdata.
- **PRODUCT_PROPERTIES_OVERVIEW.md:** Gruppering (group_id, parent_product_id, group_variation_type) visas skrivskyddat i flik Detaljer; sätts via Group… i listan eller Sello-import.

---

## 2026-03-04 – CDON parent_sku från groupId, WooCommerce gruppering, Modell

### CDON

- **parent_sku:** I `mapToCdonArticle.js` används `product.groupId` (Sello group_id) som `parent_sku` till CDON när den finns, annars `parentProductId`. Matchar CDON-portalens "Huvudartikel SKU".

### WooCommerce – gruppering (variable product + variations)

- **plugins/woocommerce-products/controller.js:** Produkter med `groupId` och `groupVariationType` (color/size/model) exporteras som **variable product** (SKU = group_id) och **variations** (SKU = V+product.id). Lookup via GET `?sku=…`; ingen sparad Woo-ID.
- Hjälpfunktioner: `partitionProductsByWooGroup`, `ensureWooVariableProduct`, `ensureWooVariation`, `buildWooVariationPayload`, `getVariationAttributeValue`. Fristående produkter exporteras som enkla produkter som tidigare.
- **Modell:** Exporteras till WooCommerce som attribut (samma som färg/storlek). UI-placeholder för Modell ändrad till "För varianter".

### Scripts

- **fetch-group-identifiers-test.js:** Utökad med WooCommerce (Mobilhallen); söker t.ex. 95990276 och V124732563/564/565.
- **woo-update-stock-by-sku.js:** Nytt script – ökar lager med 1 på varianter via lookup på SKU (V+id). Vid HTTP 5xx rapporteras `store_error`.

### Dokumentation

- **PRODUCT_PROPERTIES_OVERVIEW.md:** Modell för WooCommerce; group_id användning (CDON parent_sku, WooCommerce variable/variations); kort om WooCommerce gruppering (SKU group_id / V+id).
- **SELLO_CHANNEL_FIELD_MAPPING.md:** CDON parent_sku = products.group_id; WooCommerce gruppering (variable + variations, SKU, Modell som attribut); avsnitt 5.4 utökat med gruppering och model.

---

## 2026-03-04 – Orders SKU (Egen referens), CDON mapper, Fyndiq shipping 21

### Orderlistan – SKU = Egen referens

- **plugins/orders/model.js:** SKU i orderraderna kommer från `products.sku` (Egen referens) via join. En källa, ingen fallback. Join använder `p.sku AS product_sku`.

### CDON-mappare (mapToCdonArticle.js)

- **Manufacturer:** En källa – `product.manufacturerName` (från manufacturer_id). Skickas som objekt `{ name }`. Ingen fallback till cdon.manufacturer.
- **Specifications:** Identifikation → Tillverkarens artikelnummer från `product.mpn` (per språk sv/da/fi/nb). Slås ihop med befintliga cdon.specifications. Ingen fallback till sv-SE för okända språk.
- **Classifications:** CONDITION från `product.condition` (new→NEW, used→USED, refurb→REFURB).
- **kn_number:** Från `product.knNumber`.
- **internal_note:** Sätts från `product.sku` (Egen referens) när tillgänglig.
- **unique_selling_points:** Byggs från `channelSpecific.textsExtended.bulletpoints` (per språk), inte bara cdon.unique_selling_points.

### Fyndiq shipping_time max 21

- **Leveranstid:** Max 21 arbetsdagar (bekräftat av Fyndiq-support; "Integer 1-9" = ental, tiotal tillåtet).
- **Kod:** `mapToFyndiqArticle.js` clamp och `validateFyndiqArticlePayload` max 21. Sello-import (buildShippingTimeFromSello) tillåter 1–21.
- **Dokumentation:** REQUIREMENTS_TO_CODE_MAPPING, SELLO_CHANNEL_FIELD_MAPPING, CHANNEL_REQUIREMENTS_MATRIX, tester uppdaterade.

---

## 2026-03-04 – Texter: standardmarknad, ingen fallback, varning

### Texter-fliken (ProductForm)

- **Radioknapp för standardmarknad:** Välj vilken marknad (SE, DK, FI, NO) som ska användas som fallback när en annan marknad saknar egen titel/beskrivning. Landnamn till vänster, radioknapp till höger.
- **standardTextMarket:** Nytt fält i FormData, sparas i `channelSpecific.textsStandard`.
- **buildTextArrays / buildDescArrays:** Använder vald standardmarknad som fallback per kanal (CDON/Fyndiq).

### Ingen fallback när standard är tom

- **CDON/Fyndiq-mappare:** Om en marknad saknar titel/beskrivning och standardmarknaden också är tom används inte längre `product.title` eller `product.description` som fallback. Marknaden hoppas över (null).
- Anpassat till regeln: ingen fallback till andra språk när både marknad och standard är tomma.

### Varning vid sparande

- **ProductContext saveProduct:** Varning visas när en marknad saknar titel och/eller beskrivning (standard också tom) och den marknaden har aktiva CDON- eller Fyndiq-kanaler.
- Ingen varning om marknaden inte har aktiva kanaler (t.ex. danska texter saknas men varken CDON DK eller Fyndiq DK är aktiverade).

### Sello-import

- **name + description per språk:** Hämtar och sparar `name` och `description` för alla språk, inte bara SEO-fält.
- **Språkprioritet:** sv → fi → da → nb → no → en för standardtext vid import.
- **textsExtended:** Sparar `name` och `description` per marknad vid import och redigering.

### Databas

- **Migration 070:** Droppar `model_text` från products.

---

## 2026-03-04 – Requirements-to-code mapping + valideringar

### Dokumentation

- **REQUIREMENTS_TO_CODE_MAPPING.md:** Ny fil med exakt mappning krav → fil/funktion/rad/reason för CDON, Fyndiq, WooCommerce.
- **CHANNEL_REQUIREMENTS_MATRIX.md:** Länk till mappningsdokumentet.
- **phase2_delivery_roadmap:** requirements-to-code-mapping markerad som completed.

### CDON/Fyndiq – nya valideringar

- **sku längd 1–64:** Validering i getCdonArticleInputIssues, getFyndiqArticleInputIssues, validateCdonArticlePayload, validateFyndiqArticlePayload. Reason: `invalid_sku_length`.
- **main_image URL:** Validering att URL börjar med http:// eller https://. Reason: `invalid_main_image_url`.
- **images URL:er:** Samma validering för extra bilder. Reason: `invalid_images_url`.
- **WooCommerce:** Samma main_image och images URL-validering i create/update-path. Reasons: `invalid_main_image_url`, `invalid_images_url`.

### WooCommerce

- **Lokal payload-validering:** Create/update-path validerar effektivt pris före API-anrop (blockera null).
- **Pris: blockera null, tillåt 0:** update_only_strict och create/update tillåter nu pris 0; blockar endast null/undefined.
- **Bugfix:** exportSku istället för sku i skipped_no_map-rapport (controller rad 617).

### Fyndiq article_id/UUID

- **Dokumenterat:** UUID-validering för external_id vid update finns i fyndiq-products/controller.js (rad 812–825, validateFyndiqUpdateActionEnvelope).

---

## 2026-03-10 – Grupperade produkter med variationer (Sello)

### Sello import – grupper och variationer

- **Migration 069:** Nya kolumner `parent_product_id`, `group_variation_type`, `model`.
- **Groups från Sello:** Vid import via selloProductIds hämtas listan först för att få `groups`-array med `main_product` och `type` (color/size/model).
- **parent_product_id:** Varor som är varianter pekar på parent (main product). Parent har `parent_product_id = null`.
- **group_variation_type:** Sello grupptyp – "color", "size" eller "model".
- **model:** Fritext från Sello (Model/Modell) – för gruppering per modell.
- **getSelloModel:** Helper som läser property "Model" eller "Modell" från Sello.

### API-struktur (Sello list response)

- `groups`: `{ id, main_product, group_sku, image_url, properties, products, type }`
- `type` = "color" | "size" | "model"

---

## 2026-03-10 – Sello import: delivery_times → shipping_time

### Sello import – fraktleveranstid

- **delivery_times** från Sello mappas till `channelSpecific.cdon.shipping_time` och `channelSpecific.fyndiq.shipping_time`.
- **Endast per-marknad** (SE, DK, FI, NO): Sello `delivery_times.default` används inte. Produkter med bara default får ingen shipping i importen → ProductForm använder plugin-inställningarna (defaultDeliveryCdon/defaultDeliveryFyndiq).
- **UI:** `shippingMin` och `shippingMax` läggs på varje marknadsobjekt i `channelSpecific.cdon.markets` och `.fyndiq.markets` så att ProductForm visar och redigerar värdena.
- Lagrade värden begränsas till 1–21; CDON-mappern begränsar till 1–10, Fyndiq till 1–21 vid export.

---

## 2026-03-08 11:40 – Statistik (Sello), kanal-checkboxes, MPN, size/pattern, debug

### Statistik-flik: Antal sålda, Skapad datum, Senast såld

- **Ny kolumner i products** (migration 068): `source_created_at`, `quantity_sold`, `last_sold_at` – hämtas från Sello (`created_at`, `sold`, `last_sold`).
- **Statistik-flik** visar nu dessa tre fält överst (från Sello); period-baserad statistik (antal sålda i period, bästa kanal, aktivitetstidslinje) oförändrad.

### Kanalsynk – checkboxes från överrides

- **getProductChannelTargets** returnerar nu targets från både `channel_product_map` och `channel_product_overrides` (active=true). Produkter importerade från Sello med aktiva kanaler visas som ikryssade i ProductForm utan manuell markering.

### MPN och Egen referens

- **MPN** hämtar nu från Egen referens (`merchant_sku` / Sello `private_reference`) istället för SKU när inget anges manuellt. I Sello-import: MPN sätts endast om Egen referens finns; ingen fallback till SKU.

### Size/Pattern – undvik dubbel fyllning

- **sizeText** sätts till null när `size` har preset-match; annars från Size/Storlek.
- **patternText** sätts till null när `pattern` finns; annars från Mönster/pattern_text. Samma logik som colorText.

---

## 2026-03-07 20:52 – Sello import: manufacturer_name, product_number borttagen, Produkt-flik

### Sello import – tillverkare

- **manufacturer_name**: När Sello returnerar `manufacturer: null` men `manufacturer_name` (t.ex. "Wrebbit") används namnet för att hitta/skapa tillverkare via `findOrCreateManufacturerForSello`.
- **manufacturer som objekt**: Stöd för Sello som returnerar `manufacturer: { id, name }` – använder `manufacturer.id`.

### product_number borttagen

- **Migration 067**: Droppar `product_number` från products. Identifiering sker via `id`; sync mot WooCommerce/Sello via `sku`/sello-id.

### Produkt-flik (UI)

- Städad layout: konsekvent grid (1–3 kolumner), korta etiketter (Egen referens, Eget namn, Lagerplats), fixad duplicerad Card-tagg.

### Scripts

- `scripts/sync-all-sello-products.js`: Synkar alla befintliga produkter från Sello (uppdaterar, skapar inte nya).
- `scripts/run-build-channel-map-sello.js`: Kör Bygg kanalkarta från Sello (uppdaterar `channel_product_map`).

### Dokumentation

- `docs/SELLO_CHANNEL_FIELD_MAPPING.md`: manufacturer_name tillagd som Sello-källa för manufacturer_id (tidigare SELLO_IMPORT_SEKTION5).

---

## 2026-03-07 20:52 – Products: tenant-only (public.products borttagen) + material/pattern_text

### Tenant är enda sanningen för produktdata

- **public.products borttagen**: All produktdata ska ligga i tenant-scheman. `public.products` har droppats i Neon.
- **Runtime**: PostgreSQLAdapter sätter `search_path` till `tenant_${userId}` per query; alla produktläsningar/skrivningar går mot tenant.
- **Regel**: Allt som körs manuellt i Neon måste också finnas som migrationfil (`.cursor/rules/neon-mcp.mdc`).

### Nya kolumner

- **material** (VARCHAR 255): fritext från Sello property "Material".
- **pattern_text** (VARCHAR 255): mönster fritext när Sello/Fyndiq preset saknas.

### Migreringar

- `063-products-material-pattern-text.sql`: ADD material, pattern_text till products (i tenant).
- `064-drop-public-products.sql`: DROP TABLE IF EXISTS public.products CASCADE.

### Verifiering

- Sökning i repo: inga runtime-referenser till `public.products`. Endast scripts i `scripts/db/` (legacy, ej runtime).
- Neon: public.products borttagen; tenant_1/2/3.products har material, pattern_text.

---

## 2026-03-07 15:59 – Sello-import SEO/EAN/GTIN + Rich text + Texter-flik

### Sello import – utökad datamappning

- **SEO-fält från texts**: `titleSeo`, `metaDesc`, `metaKeywords`, `bulletpoints` importeras per språk till `channelSpecific.textsExtended`.
- **EAN/GTIN från properties**: importeras till `products.ean` och `products.gtin`.
- **Övriga sektion 1-fält**: redan importerade (condition, lagerplats, volume, weight, purchase_price, notes, color_text, group_id).

### Rich text (TipTap)

- **Global RichTextEditor** för produktbeskrivning, Notes, Tasks, Besiktningar.
- Vanlig textarea för interna anteckningar; meta-fält (titleSeo, metaDesc, metaKeywords) är plain text.
- Toggle-komponent för verktygsfält; B, I, U, Strike, länk, Kod/Visual.
- `extractMentionsFromHtml` och `htmlToPlainText` för Notes/Tasks.

### Produktform – Texter-flik

- 20/80-layout: länder vänster, innehåll höger.
- Titel, beskrivning (6 rader), sedan Avancerat med titleSeo, metaDesc, metaKeywords, bulletpoints (bulletpoints först under Avancerat).

### Dokumentation

- `docs/SELLO_CHANNEL_FIELD_MAPPING.md` (innehållet från SELLO_PRODUCT_FIELDS_COMPLETE och SELLO_IMPORT_SEKTION5 är nu samlat här).
- Migration `062-sello-sektion1-fields.sql`: `import_folder_id`, `import_brand_id` på lists/brands.

---

## 2026-03-07 15:59 – Phase 2 Delivery Plan (create/full article)

### Implementerat enligt plan

- **Kontrakt-hårdgörande**: CDON och Fyndiq-valideringar inkluderar nu marknaden NO (SE, DK, FI, NO).
- **Kravmatris**: `docs/CHANNEL_REQUIREMENTS_MATRIX.md` – låst krav per kanal med kodkoppling.
- **Preflight-runner**: `scripts/phase2-preflight.js` – kör med dryRun, Stop/Go-rapportering.
- **Write-pilot**: `scripts/phase2-write-pilot.js` – kör 5–10 produkter, explicit mode (inga implicita körningar).
- **Runbook**: `docs/PHASE2_RUNBOOK.md` – kommandon, tolkningsregler, rollback.
- **Regressionstester**: `server/__tests__/phase2ContractValidators.test.js` – validering av payload-kontrakt.

### Kommandon

```bash
# Preflight (read-only)
PHASE1_PILOT_USER_ID=1 node scripts/phase2-preflight.js

# Write pilot (5–10 produkter)
PHASE1_PILOT_USER_ID=1 node scripts/phase2-write-pilot.js
```

---

## 2026-03-05 16:46 – Orders: kollinummerkrav CDON/Fyndiq + batch/enskild "Uppdatera ändå"

### Kollinummerkrav (299 SEK/DKK/NOK, 29,99 EUR)

- **CDON och Fyndiq**: order som når tröskelvärdet (299 SEK, 299 DKK, 299 NOK eller 29,99 EUR) kräver kollinummer när de sätts till Levererad.
- Validering gäller både **enskild order** (Edit status) och **batch-uppdatering** (Update selected).
- Tydliga felmeddelanden på svenska: t.ex. "Vänligen fyll i kollinummer för order #X" (batch) respektive "Vänligen fyll i kollinummer för denna order." (enskild).

### "Uppdatera ändå"

- **Batch**: vid kollinummersfel visas felmeddelandet i batchmodalen och knappen "Uppdatera ändå"; klick skickar samma uppdatering med `forceUpdate: true` (valideringen hoppas över).
- **Enskild order**: samma beteende i Edit status – felmeddelande och "Uppdatera ändå" på samma rad som Save/Cancel.

### Tekniska ändringar

- Backend: `orderNeedsTrackingByAmount(totalAmount, currency)` med valuta-medvetna trösklar; `forceUpdate` i body för `PUT /api/orders/:id/status` och `PUT /api/orders/batch/status`.
- Klient: fel från API använder `errors[0].message` så användaren ser servertext istället för "Bad request"; `OrderDetailInline` visar fel och "Uppdatera ändå" i samma rad som knapparna.

---

## 2026-03-04 22:35 – Products migration hardening (Phase 1 + Phase 2 preflight)

### Sello import, mapping och datamodell

- **Sello settings i tenant**: ny modell och migreringar för Sello-anslutning och integrationsmappning.
  - Migreringar: `059-products-merchant-sku.sql`, `060-sello-integration-map.sql`, `061-sello-settings.sql`.
  - Ny fil: `plugins/products/selloModel.js`.
- **Produktimport från Sello API (`/v5/products`)**:
  - robust läsning av payload (`products` + `duration.total_count`),
  - import av titel/beskrivning från Sello `texts.*.sv` (inte `private_name`),
  - import av bilder och merchant SKU,
  - import av per-instans/per-marknad-priser till overrides.
- **Ingen primär butik för pris**:
  - importen sätter inte globalt pris till 0,
  - `0`/`null` från Sello pris behandlas som saknat (`NULL` i overrides),
  - globalt baspris används endast som fallback där override-pris saknas.

### Strikt update-only export (Phase 1)

- **CDON/Fyndiq/Woo update_only_strict** hårdnat:
  - endast uppdatering av mappade produkter,
  - tydlig rapportering: `updated`, `skipped_no_map`, `validation_error`, `channel_error`.
- **CDON fixar**:
  - korrekt bulk payload-shape (`{ actions: [...] }`),
  - strikt validering av actions för pris/kvantitet,
  - förbättrad felrapportering.
- **Fyndiq fixar**:
  - `article_id` valideras som UUID-format,
  - marknadsfilter i strict export (`se/dk/fi`),
  - strikt validering av pris/kvantitet-actions.
- **WooCommerce fixar**:
  - strict export hämtar effektivt pris från instans-overrides, annars baspris.

### Kategorier: felorsak, modellkorrigering och regressionsfix

- **Root cause**: kategori kunde bli fel när kanaldata kollapsade till toppnivåfält i `channelSpecific`.
- **Ny kategorihantering**:
  - import sparar kategori per marknad/integration i kanaldata,
  - `0`/`null` kategorier normaliseras till `null`,
  - Woo override-kategorier kan innehålla flera ID (JSON-array),
  - CDON/Fyndiq kräver explicit kategori (ingen fallback).
- **Inaktiv status**:
  - inaktiv styr export/skip, men data hålls konsekvent och valideras strikt för aktiva mål.
- **UI-regressionsfix**:
  - ProductForm läser kategorier från den nya per-market-strukturen (strict),
  - tom visning för mobil/surfplattefodral åtgärdad efter modelländring.

### Phase 2 preflight (utan externa skrivningar)

- **Dry-run/preflight för CDON/Fyndiq**:
  - `dryRun: true` stöd i exportflöde,
  - inga externa API-anrop,
  - inga channel-map-fel skrivs i dry-run,
  - tydliga valideringsorsaker (`mapper_rejected:*`, `contract_validation_failed:*`).
- **Kontraktsvalidering före export**:
  - strikt payload-validering för artikel-export i mappar/controllrar,
  - explicit required-matris dokumenterad i `.cursor/Required_matrix_cdon_fyndiq_phase2.md`.

### Channels / overrides / routes

- Uppdateringar i channels-, products-, cdon-, fyndiq- och woocommerce-pluginer för:
  - striktare validering,
  - tydligare rapportering,
  - säkrare import/export-semantik.
- Berörda huvudfiler:
  - `plugins/products/{controller,model,index,routes}.js`
  - `plugins/channels/{controller,model}.js`
  - `plugins/cdon-products/{controller,mapToCdonArticle,routes}.js`
  - `plugins/fyndiq-products/{controller,mapToFyndiqArticle,routes}.js`
  - `plugins/woocommerce-products/{controller,model,routes}.js`
  - `plugins/orders/controller.js`

### Dokumentation och API-docs struktur

- API-dokumentation flyttad/normaliserad under `docs/API-DOCS/`:
  - CDON JSON/MD,
  - Fyndiq JSON/MD,
  - PostNord Swagger/JSON,
  - Sello HTML/MD.
- Tidigare rotfiler i `docs/` ersatta av ny struktur.
- Plan- och regeluppdateringar under `.cursor/`:
  - `Plan_products.md`,
  - `Plan_baseline_migrations_cleanup.md`,
  - regler för API-docs-prioritet och no-primary-store-pricing.

## 2026-03-02 16:42 – Homebase 3.1.6

### Analytics – performance-overhaul

- **Summary-endpoint** `GET /api/analytics/summary` ersätter flera separata anrop för första vy. Returnerar overview, timeSeries, statusDistribution, customerSegments, channels, allChannelsForDropdown i ett svar.
- **Kanoniska kolumner** på `orders`: `channel_market_norm`, `currency_norm`, `customer_identifier_norm`. Fylls vid ingest, inte vid varje read.
- **Read model** `customer_first_orders` för ny/återkommande kundsegmentering. Uppdateras via trigger vid order-insert/update.
- **Cache** användar- och filternycklad, kort TTL (30–45 s). Används för summary, channels, customerSegments, top-products. Invalidering vid order-mutationer (update, ingest, sync, delete).
- **Index** (migration 058) för analytics-frågor: user_id+placed_at, status, channel, channel_instance_id, channel_market_norm, customer_identifier_norm, customer_first_orders, order_items.
- **Frontend:** debounce på filter, drilldown-fetches isolerade från basdashboard, ingen duplicerad channel-fetch när inget kanalfilter är aktivt.
- **Timing-loggning** för summary, channels, customerSegments, top-products (p50/p95-analys).
- Migrationer: `057-analytics-canonical-and-customer-first-orders.sql`, `058-analytics-normalized-indexes.sql`.

### WooCommerce – obligatoriskt label (stramare)

- **Label krävs** vid create/update av WooCommerce-instans. Ingen fallback till hostnamn eller "WooCommerce Store". API returnerar 400 om label saknas.
- Filer: `plugins/woocommerce-products/controller.js`, `plugins/woocommerce-products/model.js`.

### Orders – kundpresentation

- **Ordervy** formaterar kund- och adressdata läsbart istället för rå JSON. `formatCustomer` och `formatAddress` hjälpfunktioner.
- Fil: `client/src/plugins/orders/components/OrdersView.tsx`.

### Dokumentation – analytics-referens

- **Konsoliderad analytics-dokumentation** till [docs/analytics-overhaul-reference.md](analytics-overhaul-reference.md). Ersätter och tar bort `analytics-performance-rollout.md`, `analytics-contracts.md` och planen `analytics_performance_overhaul_a77a35d3.plan.md`. Innehåller scope, kontrakt, migrationsrunbook, verifierings-SQL och blueprint för övriga e-commerce-plugins.

### Nytt plugin: E-Commerce Analytics

- **Nytt plugin `analytics`** under E-Commerce med KPI:er för omsättning, order, AOV och sålda enheter.
- **Storsäljare:** Fraktkostnader (WooCommerce shipping line items) exkluderas från topplistan – endast produktrader räknas.
- **Nya API-endpoints** i `plugins/analytics/routes.js`: `GET /api/analytics/overview`, `GET /api/analytics/timeseries`, `GET /api/analytics/channels`, `GET /api/analytics/top-products`, `GET /api/analytics/drilldown/orders`, `GET /api/analytics/export/top-products.csv`.
- **Filtrering och trends**: datumintervall, status, kanal, kanalinstans och granularitet (dag/vecka/månad) stöds i backend och UI.
- **Drilldown + export**: klick på storsäljare visar orderlista per SKU och CSV-export av topplista finns direkt i vyn.
- **Fördjupad analytics**: klick på kanal/butik öppnar order-drilldown för vald kanalinstans, statusfördelning över tid visas i diagram (med klickbar status/bucket-drilldown), och ny/återkommande kundsegmentering visas. För CDON/Fyndiq identifieras kund via telefonnummer; övriga kanaler använder kund-e-post.
- **Dashboard-widget**: snabb kortvy för omsättning med länk till analytics-pluginet.
- Filer: `plugins/analytics/plugin.config.js`, `plugins/analytics/index.js`, `plugins/analytics/model.js`, `plugins/analytics/controller.js`, `plugins/analytics/routes.js`, `client/src/plugins/analytics/**`, `client/src/core/pluginRegistry.ts`, `client/src/core/ui/Sidebar.tsx`, `server/core/routes/auth.js`.

### Migration: analytics-index

- **Ny migrering `056-analytics-indexes.sql`** med index för vanliga analytics-frågor:
  - `orders(user_id, placed_at DESC)`
  - `orders(user_id, channel, channel_instance_id, placed_at DESC)`
  - `orders(user_id, status, placed_at DESC)`
  - `order_items(order_id, sku)`

### WooCommerce – butiksnamn på order (channel_label)

- **Ny kolumn `orders.channel_label`** (migrering 055). Sparar butiksnamnet (t.ex. "Merchbutiken") vid order-sync så att det inte försvinner om butikslabel ändras senare.
- **Obligatoriskt vid WooCommerce-instans:** API och UI kräver nu att butikslabel fylls i vid skapande/uppdatering av WooCommerce-butik. Ingen fallback – utan label går det inte att spara.
- **Orders-lista och ordervy:** Visar `channel_label` om det finns, annars "—". Gäller både listan och OrderDetailInline.
- **Plocklista-PDF:** Använder `channel_label` om tillgängligt, annars "—".
- **Backfill för gamla order:** Kör `node scripts/backfill-orders-channel-label.js` en gång per miljö för att sätta `channel_label` på befintliga WooCommerce-order utifrån `channel_instances.label`. Uppdaterar endast rader där `channel_label IS NULL` och det finns en matchande instans med icke-tomt label.
- **Risk:** Om backfill inte körts efter 055 kommer gamla order att visa "—" för butik tills skriptet körts. Nyare order får label vid sync.
- Filer: [server/migrations/055-orders-channel-label.sql](server/migrations/055-orders-channel-label.sql), [plugins/orders/model.js](plugins/orders/model.js), [plugins/woocommerce-products/controller.js](plugins/woocommerce-products/controller.js), [plugins/woocommerce-products/model.js](plugins/woocommerce-products/model.js), [client/src/plugins/orders/components/OrdersList.tsx](client/src/plugins/orders/components/OrdersList.tsx), [client/src/plugins/orders/components/OrderDetailInline.tsx](client/src/plugins/orders/components/OrderDetailInline.tsx), [client/src/plugins/orders/types/orders.ts](client/src/plugins/orders/types/orders.ts), [client/src/plugins/woocommerce-products/components/WooSettingsForm.tsx](client/src/plugins/woocommerce-products/components/WooSettingsForm.tsx), [plugins/orders/plocklistaPdfTemplate.js](plugins/orders/plocklistaPdfTemplate.js), [scripts/backfill-orders-channel-label.js](scripts/backfill-orders-channel-label.js).

### Credentials i channel_instances – endast JSONB-format, inga fallbacks

- **Kolumnen `channel_instances.credentials` är JSONB.** Koden sparar nu alltid `{ "v": "<krypterad sträng>" }`. Läser endast det formatet – ingen hantering av äldre plain-objekt eller strängar.
- **WooCommerce:** `credentialsForJsonb()`, `parseCredentials()` endast för `{ v: encryptedString }`. `migrateLegacyCredentials` och alla anrop borttagna. Nya/sparade butiker får krypterade credentials i rätt format.
- **Channels (aggregat):** Samma mönster – `credentialsForJsonb()` vid skrivning, `migrateLegacyCredentials` borttagen. `upsertInstance` och `updateInstance` skickar credentials som JSONB-objekt.
- **Om gamla data:** WooCommerce-instanser som hade credentials sparade som vanligt JSON-objekt (okrypterat) visade tomma fält efter ändringen. Kör **en gång** `npm run migrate:encrypt-woo-credentials` för att kryptera och skriva om till `{ v: "enc:..." }` i alla tenant-databaser. Efter det finns inget legacy-format kvar och appen läser bara ett format.
- **Risk:** Om migreringen inte körts och det fanns plain-JSON-credentials blir butikslistan tom (labels/URL/credentials). Köra skriptet åtgärdar det.
- Filer: [plugins/woocommerce-products/model.js](plugins/woocommerce-products/model.js), [plugins/channels/model.js](plugins/channels/model.js), [scripts/encrypt-woo-credentials-in-channel-instances.js](scripts/encrypt-woo-credentials-in-channel-instances.js).

### Borttagna "migrate on read" (migrateLegacy\*) – ingen automatisk uppgradering vid läsning

- **CDON, Fyndiq, Files (Google Drive), Mail, Shipping (PostNord):** `migrateLegacySecrets` / `migrateLegacySettingsSecrets` och alla anrop (t.ex. i `getSettings`) är borttagna. Vid läsning gör vi ingen längre kryptering av okrypterade fält – vi läser bara vad som finns.
- **Channels:** `migrateLegacyCredentials` borttagen från `listInstances`.
- **Konsekvens:** Om det fortfarande fanns okrypterade secrets i cdon_settings, fyndiq_settings, googledrive_settings, mail_settings eller postnord_settings kommer de att fungera vid läsning (CredentialsCrypto.decrypt returnerar plain text oförändrad) men ligger kvar okrypterade i DB. Kör **en gång** `npm run migrate:encrypt-legacy-secrets` för att kryptera alla sådana rader i alla tenants. Efter det är allt krypterat och det behövs ingen kod som "migrerar vid läsning".
- **Risk:** Om encrypt-legacy-secrets inte körts och det fanns plain-text i dessa tabeller är data fortfarande läsbar men inte krypterad i DB.
- Filer: [plugins/cdon-products/model.js](plugins/cdon-products/model.js), [plugins/fyndiq-products/model.js](plugins/fyndiq-products/model.js), [plugins/files/cloudStorageModel.js](plugins/files/cloudStorageModel.js), [plugins/mail/model.js](plugins/mail/model.js), [plugins/shipping/model.js](plugins/shipping/model.js), [plugins/channels/model.js](plugins/channels/model.js), [scripts/encrypt-legacy-secrets.js](scripts/encrypt-legacy-secrets.js).

### Regel: inga fallbacks

- **Ny regel** [.cursor/rules/no-fallbacks-unless-best-practice.mdc](.cursor/rules/no-fallbacks-unless-best-practice.mdc): Ingen fallback-logik någonstans utom när det är uttryckligen bäst praxis. Ingen kod "för övergången" eller "fixa sen" – vi är i dev, ingen migration att stödja. Vid osäkerhet – fråga användaren istället för att gissa eller lägga till fallback.

### WooCommerce butikslista – Edit-knapp

- **Fix:** "Edit" i WooCommerce-butikslistan anropade tidigare bara `openWooSettingsForEdit` när `inst.credentials` fanns. Efter att credentials endast läses som `{ v: encryptedString }` kunde credentials vara null (t.ex. före encrypt-woo-credentials-migration) och då hände inget vid klick. Nu anropas alltid `openWooSettingsForEdit` med id, instanceKey, label och credentials-fält (tomma strängar om credentials saknas), så panelen öppnas och användaren kan fylla i/spara igen.
- Fil: [client/src/plugins/woocommerce-products/components/WooExportPanel.tsx](client/src/plugins/woocommerce-products/components/WooExportPanel.tsx).

### Session – PRIMARY KEY på sessions-tabellen

- **Fix:** Tabellen `sessions` (connect-pg-simple) skapades utan PRIMARY KEY på `sid`, vilket gav fel "there is no unique or exclusion constraint matching the ON CONFLICT specification" vid session save (t.ex. efter login). `scripts/setup-database.js` skapar nu `sessions` med `PRIMARY KEY (sid)` och innehåller ett idempotent steg som lägger till PK om den saknas. Kör ALTER manuellt på befintliga DB om behov.
- Fil: [scripts/setup-database.js](scripts/setup-database.js).

### Session / tenant – ingen legacy-sync av tenant-owner-alias i middleware

- **Borttaget:** Middleware som "synkade" ett tenant-owner-alias från `user.id` när det saknades (fallback). Tenant-middleware läser nu bara den kanoniska tenantkontexten i sessionen (`tenantId`, `tenantOwnerUserId`, `tenantConnectionString`, `tenantSchemaName`) och sätter ingen tenant-pool om den saknas.
- Fil: [server/index.ts](server/index.ts).

### NPM-skript

- `npm run migrate:encrypt-legacy-secrets` – krypterar plain-text secrets i cdon_settings, fyndiq_settings, googledrive_settings, mail_settings, postnord_settings för alla tenants.
- `npm run migrate:encrypt-woo-credentials` – krypterar WooCommerce-credentials i channel_instances (plain JSON → `{ v: encrypted }`) för alla tenants.
- Backfill för channel_label: `node scripts/backfill-orders-channel-label.js`.

---

## 2026-02-28 13:51 – Homebase 3.1.5 (snapshot before migrating from 3.X)

### Tvåfaktorsautentisering (TOTP)

- **Ny tabell `user_mfa`** för TOTP-secrets (migrering 054). Kör `node scripts/run-user-mfa-migration.js` på main-databasen.
- **Nya auth-endpoints**: `POST /auth/verify-mfa`, `GET /auth/mfa/status`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify`, `POST /auth/mfa/disable`.
- **Env `MFA_ENABLED`**: Sätt `true` i prod för att aktivera MFA; `false` eller utelämnad i dev för att slippa TOTP vid utveckling.
- **Inställningssida Security/2FA**: Ny kategori under Settings för att aktivera/inaktivera tvåfaktorsautentisering. QR-kod och manuell secret vid setup; lösenordsverifiering vid inaktivering.
- **Login-flöde med MFA**: Om användaren har MFA aktiverat returnerar `/auth/login` `{ requiresMfa: true, mfaToken }` istället för session; klienten visar fält för 6-siffrig kod och anropar `/auth/verify-mfa`.
- Filer: `server/core/routes/auth.js`, `server/core/services/mfaService.js`, migrering `054-user-mfa.sql`, `client/src/core/api/AppContext.tsx`, `client/src/core/ui/LoginComponent.tsx`, `client/src/core/ui/SettingsList.tsx`, `client/src/core/ui/SettingsForms/SecuritySettingsForm.tsx`, `client/src/core/ui/SettingsFooter.tsx`, `client/src/App.tsx`.

### Session – idle timeout (endast prod)

- **Prod:** `rolling: true`, cookie `maxAge` = `SESSION_IDLE_TIMEOUT_MINUTES` (default 15). Efter X min inaktivitet → utloggning.
- **Dev:** Ingen idle timeout (24h session). Påverkar inte utveckling.
- Fil: [server/index.ts](server/index.ts).

### Contacts – CSRF komplettering

- **CSRF-skydd på alla muterande routes** i `plugins/contacts/routes.js`: create, update, delete, bulkDelete, createList, addContactsToList, removeContactFromList, renameList, deleteList, createTimeEntry, deleteTimeEntry.
- **TimeTrackingWidget** använder nu `contactsApi.createTimeEntry()` istället för raw fetch – säkerställer att X-CSRF-Token skickas vid POST till `/api/contacts/:id/time-entries`.
- Filer: [plugins/contacts/routes.js](plugins/contacts/routes.js), [client/src/core/widgets/time-tracking/TimeTrackingWidget.tsx](client/src/core/widgets/time-tracking/TimeTrackingWidget.tsx).

### Global low-friction security hardening (app-wide)

- **Server guardrails without dev friction**
  - Global body limits are now explicit (`API_JSON_LIMIT`, `API_URLENCODED_LIMIT`) with safe defaults.
  - HTTP timeout guardrails set on server (`requestTimeout`, `headersTimeout`, `keepAliveTimeout`).
  - `x-powered-by` disabled.
  - Files: [server/index.ts](server/index.ts).
- **Write validation + webhook abuse protection**
  - Intake webhook now has strict payload sanity checks (object payload, URL format, max file URL count).
  - Intake endpoint now uses dedicated rate limiter and timing-safe secret compare.
  - Files: [server/core/routes/intake.js](server/core/routes/intake.js), [server/core/middleware/rateLimit.js](server/core/middleware/rateLimit.js).
- **File upload content verification**
  - Files upload now validates file content signature (magic bytes) after upload, not only `file.mimetype`.
  - Text-like exceptions (`.txt`, `.csv`, `.svg`) are verified with binary-content heuristic; blocked files are deleted immediately.
  - File: [plugins/files/routes.js](plugins/files/routes.js).
- **Validation/log secret hygiene**
  - Validation middleware now redacts sensitive fields (`password`, `token`, `apiKey`, `secret`, etc.) and truncates large strings in debug logs.
  - File: [server/core/middleware/validation.js](server/core/middleware/validation.js).
- **Credentials encryption standardized**
  - Channel instance credentials now use app-level encryption (write-path + lazy migration) in channels and WooCommerce models.
  - Files: [plugins/channels/model.js](plugins/channels/model.js), [plugins/woocommerce-products/model.js](plugins/woocommerce-products/model.js).
- **Strict tenant/main DB boundaries preserved**
  - Local tenant provider remains strict tenant-only (`search_path` tenant schema), skips main-db migrations in tenant bootstrap, and resets `search_path` before releasing pooled connection.
  - Migration `053-shipping-postnord.sql` no longer depends on `users` FK in tenant schema.
  - Files: [server/core/services/tenant/providers/LocalTenantProvider.js](server/core/services/tenant/providers/LocalTenantProvider.js), [server/migrations/053-shipping-postnord.sql](server/migrations/053-shipping-postnord.sql).

### Produkter – kategorier, prisvalidering och kanallabels

- **Kategorier vid ny produkt**
  - Kategorier kan sättas direkt när man skapar en produkt; spara först krävs inte. Borttagen villkoret `currentProduct?.id` i Kategori-fliken i ProductForm.
  - Borttagen texten "Spara produkten först och koppla kanaler under fliken Kanaler för att välja kategorier."
  - Enhetlig text och typsnitt för kategorifält: "Välj kategori" för alla kanaler, text-sm, text-gray-500 för tomt tillstånd (WooCommerce + CDON/Fyndiq).
- **Prisvalidering – pris per butik**
  - Fix: Valideringen "Minst en aktiv kanal saknar effektivt pris" triggades felaktigt när endast pris per butik (t.ex. vardagsdesign) var ifyllt. Orsak: strikt jämförelse `channelInstanceId === t.channelInstanceId` (string från API vs number från formulär). ProductContext använder nu `String(...)` vid matchning av override och marknad.
- **Uppdaterade kanallabels (stale-while-revalidate)**
  - Vid cache-träff för kanaldata hämtas instances i bakgrunden; när svaret kommer uppdateras labels och cache. Efter redigering av t.ex. butikslabel i Channels visas rätt namn även när man öppnar en befintlig produkt.
  - Filer: [client/src/plugins/products/components/ProductForm.tsx](client/src/plugins/products/components/ProductForm.tsx), [client/src/plugins/products/context/ProductContext.tsx](client/src/plugins/products/context/ProductContext.tsx).

### Orders – paginering, batch-carrier och gruppmarkering

- **Paginering**
  - Backend: orders list returnerar `{ items, total }`. Model kör COUNT och datafråga parallellt.
  - Klient: standard limit 50, offset 0; sidbläddring med "Visar X–Y av Z order", Föregående/Nästa och sidnummer. Offset återställs till 0 vid filterändring (status, kanal, datum).
  - Filer: [plugins/orders/model.js](plugins/orders/model.js), [plugins/orders/controller.js](plugins/orders/controller.js), [client/src/plugins/orders/api/ordersApi.ts](client/src/plugins/orders/api/ordersApi.ts), [client/src/plugins/orders/context/OrdersContext.tsx](client/src/plugins/orders/context/OrdersContext.tsx), [client/src/plugins/orders/components/OrdersList.tsx](client/src/plugins/orders/components/OrdersList.tsx).
- **Batch-carrier – sammanslagen lista**
  - I batch-uppdateringsdialogen används en gemensam carrierlista: gemensamma CDON/Fyndiq visas en gång, Fyndiq-unika (4PX, CNE, eQuick, Sunyou, Yanwen) med etiketten "Namn (Fyndiq)". WooCommerce använder samma lista.
  - Fil: [client/src/plugins/orders/constants/carriers.ts](client/src/plugins/orders/constants/carriers.ts) (BATCH_CARRIERS), [client/src/plugins/orders/components/OrdersList.tsx](client/src/plugins/orders/components/OrdersList.tsx).
- **Gruppmarkering tydligare**
  - Grupperade order (samma leverans) har grön (emerald) bakgrund och vänsterkant istället för blå, så de skiljer sig tydligt från valda rader (grå).
  - Fil: [client/src/plugins/orders/components/OrdersList.tsx](client/src/plugins/orders/components/OrdersList.tsx).

### CF7 intake och filvalidering

- **Intake-webhook för besiktningsförfrågningar**
  - Ny route `POST /api/intake/inspection-request` för CF7-formulär. Validerar `x-webhook-secret`, skapar projekt och mapp, hämtar filer från WordPress, kopplar filer till projekt.
  - Fältmappning: beteckning, namn, e-post, företag, ämne, meddelande, typ, bilaga-1..bilaga-6.
  - Dokumentation: [.cursor/contact_form_to_homebase.md](.cursor/contact_form_to_homebase.md).
- **Magic-byte MIME-validering**
  - `wordpressFileFetcher.js` använder `file-type` för att detektera filtyp från innehåll istället för HTTP-header. Blockar spoofade filer.
  - Tillåtna typer inkluderar PDF, bilder, Office, text, CSV och **ZIP**.
- **Filuppladdning med mappar**
  - Stöd för `folder_path` i user_files. Migrering 052-files-folder-path.sql.
  - Multer och pathUtils stöder mappstruktur. Files-plugin tillåter ZIP.

### Besiktningar – visa och förhandsgranska filer

- **Ladda ner och förhandsgranskning i projektvy**
  - I "Bifogade filer" kan användaren nu ladda ner filer via nedladdningsknapp.
  - Förhandsgranskningsmodal för PDF och bilder (png, jpeg, gif, webp, etc.). Övriga filtyper visar meddelande + ladda ner-länk.
  - Fil: [client/src/plugins/inspection/components/InspectionView.tsx](client/src/plugins/inspection/components/InspectionView.tsx).
- **Fix: Bifogade listor sparas vid vanlig Spara för nya projekt**
  - Tidigare sparades listor endast vid "Spara och skicka". Nu inkluderas `pendingListIds` i `handleSave` och `saveInspection` lägger till listor via `addFileList` vid skapande av nytt projekt.
  - Filer: [client/src/plugins/inspection/components/InspectionView.tsx](client/src/plugins/inspection/components/InspectionView.tsx), [client/src/plugins/inspection/context/InspectionContext.tsx](client/src/plugins/inspection/context/InspectionContext.tsx).
- **Fix: "Skicka"-knappen disabled tills listor laddats**
  - I redigeringsläge kunde man klicka "Skicka" innan `projectFileLists` laddats från getProject, vilket gav krasch i SendModal. Knappen är nu disabled tills data finns.
- **Explicit hantering utan fallbacks**
  - `projectFileLists` kan vara `undefined` från getAll; visar "Laddar listor..." och disabled "Skicka" tills laddat. `handleRemoveFileList` propagerar `undefined` utan att ersätta med tom array.
- **Dokumentation**
  - [docs/inspection-api-responses.md](docs/inspection-api-responses.md) – vad servern returnerar per endpoint.
  - [docs/inspection-audit-complete.md](docs/inspection-audit-complete.md) – full audit av Inspection-pluginet.

### API – header merge-ordning (CSRF)

- **Fix: CSRF-header skrivs inte längre över**
  - Fetch-anrop använder nu `{ ...options, headers, credentials: 'include' }` så att CSRF-token från headers inte skrivs över av options. Ändrat i AppContext, orders, inspection, notes, contacts, estimates, invoices, tasks, mail, files, products, channels, cdon, fyndiq, woocommerce, shipping.
  - Filer: [client/src/core/api/AppContext.tsx](client/src/core/api/AppContext.tsx) och API-moduler i plugins.

### Orders sync – inga felmeddelanden och fix för fastnad lock

- **Pool error handlers**
  - Lagt till `pool.on('error', ...)` på huvudpoolen och `sessionPool` i server/index.ts. Vid tillfälliga DB-avbrott (t.ex. Neon timeout) kraschar inte servern längre; felaktiga connections tas bort och poolen fortsätter fungera.
  - Samma error-hantering för tenant-pools i [server/core/services/connection-pool/providers/PostgresPoolProvider.js](server/core/services/connection-pool/providers/PostgresPoolProvider.js).
- **Frontend**
  - Sync-status-pollningen ignorerar fel vid tillfälliga DB/network-avbrott; användaren ser inga felmeddelanden.
- **Orders – visuell gruppering av CDON/Fyndiq-order**
  - CDON och Fyndiq returnerar en order per artikel; samma köp visas därför som flera order. UI grupperar nu visuellt ordrar som hör ihop (samma kund + samma tidpunkt): indrag, vertikal blå linje till vänster och subtil blå bakgrund. Ingen backend-ändring – enbart frontend.
  - **Gruppnyckel** (fix): Använder endast `shipping_address.full_name` + exakt `placedAt`. Ingen kanal, market eller fallbacks – matchar API-dokumentation och databas (full_name finns alltid i CDON/Fyndiq).
  - **Visuell markering** (fix): Grupperingen fungerade men var svår att se (border-muted). Nu: `border-blue-500` och `bg-blue-50/40` för grupperade rader.
  - Fil: [client/src/plugins/orders/components/OrdersList.tsx](client/src/plugins/orders/components/OrdersList.tsx).
- **WooCommerce-order synkas inte (identifierat, ingen fix)**
  - Om en WooCommerce-order (t.ex. Mobilhallen) inte kommer med kan det bero på: (1) `getSlotsToSync` får tom lista från `listInstances` pga session/tenant-bug, (2) `shouldRunQuickSync` returnerar false om CDON/Fyndiq redan är "färska", (3) `last_cursor_placed_at` gör att WooCommerce endast hämtar order nyare än senaste sync. Avvaktar om nästa order kommer in.

- **Stale lock-fix (Orders-synken hängde sig)**
  - Om en sync kraschade (t.ex. serveromstart) sparades aldrig `running_since = NULL`; backend trodde att sync redan körde och returnerade `{ started: false, reason: "locked" }`, så ingen ny sync kunde starta och laddningsindikatorn visades aldrig.
  - Lagt till `STALE_RUNNING_MINUTES = 15`: om `running_since` är äldre än 15 minuter betraktas den som föråldrad (kraschad sync) och ignoreras.
  - `isBusyForUser`: räknar nu bara som "upptagen" om `running_since` är nyare än 15 minuter.
  - `trySetRunning`: kan nu ta över en slot när `running_since` är NULL eller äldre än 15 minuter.
  - Fil: [plugins/orders/orderSyncState.js](plugins/orders/orderSyncState.js).

### PostNord Shipping

- **Nytt plugin för PostNord-fraktbokning**
  - Plugin i E-handel-sektionen. Inställningar: kundnummer, avsändare, standardvikt (0,15 kg för produkter utan vikt), etikettformat (Både/PDF/ZPL).
  - Fraktbokning via PostNord API (Customer Plan). Modal visar tidigare valda tjänster och aktuellt etikettformat.
  - Efter bokning: nedladdningsknappar för PDF- och ZPL-etiketter i expanderad ordervy. Orderlistan uppdateras vid `shipping:booked`-event.
  - Migrering 053-shipping-postnord.sql. API-dokumentation: docs/POSTNORD_API_DOCUMENTATION_RAW_SWAGGER.md.
  - Filer: plugins/shipping/, client/src/plugins/shipping/.

### Kritisk säkerhetshärdning (fail-closed)

- **CSRF återaktiverat end-to-end**
  - No-op/dummy-token borttagen i `server/core/middleware/csrf.js`.
  - `/api/csrf-token` använder nu riktig token-generering via middleware.
  - CSRF-skydd återinfört på muterande routes i `invoices`, `estimates`, `tasks`, `notes`, `files`.
  - Klient-API: CSRF-header återaktiverad i `AppContext`, `contacts`, `notes`, `tasks`, `invoices`, `estimates`.
- **Fail-fast för hemligheter i produktion**
  - Produktionsstart blockeras om `DATABASE_URL`, `SESSION_SECRET` eller `CREDENTIALS_ENCRYPTION_KEY` saknas.
  - `.env.example` uppdaterad med `CREDENTIALS_ENCRYPTION_KEY`.
- **Minskad secrets-exponering**
  - `/api/admin/tenants` returnerar inte längre `neon_connection_string`.
  - Channels-instansers `credentials` maskas i API-svar.
- **Kryptering av lagrade credentials**
  - Ny gemensam krypteringstjänst: `server/core/services/security/CredentialsCrypto.js`.
  - Kryptering vid write + lazy migrering av legacy plaintext i:
    - `plugins/mail/model.js`
    - `plugins/shipping/model.js`
    - `plugins/cdon-products/model.js`
    - `plugins/fyndiq-products/model.js`
    - `plugins/files/cloudStorageModel.js`
- **Session/log-härdning**
  - Tenant DB-credentials lagras inte längre i session; tenant-pool resolve:as server-side från tenant-id.
  - SQL/INSERT-loggning i `PostgreSQLAdapter` maskar/utelämnar parameter-värden.

### Dokumentation – säkerhet och refaktorering

- **SECURITY_GUIDELINES**
  - Ny sektion "Production Launch Baseline (MUST before release)" med 8 kritiska krav.
  - Checklista "Current Security Gap Tracker" för release sign-off.
  - Fil: [docs/SECURITY_GUIDELINES.md](docs/SECURITY_GUIDELINES.md).
- **REFACTORING_EXISTING_PLUGINS**
  - Uppdaterad till @homebase/core-mönster (Database.get(req), Logger, Context.getUserId(req)) för 3.1.
  - Fil: [docs/REFACTORING_EXISTING_PLUGINS.md](docs/REFACTORING_EXISTING_PLUGINS.md).

### Plocklista PDF

- **Marginaler och tabellstil**
  - Sidmarginaler 10mm. Uppdaterad tabellstil och avgränsningslinje.
  - Fil: [plugins/orders/plocklistaPdfTemplate.js](plugins/orders/plocklistaPdfTemplate.js), [plugins/orders/controller.js](plugins/orders/controller.js).

### Session-stabilitet och städning

- **Dev session-stabilitet (localhost)**
  - Vite-proxy slutade skriva om `Set-Cookie` manuellt; cookie-hantering sker nu standardmässigt via proxy för att minska sessionsplit/race i dev.
  - CORS i servern begränsad till `localhost`-origins i dev (inte `127.0.0.1`) för konsekvent cookie-domän.
  - `checkAuth` i AppContext har kort retry vid första `401` på `/api/auth/me` innan auth-state nollställs.
  - Verifierat i loggtest (snabba reloads): samma `sid`, `hasUser: true` och återkommande `GET /api/auth/me` med `200 OK`.

- **checkAuth guard**
  - AppContext använder `isCheckingAuth` ref så att endast ett checkAuth-anrop körs åt gången. Undviker race där parallella anrop kan få olika svar (t.ex. 200 vs 401) och skriva över auth-state.
  - Fil: [client/src/core/api/AppContext.tsx](client/src/core/api/AppContext.tsx).

- **Session pool**
  - Session-poolen ökad till max 10 connections. Lagt till `idleTimeoutMillis: 30000` och `connectionTimeoutMillis: 5000` för stabilare session-hantering.
  - Fil: [server/index.ts](server/index.ts).

- **Borttagning av uuid-referenser**
  - `req.session.user.uuid` var aldrig satt (users-tabellen har ingen uuid-kolumn). Alla fallbacks `req.session?.user?.id ?? req.session?.user?.uuid` ersatta med `req.session?.user?.id` i server, plugins och types.
  - Filer: server/index.ts, server/types/express.d.ts, server/core/lists/listsModel.js, plugins (channels, products, orders, cdon-products, fyndiq-products, woocommerce-products, files, inspection), plugins/orders/orderSyncState.js.

### Dedupe och prioritering (auth och data)

- **En enda getMe**
  - `GET /api/auth/me` anropas endast från AppContext vid start. TopBar använder `activeTenantId` och `user` från `useApp()`; ingen egen fetch till `/api/auth/me` (ingen `loadCurrentTenant`).
  - AppContext sparar och exponerar `activeTenantId` från getMe-svaret via `tenantId`.
  - Filer: [client/src/core/api/AppContext.tsx](client/src/core/api/AppContext.tsx), [client/src/core/ui/TopBar.tsx](client/src/core/ui/TopBar.tsx).

- **Prioriterad dataladdning**
  - Efter getMe: contacts hämtas först (kritiskt för första skärmen), därefter notes och tasks parallellt i bakgrund.
  - Filer: [client/src/core/api/AppContext.tsx](client/src/core/api/AppContext.tsx) (`loadData`).

### Dedupe contacts, notes, tasks

- **En gemensam källa**
  - ContactContext, NoteContext och TaskContext hämtar inte längre egna listor. De använder `contacts`, `notes` respektive `tasks` från `useApp()`. Efter create/update/delete anropas `refreshData()` så att AppContext uppdaterar och alla får samma data.
  - AppContext exponerar `tasks` i context (tidigare endast internt) och `refreshData()`.
  - Filer: [client/src/core/api/AppContext.tsx](client/src/core/api/AppContext.tsx), [client/src/plugins/contacts/context/ContactContext.tsx](client/src/plugins/contacts/context/ContactContext.tsx), [client/src/plugins/notes/context/NoteContext.tsx](client/src/plugins/notes/context/NoteContext.tsx), [client/src/plugins/tasks/context/TaskContext.tsx](client/src/plugins/tasks/context/TaskContext.tsx).

### Rate limit

- **Undantag för auth och debug**
  - `/api/auth/me` och `/api/debug-log` är undantagna från global rate limit så att getMe inte får 429 vid sidladdning.
  - Fil: [server/core/middleware/rateLimit.js](server/core/middleware/rateLimit.js).

### Pomodoro-fönster

- **Popover i stället för absolut panel**
  - Ny komponent [client/src/components/ui/popover.tsx](client/src/components/ui/popover.tsx) (Radix Popover). Pomodoro-panelen i TopBar renderas i en Popover (portalas till body), positioneras under trigger och stängs vid klick utanför eller Escape.
  - [client/src/core/ui/pomodoro/PomodoroTimer.tsx](client/src/core/ui/pomodoro/PomodoroTimer.tsx): i compact-läge wrappas trigger och panelinnehåll i `Popover` med `PopoverContent`; ingen absolut-positionerad div som kan klippas.

- **Öppna/stäng via trigger (ingen dubbelöppning)**
  - Pomodoro och Time Tracking (Timer) använder nu `PopoverTrigger` istället för `PopoverAnchor`. State synkas i `onOpenChange`: vid öppning anropas `onToggle`/intern state, vid stängning `onClose`. Ett klick på knappen när panelen är öppen stänger den (samma beteende som krysset) utan att panelen öppnas igen. Inga workarounds (stopPropagation/onClickCapture) kvar.
  - Filer: [client/src/core/ui/pomodoro/PomodoroTimer.tsx](client/src/core/ui/pomodoro/PomodoroTimer.tsx), [client/src/core/widgets/time-tracking/TimeTrackingWidget.tsx](client/src/core/widgets/time-tracking/TimeTrackingWidget.tsx).

### Bulk contacts

- **Migration 049**
  - Contact time entries (tidspåslag) och tags; contacts får `tags` och `is_assignable` (paritet med 3.X). Migration: [server/migrations/049-contacts-time-entries-and-tags.sql](server/migrations/049-contacts-time-entries-and-tags.sql).

- **Bulk delete**
  - Backend: [server/core/helpers/BulkOperationsHelper.js](server/core/helpers/BulkOperationsHelper.js), bulk delete i [plugins/contacts/controller.js](plugins/contacts/controller.js), [plugins/contacts/routes.js](plugins/contacts/routes.js), [plugins/contacts/model.js](plugins/contacts/model.js).
  - Client: [client/src/core/api/bulkApi.ts](client/src/core/api/bulkApi.ts), [client/src/core/hooks/useBulkSelection.ts](client/src/core/hooks/useBulkSelection.ts), [client/src/core/ui/BulkActionBar.tsx](client/src/core/ui/BulkActionBar.tsx), [client/src/core/ui/BulkDeleteModal.tsx](client/src/core/ui/BulkDeleteModal.tsx). ContactList med bulk selection; ContactView visar time log och kan ta bort. [client/src/core/ui/ContentLayoutContext.tsx](client/src/core/ui/ContentLayoutContext.tsx), [client/src/core/ui/DetailLayout.tsx](client/src/core/ui/DetailLayout.tsx) för layout.
  - Validering: [server/core/middleware/validation.js](server/core/middleware/validation.js) för bulk-rutter.

- **Import/export**
  - [client/src/core/utils/displayNumber.ts](client/src/core/utils/displayNumber.ts), [client/src/core/utils/exportUtils.ts](client/src/core/utils/exportUtils.ts), [client/src/core/utils/importUtils.ts](client/src/core/utils/importUtils.ts), [client/src/core/ui/ImportWizard.tsx](client/src/core/ui/ImportWizard.tsx). Contacts API och komponenter uppdaterade för export/import.

### Bulk-UI för Notes och Tasks

- **NoteList och TaskList**
  - Checkbox per rad, toggle-all, BulkActionBar och BulkDeleteModal. Bulk delete använder befintliga batch-endpoints (`DELETE /api/notes/batch`, `DELETE /api/tasks/batch`). Samma mönster som ContactList; core-komponenter [BulkActionBar](client/src/core/ui/BulkActionBar.tsx), [BulkDeleteModal](client/src/core/ui/BulkDeleteModal.tsx).
  - Filer: [client/src/plugins/notes/components/NoteList.tsx](client/src/plugins/notes/components/NoteList.tsx), [client/src/plugins/tasks/components/TaskList.tsx](client/src/plugins/tasks/components/TaskList.tsx).

### Estimates, Invoices, Notes, Tasks – parity med 3.X

- **Backend**
  - Batch delete och validering för estimates, invoices, notes, tasks. Routes, controller och model uppdaterade (t.ex. `bulkDelete`, batch-rutter) i [plugins/estimates](plugins/estimates), [plugins/invoices](plugins/invoices), [plugins/notes](plugins/notes), [plugins/tasks](plugins/tasks).
- **Frontend**
  - EstimateContext, InvoicesContext, NoteContext och TaskContext använder listor från `useApp()` och anropar `refreshData()` efter create/update/delete. Listor och API (estimatesApi, invoicesApi, notesApi, tasksApi) uppdaterade för bulk delete och konsekvent dataladdning.

### Övrigt

- **Debug-loggning**
  - Kvar i server ([server/index.ts](server/index.ts), [server/core/routes/auth.js](server/core/routes/auth.js)) och client (checkAuth skickar till `/api/debug-log`); [vite.config.ts](vite.config.ts) proxy för `/api/auth/me` vid behov.

---

## Senare – UX-förbättringar

### Close i Settings

- **Val:** På inställningssidan visas en **Close**-knapp i content header som tar användaren tillbaka till den sida de var på innan de öppnade Settings (t.ex. Contacts, Notes), istället för att endast navigera via sidomeny.
- **Implementering:** Vid navigering till Settings sparas nuvarande sida i en ref; Close anropar `onPageChange(sparadSida)`. Minimalt ingrepp (ref + villkorad action i [client/src/App.tsx](client/src/App.tsx)).
- **Motivering:** Tydligare avslut av inställningsflödet och snabbare tillbaka till det man höll på med.

---

**Senast uppdaterad:** 2026-02
