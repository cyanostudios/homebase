# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner.

---

## 2026-02 – Homebase 3.1.6

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

### Session / tenant – ingen sync av currentTenantUserId i middleware

- **Borttaget:** Middleware som "synkade" `currentTenantUserId` från `user.id` när den saknades (fallback). `currentTenantUserId` sätts nu enbart vid login/signup/MFA-verifiering i auth-routes. Tenant-middleware läser bara `req.session?.currentTenantUserId`; om den saknas sätts ingen tenant-pool (korrekt beteende om sessionen inte är fullständig).
- Fil: [server/index.ts](server/index.ts).

### NPM-skript

- `npm run migrate:encrypt-legacy-secrets` – krypterar plain-text secrets i cdon_settings, fyndiq_settings, googledrive_settings, mail_settings, postnord_settings för alla tenants.
- `npm run migrate:encrypt-woo-credentials` – krypterar WooCommerce-credentials i channel_instances (plain JSON → `{ v: encrypted }`) för alla tenants.
- Backfill för channel_label: `node scripts/backfill-orders-channel-label.js`.

---

## 2026-02 – Homebase 3.1.5 (snapshot before migrating from 3.X)

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
  - `GET /api/auth/me` anropas endast från AppContext vid start. TopBar använder `currentTenantUserId` och `user` från `useApp()`; ingen egen fetch till `/api/auth/me` (ingen `loadCurrentTenant`).
  - AppContext sparar och exponerar `currentTenantUserId` från getMe-svaret. Vid login/signup sätts den till inloggad användare.
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
