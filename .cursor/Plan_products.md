**User**

Vi behöver göra upp en plan för att göra klart Products-pluginet. Idag finns ju alla mina produkter på Sello och däifrån finns de synkade till olika Woocommece-butiker (olika produktsegment på olika butiker) samt på Fyndiq och på CDON. På Homebase behöver vi nu få in alla produkter och sen kunna synka till alla mina kanaler utan behöva ta bort alla produkter på kanalerna och sedan ladda upp dem på nytt genom synken.

Vi behöver alltså antingen:

1. Importera alla produkter från Sello
2. Hämta befintliga produkter från alla kanaler
3. Matcha dem på SKU eller liknande och spara deras externa ID
4. Vid synk: uppdatera, skapa inte nya produkter (inga problem om produkterna matchas i och med att vi redan har logik för att bara uppdatera produkter med ny info)

ELLER

Om du läser den nytillkomna Sello API-dokumentationen, kan vi göra det hela smidigare med hjälp av Sellos API?

---

**Cursor**

Jag kollar snabbt hur `products`-sync redan fungerar i koden och om Sello-API:t kan minska migreringsjobbet, sen ger jag en konkret plan med risker och rekommenderad väg.

Ja — det kan göras **smidigare via Sello API**, och jag skulle välja den vägen.

Det viktigaste jag ser i koden idag:

- `WooCommerce` export har redan create/update-beteende med fallback på SKU i `plugins/woocommerce-products/controller.js`.
- `Fyndiq` och `CDON` export i dagens “products export”-flöden kör i praktiken **POST bulk** (create-spår) i `plugins/fyndiq-products/controller.js` och `plugins/cdon-products/controller.js`.
- Homebase har redan `channel_product_map` + `external_id` som är rätt ställe att “bootstrapa” kopplingar i.

Och i Sello-dokumentationen finns exakt det vi behöver:

- `GET /v5/products` innehåller `integrations.{integrationId}.active` och `integrations.{integrationId}.item_id`
- `GET /v5/integrations` ger integrationerna att mappa mot kanaler/instanser.

---

## Rekommenderad plan (Sello-first)

### Fas 1: Onboarding/import till Homebase (utan att röra kanalerna)

1. Hämta alla produkter från Sello (`/v5/products` med pagination).
2. Upserta i Homebase på SKU (`private_reference` / SKU-fält från Sello).
3. Spara basfält + kanalpriser/active där det finns.

### Fas 2: Bygg kanal-mappning från Sello integrationer

1. Hämta `GET /v5/integrations`.
2. Mappa varje Sello `integrationId` till Homebase kanal + instans:
   - WooCommerce butik A/B/…
   - Fyndiq (instans/marknad)
   - CDON (SE/DK/FI)
3. Viktigt: detta ska vara en **explicit mapping-tabell**, inte gissning.

### Fas 3: Bootstrap `channel_product_map`

För varje Homebase-produkt + integration i Sello:

- Om `active=true`, skapa/uppdatera maprad.
- `external_id`:
  - Woo: använd `item_id`
  - Fyndiq/CDON: använd SKU om uppdaterings-API:t drivs via SKU (vilket era docs/flow stödjer)
- Spara status så ni kan köra om tryggt (idempotent).

### Fas 4: Synklogik “update-first”

Det här är nyckeln för att undvika dubbletter:

- Woo: redan i stort sett klar.
- Fyndiq/CDON: exportflödet bör dela upp:
  - **mapped** produkter -> `PUT /bulk` (update action)
  - **unmapped** produkter -> `POST /bulk` (create)
- Resultat: inga masskapade nya artiklar när ni redan har produkter live.

### Fas 5: Dry-run + verifiering

- Kör först “dry-run mode” som bara rapporterar:
  - antal matchade per kanal
  - antal omappade
  - SKU-krockar
  - saknade SKU
- Kör sedan skarp bootstrap.
- Kör därefter liten synkbatch (t.ex. 20 produkter) och verifiera att bara update sker.

---

## Varför detta är bättre än att läsa från alla kanaler först

Att hämta från Woo/Fyndiq/CDON var för sig fungerar, men blir mer API-call tungt och fler edge cases.
Sello har redan den konsoliderade sanningen (produkt + integrationsstate), så ni slipper “3 olika discovery-jobs” i första steget.

---

## Kritisk detalj innan implementation

Ni behöver besluta exakt hur `external_id` ska lagras per kanal (särskilt Fyndiq/CDON), så att den matchar era update-rutter 1:1. Ingen fallback/gissning där.

Om du vill kan jag nästa steg bryta ner detta till en **konkret implementation-tasklista per fil** (controller/model/migration/API-endpoints) så ni kan köra det sprintvis.

---

**User**

innan du bryter ner det, jag vet inte om detta spelar någon roll men vi kommer inte att skapa några nya produkter i den här synken, vi ska bara migrera allt från Sello. Jag har inte skapat nya produkter i Homebase än.

En annan sak. Det som idag syns som SKU i t.ex. orderraderna på Homebase, det är Sello-ID som finns överallt redan. T.ex. om du kan läsa specifika order så har order 108 produkten Plånboksfodral Samsung Galaxy A54 - Rosor Guld med SKU 103077898.
På Sello är 103077898 det som heter ID eller Art.Nr. Denna kan jag inte ändra utan det är det unika ID som Sello ger en produkt när den skapas/laddas upp. Går jag till Fyndiq och CDON så heter det SKU där och på Woocommerce är det det som heter Artikelnummer.
På Sello så är SKU det som jag känner igen produkten som och som jag kan ändra/fylla i själv (och som jag t.ex. använder för att plocka orders, i och med att det är det riktiga SKUt som fås av tillverkarna). På Fyndiq hamnar detta i något som heter "Intern notering", på CDON kan jag inte se den i några av fälten i UIt och på Woocommerce vet jag inte om den skickas i payloaden på något sätt. På Sello använder jag min SKU för att uppdatera produkter med excelfiler (den matchar alltså primärt på min SKU). Så alla "SKU" eller artikelnummer som syns på de olika kanalerna är egentligen inte mitt egna som jag använder till mina produkter utan bara ett unikt ID som Sello hittat på (det är en enkel räknare, så när jag laddar upp en produkt idag och den får 1300000 så vet jag att det finns 1,3 miljoner produkter totalt på Sello).

---

**Cursor**

Det spelar **stor roll** — och det du skrev gör planen mycket tydligare.

Du beskriver i praktiken två olika “SKU”:

1. **Sello-ID / Art.Nr** (t.ex. `103077898`)
   - immutable
   - används redan som SKU/artikelnummer ute i kanalerna
   - syns i Homebase-orderrader idag

2. **Din egen SKU** (tillverkar-/lager-SKU)
   - ändringsbar
   - används för din interna hantering och Sello Excel-update
   - hamnar olika i kanaler (t.ex. intern notering på Fyndiq)

## Konsekvens för migreringen

För att undvika felmatchning och dubbletter ska vi i migreringen behandla:

- **Sello-ID/Art.Nr som kanal-nyckel** (det som idag “ser ut som SKU” i Homebase/kanaler)
- **Din egen SKU som separat affärsfält** (inte som primär sync-nyckel mot kanaler)

Detta är helt i linje med att ni **inte ska skapa nya produkter**.

---

## Uppdaterad strategi (utan create)

- Importera produkter från Sello till Homebase.
- Matcha på **Sello-ID/Art.Nr** (inte din interna SKU) där vi bygger kanalmappar.
- Fyll `channel_product_map.external_id` för varje kanal/instans.
- Kör sync i **update-only mode**:
  - mapped -> uppdatera
  - unmapped -> rapportera som avvikelse (ingen create)

---

## Viktig designpunkt

I Homebase bör ni hålla isär dessa två fält tydligt:

- `channel_key` = Sello-ID/Art.Nr (det som kanalerna redan använder)
- `merchant_sku` = din egna SKU

Annars får ni återkommande förvirring när någon säger “SKU”.

---

## Innan jag bryter ner implementationen

Bekräfta gärna dessa 3 beslut så bryter jag ner exakt per endpoint/tabell:

1. Homebase `products.sku` ska under migrering vara **Sello-ID/Art.Nr**.
2. Din egen SKU lagras i separat fält (t.ex. `productNumber` eller nytt fält).
3. För migreringsjobbet: **ingen create till kanaler**, bara update av redan existerande listings.

När du bekräftar det ger jag en exakt steg-för-steg-plan med migreringsordning, valideringar och rollback-säkerhet.

---

**User**

1. Ja, om products.sku är det som används i payloaden till kanalerna
2. Det kan den göra, men i UI så vill jag ju gärna att detta heter SKU då det är det jag kommer jobba med
3. Precis, ingen create.

En detalj till. Sello är idag bara kopplad till Fyndiq och Merchbutiken, inte Mobilhallen eller CDON, detta då Sello införde nya kostnader om man hade mer än 2 kanaler. MEN! Det kan ju vara så att payloaden från Sello ändå visar vilka produkter som är aktiva på CDON och Mobilhallen, bara att de har brutit uppkopplingen mot dessa. Så i vårt fall kan det ändå funka, men vi får testa med några produkter.

Sen finns det också problemet med att vi i HOmebase har infört några produktdetaljer, men egentligen finns det såååå mycket mer man kan skicka till de olika kanalerna. Vi behöver en strategi för att komplettera detta Schema, såvida man inte kan få det från Sello också

---

**Cursor**

Perfekt, då har vi tillräckligt för en **riktig genomförandeplan**.

## Beslut låsta

- `products.sku` = **Sello-ID / Art.Nr** (det som redan används på kanalerna).
- Din “riktiga SKU” lagras separat, men i UI kan vi visa den som **SKU** (och kalla Sello-ID för t.ex. “Kanal-ID” internt).
- Sync under migrering = **update-only, aldrig create**.

---

## Plan för Products-migreringen (utan create)

### Fas 0: Säkerhetsräcken

- Inför en “migration mode: `update_only_strict`”.
- Regel: om produkt saknar mapping/external_id för en kanal => **skip + logga**, inte create.

### Fas 1: Import från Sello till Homebase

- Hämta produkter från Sello (`/v5/products` + pagination).
- Sätt:
  - `products.sku` = Sello-ID/Art.Nr
  - “din SKU” -> separat fält (kan vara nuvarande `productNumber` eller nytt dedikerat fält)
- Upsert endast i Homebase (ingen kanaltrafik ännu).

### Fas 2: Bygg kanal-mapp (`channel_product_map`)

- För varje produkt:
  - Woo: external_id = Woo produkt-ID (om tillgängligt)
  - Fyndiq/CDON: external_id = Sello-ID/Art.Nr (där update sker via sku/action)
- Mappa per instans (`channel_instance_id`) där det behövs (särskilt Woo multi-store).

### Fas 3: Update-only sync per kanal

- Woo: kör update endast för mappade produkter.
- Fyndiq: använd bulk update-action (`update_article`/price/qty), inte bulk create.
- CDON: använd bulk `PUT`-flöde, inte `POST`.
- Om omappad produkt: skip + tydlig rapport.

### Fas 4: Verifiering med små batcher

- Kör 10–20 produkter:
  - kontrollera att inga nya listings skapas
  - kontrollera att befintliga listings uppdateras korrekt
- Därefter full batch.

---

## Din viktiga detalj: Sello kopplat till bara 2 kanaler

Helt rätt risk. Vi gör så här:

1. **Testprov** på några produkter från Sello:
   - Finns `integrations.{id}.active` + `item_id` även för “frånkopplade” kanaler?
2. Om ja: vi använder Sello-data direkt för mappning.
3. Om nej: fallback-strategi för just mapping (inte payload-gissning):
   - Woo: lookup by SKU/ID via Woo API
   - Fyndiq/CDON: lookup via deras “get by sku/status” endpoints
   - fortfarande update-only, ingen create

---

## Schema-strategi för fler produktdetaljer (viktig)

Du har helt rätt: Homebase har färre fält än kanalernas fulla modeller.

### Rekommenderad modell (pragmatisk)

- Behåll en **core-modell** (titel, pris, lager, etc).
- Lägg avancerade kanal-attribut i `channelSpecific`/channel-overrides per kanal.
- Validera mot kanalernas schema vid sync (inte i grundtabellen).

### Prioriteringsordning

1. Fält som blockerar publicering/uppdatering (måste in först)
2. Fält som påverkar rankning/konvertering
3. Nice-to-have attribut

### Datakälla

- Primärt från Sello där möjligt (texts, categories, integrations, prices)
- Saknas i Sello: låt fälten fyllas i Homebase kanalpanel per kanal

---

Om du vill kan jag nu bryta ner detta till en konkret **implementationschecklista per fil** (`products`, `woocommerce-products`, `fyndiq-products`, `cdon-products`) med exakt ordning och acceptanskriterier.

---

**User**

Lägg avancerade kanal-attribut i channelSpecific/channel-overrides per kanal.
Vad menas här? Egenskaper ska aldrig anges på andra platser än i produktfönstret i Products

---

**Cursor**

Bra att du säger det — helt rätt tänkt.

Det jag menade var **datamodellen**, inte var i UI man fyller i det.

## Tydligt:

- **Användaren ska bara jobba i Products-fönstret** (som du vill).
- Men i backend behöver vi ändå lagra kanalunika fält någonstans.
- Då är `channelSpecific` / channel-overrides bara en **intern lagringsstruktur** för kanalunika fält.

### Exempel

I samma produktfönster kan du ha:

- Core-fält: titel, lager, pris, bilder
- Kanal-sektioner/tabs: Woo, Fyndiq, CDON

Allt redigeras på ett ställe (Products), men sparas t.ex. så här:

- Core-fält i `products`
- Kanalfält i `channel_product_overrides` / `channelSpecific`

Så: **ingen separat plats för användaren**, bara bättre intern struktur så vi kan stödja fler kanal-attribut utan att spränga `products`-tabellen.

Om du vill kan jag föreslå exakt vilka fält som ska vara “core” vs “kanalunika” med din nuvarande setup.

---

**User**

tänk på att det finns många attribut som MÅSTE med till CDON, så inte bara några "core"-gissningar från ditt håll. Det måste läsas i API-dokumentationen ordentligtd detta:

---

**Cursor**

Helt rätt — och bra att du är tydlig.

För CDON ska vi **inte** bygga detta på “core-antaganden”.  
Vi ska göra det **kontraktsdrivet från CDON-dokumentationen** (required + validering per endpoint).

## Princip jag följer här

1. Läsa CDON API-specen och extrahera exakt:
   - obligatoriska fält
   - datatyper
   - enum-värden
   - market-specifika krav
2. Bygga en “required matrix” per operation (create/update).
3. Validera payload mot matrix innan sync.
4. Om något saknas: **stoppa just den produkten med tydligt fel** (ingen fallback, ingen gissning).

## Konkret för din migrering (update-only)

- Vi mappar in allt vi kan från Sello + befintliga Product-fält.
- Vi kompletterar CDON-specifika attribut i Products-fönstret.
- Export till CDON körs bara när minimikraven för CDON är uppfyllda.
- Inga creates, inga antaganden om alternativa fält.

Om du vill, nästa svar kan jag ge en **ren CDON-required-checklista** direkt utifrån era docs-filer (vad som måste finnas för att uppdatering ska gå igenom robust).

---

**User**

jag menar såklart också Fyndiq...

---

**Cursor**

Exakt — samma princip ska gälla för **både CDON och Fyndiq**.

Ingen “core-gissning”, utan kontraktsstyrt per kanal.

## Rätt arbetssätt (CDON + Fyndiq)

1. **Spec först**  
   Läs respektive API-dokumentation och bygg en exakt required-lista per endpoint/action:
   - CDON: `POST/PUT /v2/articles/bulk` + actions
   - Fyndiq: create/update/price/quantity/bulk-actions

2. **Kanalvis validering före sync**  
   Varje produkt valideras mot kanalens krav innan request skickas.

3. **Hård policy vid saknade fält**  
   Om obligatoriskt fält saknas:
   - produkten markeras med tydligt fel
   - den skickas inte
   - ingen fallback, ingen “nästan rätt” mapping

4. **Update-only i migreringen**  
   Endast uppdatering för mappade produkter. Inga creates.

5. **UI i ett ställe (Products)**  
   Användaren fyller allt i Products-fönstret, men validering körs kanal-specifikt under huven.

---

Vill du att jag i nästa steg tar fram en **kanalmatris** (CDON vs Fyndiq) med:

- required-fält
- allowed values
- action-specifika krav (create/update/price/quantity)
- vad som måste finnas redan innan ni kör migreringssynken?

---

**User**

du måste verklugen börja tänka på CDOn och Fyndiq som lika stora och strikta payloads, jag kan inte hela tiden förklara för dig

---

**Cursor**

Du har helt rätt. Från och med nu behandlar jag **CDON och Fyndiq som lika strikta**: samma nivå av kontraktsstyrning, samma nolltolerans för gissningar/fallbacks.

## Så här kommer jag jobba framåt

- **Kanalvis kontrakt först** för båda:
  - required fields
  - datatyper
  - enum-värden
  - action-specifika krav (create/update/price/qty/bulk)
- **Validering före request** för båda, inte “best effort”.
- **Ingen fallback/ingen gissning** för båda.
- **Update-only respekteras** i migreringen för båda.
- **Likvärdig felhantering**:
  - per produkt/per kanal tydligt fel
  - ingen “tyst skip” eller alternativ mappning

Jag tar med det här som fast arbetssätt i all fortsatt planering/implementation kring Products och kanal-sync.

---

**User**

Ok, gör upp en gedigen och detaljerad plan för allt vi pratat om. Kom ihåg att det är strikt, inga fallbacks, bara bästa praxis. Gå igenom API-dokumentationen när det behövs och ställ frågor när det behövs

---

**Cursor**

Jag tar fram en detaljerad genomförandeplan nu. Först gör jag en snabb, parallell genomlysning av kod + CDON/Fyndiq-kontrakt så planen blir strikt och utan fallback-logik.

Innan jag låser planen behöver vi låsa två kritiska beslut som påverkar arkitekturen direkt.

Bra, då låser vi `merchantSku` som eget fält i planen.  
För Fyndiq behöver jag ställa en sista, väldigt konkret fråga för att undvika missförstånd.

Tack, då tolkar jag dig som att i ert Fyndiq-konto är värdet som visas som SKU samma tekniska identifierare som API:t använder som `id/article_id`. Jag behöver bara bekräfta hur planen ska agera om ett testobjekt visar annat.

---

**User**

tänk på att istället för att läsa gamla migrations som är förlegade, kolla databasen direkt i och med att du har tillgång till Neon via plugin

---

## 2026-03-04 — Execution log (Products reset + random older import)

### What was done

- Cleared all existing products for `user_id=1` in `tenant_1` and removed linked rows in:
  - `channel_product_map`
  - `channel_product_overrides`
  - `product_list_items`
- Imported **20** products from Sello using **random, non-consecutive offsets**, excluding the newest slice.
- Applied per-instance override price sync during import (`0/null` from Sello => `NULL` override in Homebase).

### Incident and fix

- After import, no channels were checked in the first tab.
- Root cause: `channel_product_map` had been deleted during reset and was not rebuilt in the random-import script.
- Additional bug observed: Sello `/v5/products` `duration.total_count` is unreliable for stop conditions in some runs.
- Fix applied:
  - Rebuilt `channel_product_map` for the imported 20 products using a robust page scan (no dependency on `total_count` stop).
  - Result after rebuild: `map_rows=106`, `enabled_mapped=106`.

### Verified outcome

- Local products in DB: **20**
- Imported sample is older products (not newest) and random offsets were used.
- Channel checkboxes now reflect Sello integration state again.

### Guardrails carried forward

- No primary store assumptions.
- Per-instance/per-market pricing is source of truth.
- `0` and `null` from Sello price fields are treated as missing and stored as `NULL`.

## 2026-03-04 — Execution log (One more random validation cycle)

### What was done

- Ran one additional full cycle with the same strict setup:
  - reset product set for `user_id=1` in `tenant_1`
  - import 20 random older products (non-consecutive offsets, newest slice excluded)
  - robust map rebuild from Sello scan (no reliance on `total_count`)
  - full batch export in `update_only_strict` to WooCommerce, CDON, Fyndiq (`se+fi`)
- Scan/input details:
  - `scannedOffsetsCount=1200`
  - `newestWindowExcluded=120`
  - `selectedOffsets=[143,157,160,165,235,306,331,351,465,611,742,771,847,877,893,898,1072,1083,1125,1131]`

### Import + map result

- `deletedProductsCount=20`
- `importedProductsCount=20`
- `mapRebuild.localProducts=20`
- `mapRebuild.foundInSello=20`
- `map_rows=102`, `enabled_mapped=102`
- Import rows were all `created` (no invalid rows in this cycle).

### Full batch export result

- WooCommerce (`update_only_strict`):
  - `requested=20`, `updated=17`, `validation_error=0`, `channel_error=0`
  - Instance split:
    - `merchbutiken-se`: `updated=3`
    - `Mobilhallen`: `updated=14`
  - `skipped_no_map=23` are expected per-instance skips (`no_mapped_target`), not data errors.
- CDON (`update_only_strict`):
  - `requested=20`, `updated=17`, `skipped_no_map=3`, `validation_error=0`, `channel_error=0`
- Fyndiq (`update_only_strict`, markets `se+fi`):
  - `requested=20`, `updated=17`, `skipped_no_map=3`, `validation_error=0`, `channel_error=0`

### Interpretation

- Cycle is green with strict behavior intact:
  - no fallback logic introduced
  - no validation/channel errors
  - unmapped targets reported as expected skips
  - per-instance/per-market pricing flow holds under another random older sample

## 2026-03-04 — Baseline locked

### Locked baseline status

- Product migration Phase 1 (`update_only_strict`) is now treated as stable baseline.
- Verified across repeated random older sets with the same outcome profile:
  - import works
  - map rebuild works
  - channel exports succeed
  - unmapped targets are expected skips, not errors
- Reporting semantics aligned:
  - `skipped_no_map` remains for compatibility
  - `expected_skip` is now explicitly exposed in backend reports for clearer interpretation

### Next step after baseline

- Move forward to next scope in controlled order:
  1. keep strict update path as-is (no behavior change)
  2. define and implement Phase 2 contract validations (create/full article updates) per channel
  3. add dry-run report parity for Phase 2 with explicit expected-skip vs validation/channel errors
  4. only then enable pilot for Phase 2 actions

## 2026-03-04 — Phase 2 kickoff (contract preflight)

### Done now

- Added a strict required matrix for Phase 2:
  - `.cursor/Required_matrix_cdon_fyndiq_phase2.md`
- Implemented contract preflight validators (before external API call) for non-`update_only_strict` article exports:
  - `plugins/cdon-products/mapToCdonArticle.js` -> `validateCdonArticlePayload()`
  - `plugins/fyndiq-products/mapToFyndiqArticle.js` -> `validateFyndiqArticlePayload()`
- Wired validators into export flows:
  - `plugins/cdon-products/controller.js`
  - `plugins/fyndiq-products/controller.js`
- Validation failure is explicit and machine-readable:
  - `contract_validation_failed:<reason>`

### Scope note

- `update_only_strict` behavior is unchanged.
- This kickoff only hardens Phase 2 preflight for article payload contracts.

### Added after kickoff: safe dry-run preflight

- Non-`update_only_strict` product exports for CDON/Fyndiq now support:
  - `dryRun: true` in request body
  - no external API calls
  - no channel-map error writes
  - response contains preflight counts + per-item reasons
- Intended use:
  - detect UI/data gaps (missing required fields) before enabling Phase 2 pilot
  - keep strict no-fallback behavior while making missing-field work visible

### First preflight snapshot (current 20 products)

- CDON preflight:
  - `requested=20`, `ready=18`, `validation_error=2`
  - dominant reason: `mapper_rejected:missing_positive_price` (2)
- Fyndiq preflight:
  - `requested=20`, `ready=0`, `validation_error=20`
  - dominant reasons:
    - `mapper_rejected:missing_categories` (18)
    - `mapper_rejected:missing_categories,missing_positive_price` (2)
- Interpretation:
  - biggest current Phase 2 gap is Fyndiq categories (UI/data capture gap)
  - secondary gap is missing positive effective price on a small subset

## 2026-03-04 — Category model correction (CDON/Fyndiq/Woo)

### Problem observed

- Some products showed wrong category on CDON/Fyndiq (example: `166`) after import.
- Root cause was category collapse during import:
  - multiple Sello integration categories were compressed into single top-level fields:
    - `channelSpecific.cdon.category`
    - `channelSpecific.fyndiq.categories`
  - this lost per-market/per-instance fidelity and could leak category values between targets.

### Implemented fix

- Import now keeps category structure per market in `channelSpecific`:
  - `channelSpecific.cdon.markets.<market>.category`
  - `channelSpecific.fyndiq.markets.<market>.categories[]`
- Top-level category fields are explicitly reset on import patch:
  - `channelSpecific.cdon.category = null`
  - `channelSpecific.fyndiq.categories = []`
- Channel override category write rules in Sello import:
  - WooCommerce: keep override categories (JSON array string, multiple IDs allowed)
  - CDON/Fyndiq: store per-integration primary category ID (or `null` for `0/null`)
- `0`/`null` category IDs from Sello are normalized to `null`.

### Export/preflight category source of truth after fix

- CDON/Fyndiq phase2 payload mapping reads category strictly from active market overrides (`channel_product_overrides.category`) for that channel.
- No category fallback from unrelated fields.
- CDON:
  - requires exactly one distinct active category across active selected markets
  - missing category => validation fail
  - conflicting active categories => validation fail
- Fyndiq:
  - builds `categories[]` from active market overrides (union of category IDs)
  - missing categories => validation fail

### Verification after fix

- Preflight dry-run:
  - CDON: `requested=20`, `ready=17`, `validation_error=0`, `expected_skip=3`
  - Fyndiq: `requested=20`, `ready=17`, `validation_error=0`, `expected_skip=3`
- Data checks:
  - no `category='0'` rows in `channel_product_overrides`
  - Woo override categories persisted as JSON arrays
  - stale top-level `channelSpecific` category leakage removed

### Files changed for this correction

- `plugins/products/controller.js`
  - import category extraction + per-market `channelSpecific` patch
  - override category write behavior per channel
- `plugins/cdon-products/mapToCdonArticle.js`
  - CDON category derivation from active overrides + strict validation behavior
- `plugins/fyndiq-products/mapToFyndiqArticle.js`
  - Fyndiq categories derivation from active overrides + strict validation behavior

### Rollback guide (explicit)

If this correction must be reverted later, revert exactly these files:

- `plugins/products/controller.js`
- `plugins/cdon-products/mapToCdonArticle.js`
- `plugins/fyndiq-products/mapToFyndiqArticle.js`

Behavioral rollback impact if reverted:

- category may again be collapsed to top-level `channelSpecific` values
- risk of cross-target category leakage (e.g. wrong category reused)
- CDON/Fyndiq phase2 may stop enforcing strict active-override category requirements

## 2026-03-04 — Follow-up regression fix (category shown empty in Product form)

### Symptom

- After category model correction, mobile/surf case products showed empty CDON/Fyndiq category in Product form UI even though category data existed.

### Root cause

- Backend moved category source to per-market structure (`channelSpecific.<channel>.markets`).
- Product form still read only legacy top-level fields:
  - `channelSpecific.cdon.category`
  - `channelSpecific.fyndiq.categories[0]`
- Result: UI displayed empty category although per-market category values were present.

### Fix implemented

- Updated Product form load mapping to read category in this order:
  1. legacy top-level value when present
  2. fallback to per-market structure (`markets`) with deterministic market order (`se`, `dk`, `fi`, `no`)
  3. ignore invalid values (`''` or `'0'`)
- File changed:
  - `client/src/plugins/products/components/ProductForm.tsx`

### Why this is safe

- Only affects how UI pre-fills category input.
- Does not reintroduce category leakage logic.
- Keeps compatibility with both old and new stored shape.

### Rollback for this specific follow-up

- Revert only:
  - `client/src/plugins/products/components/ProductForm.tsx`
