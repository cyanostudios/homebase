> **ARKIVERAD:** Denna fil är arkiverad och kan användas som referens i sista hand. Den ska inte gälla som aktuellt dokument.

---

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
- `Fyndiq` och `CDON` export i dagens "products export"-flöden kör i praktiken **POST bulk** (create-spår) i `plugins/fyndiq-products/controller.js` och `plugins/cdon-products/controller.js`.
- Homebase har redan `channel_product_map` + `external_id` som är rätt ställe att "bootstrapa" kopplingar i.

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

### Fas 4: Synklogik "update-first"

Det här är nyckeln för att undvika dubbletter:

- Woo: redan i stort sett klar.
- Fyndiq/CDON: exportflödet bör dela upp:
  - **mapped** produkter -> `PUT /bulk` (update action)
  - **unmapped** produkter -> `POST /bulk` (create)
- Resultat: inga masskapade nya artiklar när ni redan har produkter live.

### Fas 5: Dry-run + verifiering

- Kör först "dry-run mode" som bara rapporterar:
  - antal matchade per kanal
  - antal omappade
  - SKU-krockar
  - saknade SKU
- Kör sedan skarp bootstrap.
- Kör därefter liten synkbatch (t.ex. 20 produkter) och verifiera att bara update sker.

---

## Varför detta är bättre än att läsa från alla kanaler först

Att hämta från Woo/Fyndiq/CDON var för sig fungerar, men blir mer API-call tungt och fler edge cases.
Sello har redan den konsoliderade sanningen (produkt + integrationsstate), så ni slipper "3 olika discovery-jobs" i första steget.

---

_[Övrigt innehåll – strategiska beslut, execution logs 2026-03-04, Phase 2 kickoff, kategori-korrigering – finns i CHANGELOG.md och projektets kod.]_
