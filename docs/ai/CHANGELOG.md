# AI-utvecklingsteam – Changelog

Versionshistorik för design- och specifikationsdokument under `docs/ai/`.

## Guide CMS – Epic 4 (klar 2026-07-11)

Grindordning: Backend → QA → Security → Dokumentation → Frontend → QA → Security (godkänd) → Dokumentation.

### Omfattning

- VariantPresentation CRUD under Place/GuideStop (backend + frontend).
- Fält: `variantType`, `language`, `presentationText`, `publicationStatus`, `stalenessStatus`.
- Auto-skapande av tre varianter (quick/normal/deep) för MasterGuides `sourceLanguage` vid GuideStop create.
- Staleness-propagation när `canonicalNarrative` ändras på stopp.
- **Ej inkluderat:** Audio, AI, providers, public API.

### Databas

Migration **`094-guide-variant-presentations.sql`** (tenant DB):

| Kolumn               | Typ                  | Notering                                            |
| -------------------- | -------------------- | --------------------------------------------------- |
| `stop_id`            | FK → `guide_stops`   | ON DELETE CASCADE                                   |
| `variant_type`       | VARCHAR(50) NOT NULL | `quick` \| `normal` \| `deep`                       |
| `language`           | VARCHAR(10) NOT NULL | ISO-liknande kod (samma regex som `sourceLanguage`) |
| `presentation_text`  | TEXT                 | Valfritt; max 50 000 tecken i API                   |
| `publication_status` | VARCHAR(50)          | Default `draft`; `draft` \| `ready` \| `published`  |
| `staleness_status`   | VARCHAR(50)          | Default `fresh`; `fresh` \| `stale`                 |

Unik index: `(stop_id, variant_type, language)`. Backfill för befintliga stopp (`ON CONFLICT DO NOTHING`).

Kör: `npm run migrate:guides` (inkluderar 090, 092, 093, **094** per tenant).

### API (autentiserat, plugin-gate `guides`, CSRF på mutationer)

| Metod  | Path                                                     | Beskrivning                                             |
| ------ | -------------------------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/guides/:placeId/stops/:stopId/variants`            | Lista varianter för stopp                               |
| GET    | `/api/guides/:placeId/stops/:stopId/variants/:variantId` | Hämta variant                                           |
| POST   | `/api/guides/:placeId/stops/:stopId/variants`            | Skapa variant (`variantType`, `language` obligatoriska) |
| PUT    | `/api/guides/:placeId/stops/:stopId/variants/:variantId` | Uppdatera variant (partiell update)                     |
| DELETE | `/api/guides/:placeId/stops/:stopId/variants/:variantId` | Ta bort variant                                         |

**Request (create):** `{ variantType, language, presentationText?, publicationStatus? }`

**Request (update):** `{ presentationText?, publicationStatus? }` — `stalenessStatus` är **ej** klientskrivbar.

**Response (`VariantPresentation`):** `id`, `stopId`, `placeId`, `variantType`, `language`, `presentationText`, `publicationStatus`, `stalenessStatus`, `createdAt`, `updatedAt`.

**Semantik:**

- Vid **GuideStop create** skapas automatiskt tre varianter (`quick`, `normal`, `deep`) för MasterGuides `sourceLanguage`.
- Vid **GuideStop update**: om `canonicalNarrative` faktiskt ändras markeras alla varianter för stoppet som `stalenessStatus: stale`.
- Duplicate `(stopId, variantType, language)` vid POST → **409 Conflict**.

### Validering (backend: `plugins/guides/validation.js`)

- `VARIANT_TYPES`, `PUBLICATION_STATUSES`, `STALENESS_STATUSES`
- `parseVariantType()`, `parsePublicationStatus()`, `parseStalenessStatus()`, `parseLanguage()`
- Route-regler: `variantTypeBodyRule()`, `languageBodyRule()`, `publicationStatusBodyRule()`

### Tenant-isolering

`guide_variant_presentations` joinar `guide_stops` → `guide_master_guides` → `guide_places` för tenant-filter. `createVariant` INSERT efter tenant-scopad `getStopById`.

### Frontend (`client/src/plugins/guides/`)

| Fil / område                          | Ändring                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `types/guides.ts`                     | `GuideVariantPresentation`, `GuideVariantCreatePayload`, `GuideVariantUpdatePayload`, enum-helpers |
| `api/guidesApi.ts`                    | `getVariants`, `createVariant`, `updateVariant`, `deleteVariant`                                   |
| `components/GuideVariantsSection.tsx` | Variantlista per stopp, create/edit-formulär, delete med `ConfirmDialog`                           |
| `components/GuideStopsSection.tsx`    | Bäddar in `GuideVariantsSection` under varje stopp                                                 |
| `i18n` (`en.json`, `sv.json`)         | `variants`, `variantTypes`, `publication`, `staleness`, felmeddelanden m.m.                        |

**UI-beteende:**

- Varianter visas inline under varje stopp i `GuideView`.
- Create: `variantType`, `language`, `presentationText`, `publicationStatus`.
- Edit: `presentationText`, `publicationStatus`; `variantType`/`language` read-only.
- `stalenessStatus` visas som read-only badge (amber vid `stale`).
- `presentationText` renderas som plain text (React escape).
- Delete kräver bekräftelse (`ConfirmDialog`).

### Tester

60 backend-tester i `plugins/guides/__tests__/`. Inga frontend-enhetstester (konsekvent med övriga plugins).

Kör: `npm run check` och `npm test -- plugins/guides/__tests__`

### Säkerhet (godkänd 2026-07-11)

**Backend:**

| ID  | Risk                                    | Beslut                                  |
| --- | --------------------------------------- | --------------------------------------- |
| S2  | `createVariant` INSERT utan tenant-join | Accepterad — föregås av `getStopById`   |
| S7  | DELETE på default-varianter tillåten    | Accepterad — redaktionell risk          |
| S8  | Stor textpayload (50 000 tecken)        | Accepterad — autentiserad plugin-access |
| S9  | Fri `publicationStatus`                 | Accepterad — v1-scope                   |

**Frontend:**

| ID  | Risk                            | Beslut                                             |
| --- | ------------------------------- | -------------------------------------------------- |
| F1  | Stored XSS i `presentationText` | Mitigerad — React text rendering                   |
| F2  | XSS via i18n-interpolation      | Mitigerad — `language` regex-begränsad server-side |

### Kända begränsningar

- Staleness-markering och stop-update körs i separata queries (ej atomisk transaktion).
- **UI:** variantlistan laddas inte om automatiskt efter `canonicalNarrative`-ändring — stale-badge syns efter sidomladdning eller manuell navigation.
- Default-varianter (quick/normal/deep) kan raderas via API och UI.
- Övriga språk än `sourceLanguage` skapas manuellt via POST (valfria i v1).
- `createStop` kräver migration 094 applicerad.
- En GET variant-request per stopp vid mount (N+1 vid många stopp).

### Nästa steg

- Epic 5: Audio.

---

## Guide CMS – Epic 3 (klar 2026-07-11)

Grindordning: Backend → QA → Security → Frontend → QA → Security (godkänd) → Dokumentation.

### Omfattning

- GuideStop CRUD under Place/MasterGuide (backend + frontend).
- Fält: `title`, `sequenceOrder`, `canonicalNarrative`, `editorialStatus`.
- **Ej inkluderat:** VariantPresentation, Audio, AI, providers, public API.

### Databas

Migration **`093-guide-stops.sql`** (tenant DB):

| Kolumn                | Typ                        | Notering                          |
| --------------------- | -------------------------- | --------------------------------- |
| `master_guide_id`     | FK → `guide_master_guides` | ON DELETE CASCADE                 |
| `title`               | VARCHAR(255) NOT NULL      | Redaktörs-/besökarlabel           |
| `sequence_order`      | INTEGER NOT NULL           | Unik per master guide             |
| `canonical_narrative` | TEXT                       | Valfritt; max 50 000 tecken i API |
| `editorial_status`    | VARCHAR(50)                | Default `draft`                   |

Kör: `npm run migrate:guides` (inkluderar 090, 092, 093 per tenant).

### API (autentiserat, plugin-gate `guides`, CSRF på mutationer)

| Metod  | Path                                 | Beskrivning                               |
| ------ | ------------------------------------ | ----------------------------------------- |
| GET    | `/api/guides/:placeId/stops`         | Lista stopp (sorterad på `sequenceOrder`) |
| GET    | `/api/guides/:placeId/stops/:stopId` | Hämta stopp                               |
| POST   | `/api/guides/:placeId/stops`         | Skapa stopp (`title` obligatoriskt)       |
| PUT    | `/api/guides/:placeId/stops/:stopId` | Uppdatera stopp (partiell update)         |
| DELETE | `/api/guides/:placeId/stops/:stopId` | Ta bort stopp                             |
| PUT    | `/api/guides/:placeId/stops/reorder` | Omordna (`{ stopIds: string[] }`)         |

**Request (create):** `{ title, canonicalNarrative?, editorialStatus? }`

**Request (update):** `{ title?, canonicalNarrative?, editorialStatus? }`

**Response (`GuideStop`):** `id`, `masterGuideId`, `placeId`, `title`, `sequenceOrder`, `canonicalNarrative`, `editorialStatus`, `createdAt`, `updatedAt`.

**Semantik:**

- `sequenceOrder` tilldelas automatiskt (`MAX + 1`) vid create.
- **Epic 4 tillägg:** sedan Epic 4 backend skapas även tre default-varianter (quick/normal/deep) vid create — se Epic 4 backend-avsnitt.
- `reorder` kräver att `stopIds` innehåller **alla** stopp för platsen, utan dubbletter.
- Omordning sker i transaktion (tvåfas för unique constraint på `(master_guide_id, sequence_order)`).

### Validering (`plugins/guides/validation.js`)

- `GUIDE_STOP_EDITORIAL_STATUSES` (samma som MasterGuide)
- `parseGuideStopEditorialStatus()` — 400 vid ogiltigt värde; tom/null → `draft`
- `guideStopEditorialStatusBodyRule()` — delad route/model

### Tenant-isolering

`guide_stops` saknar egen `user_id`-kolumn. Alla queries joinar `guide_master_guides` → `guide_places` så PostgreSQLAdapter:s tenant-filter appliceras.

### Frontend (`client/src/plugins/guides/`)

| Fil / område                       | Ändring                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `types/guides.ts`                  | `GuideStop`, `GuideStopPayload`, `GuideStopEditorialStatus`, `isGuideStopEditorialStatus()` |
| `api/guidesApi.ts`                 | `getStops`, `createStop`, `updateStop`, `deleteStop`, `reorderStops`                        |
| `components/GuideStopsSection.tsx` | Lista, create/edit-formulär, upp/ner-omordning, delete med `ConfirmDialog`                  |
| `components/GuideView.tsx`         | Ersätter placeholder med `GuideStopsSection`                                                |
| `i18n` (`en.json`, `sv.json`)      | `addStop`, `stopTitle`, `canonicalNarrative`, felmeddelanden m.m.                           |

**UI-beteende:**

- Stopp laddas i `GuideView` per plats.
- Redaktör kan lägga till, redigera, ta bort och ordna om stopp (upp/ner).
- `canonicalNarrative` visar källspråk-hint från platsens `sourceLanguage`.
- Delete kräver bekräftelse (`ConfirmDialog`).

### Tester

36 backend-tester i `plugins/guides/__tests__/`. Inga frontend-enhetstester (konsekvent med övriga plugins).

Kör: `npm run check` och `npm test -- plugins/guides/__tests__`

### Kända begränsningar

- Sekvensluckor efter delete kompakteras inte.
- Reorder kräver full `stopIds`-lista (alla stopp för platsen).
- Regel för `sourceLanguage`-ändring när stopp finns — **ej implementerad**; affärsbeslut kvarstår öppet.
- Omordning via upp/ner-knappar (ej drag-and-drop).
- Plain text-lagring av `canonicalNarrative` — säker vid React-rendering; public API (Epic 6) kräver separat granskning.
- Place-delete i `GuideView` saknar fortfarande `ConfirmDialog` (UX, kvar från Epic 1).

### Nästa steg

- Epic 4: se avsnitt **Guide CMS – Epic 4** ovan (klar).

---

## Guide CMS – Epic 2 (klar 2026-07-10)

Grindordning: Backend → QA → Security → Frontend → QA → Security (godkänd) → Dokumentation.

### Omfattning

- MasterGuide redigerbar via utökad `PUT /api/guides/:id` (backend).
- Frontend: visa och redigera MasterGuide-metadata; fullsides vy med tom Guide stops-sektion.
- **Ej inkluderat:** GuideStop, VariantPresentation, Audio, providers, public API.

### API-ändring (backend)

`PUT /api/guides/:id` — nya **valfria** fält (utöver befintliga Place-fält):

| Fält                         | Typ    | Värden                                      |
| ---------------------------- | ------ | ------------------------------------------- |
| `sourceLanguage`             | string | `^[a-z]{2}(-[a-z]{2})?$` (samma som create) |
| `masterGuideEditorialStatus` | string | `draft` \| `in-progress` \| `complete`      |

**Semantik:** Om varken `sourceLanguage` eller `masterGuideEditorialStatus` skickas lämnas MasterGuide oförändrad. Om ett fält skickas mergas det med befintliga värden.

Response oförändrad (`sourceLanguage`, `masterGuideEditorialStatus` i Guide-objektet).

### Validering (`plugins/guides/validation.js`)

- `MASTER_GUIDE_EDITORIAL_STATUSES`
- `parseMasterGuideEditorialStatus()` — 400 vid ogiltigt värde; tom/null → `draft`
- `masterGuideEditorialStatusBodyRule()` — delad route/model

### Tenant-isolering

MasterGuide-UPDATE använder `UPDATE guide_master_guides … FROM guide_places` så PostgreSQLAdapter:s `user_id`-filter appliceras (tabellen saknar egen `user_id`-kolumn).

### Frontend (`client/src/plugins/guides/`)

| Fil / område                  | Ändring                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `types/guides.ts`             | `MasterGuideEditorialStatus`, `MASTER_GUIDE_EDITORIAL_STATUSES`, `isMasterGuideEditorialStatus()` |
| `context/GuidesProvider.tsx`  | Skickar `sourceLanguage` + `masterGuideEditorialStatus` vid update                                |
| `components/GuideForm.tsx`    | Master guide-kort: `sourceLanguage` (create + edit), editorial status (edit only)                 |
| `components/GuideView.tsx`    | Tre sektioner: Place details, Master guide metadata, tom Guide stops-placeholder                  |
| `i18n` (`en.json`, `sv.json`) | `masterGuide`, `masterGuideEditorialStatus`, `guideStops`, `stopsNoYet`, `editorial.*`            |

**UI-beteende:**

- **Create:** `sourceLanguage` redigerbar (default `sv`); editorial status sätts av backend till `draft`.
- **Edit:** båda fälten redigerbara; sparas via `PUT /api/guides/:id`.
- **View:** badges för källspråk och redaktionell status; stopp-sektion visar placeholder-text.

### Leveransfix (git)

`.gitignore` ändrad från `guides/` till `/guides/` så att repo-rootens designreferenser ignoreras utan att `client/src/plugins/guides/` och `plugins/guides/` blockeras från git.

### Tester

23 backend-tester i `plugins/guides/__tests__/` (inkl. editorial status, partiell update, tenant-filter på MasterGuide UPDATE). Inga frontend-enhetstester (konsekvent med övriga plugins).

Kör: `npm run check` och `npm test -- plugins/guides/__tests__`

### Kända begränsningar

- `sourceLanguage: null` i body kan defaulta till `sv` (QA-notering, låg risk).
- Ingen klientvalidering av `sourceLanguage`-format — backend avvisar ogiltiga värden.
- Delete i `GuideView` saknar `ConfirmDialog` (UX, ej säkerhetsblocker; kvar från Epic 1).

### Nästa steg (historiskt)

Epic 3 backend: se avsnitt **Guide CMS – Epic 3 backend** ovan.

---

## Guide CMS – Epic 1 (klar 2026-07-10)

Grindordning: Backend → QA → Security (omarbetning) → QA → Security (godkänd) → Dokumentation.

### Omfattning

- Nytt `guides`-plugin: Place CRUD med atomisk skapelse av MasterGuide vid create.
- **Ej inkluderat i Epic 1:** GuideStop, VariantPresentation, Audio, public API, providers.
- **Affärsregel (låst):** `sourceLanguage` per MasterGuide; endast källspråk obligatoriskt i v1 (default `sv`).

### Backend (`plugins/guides/`)

| Fil                | Syfte                                                     |
| ------------------ | --------------------------------------------------------- |
| `plugin.config.js` | Plugin `guides`, route `/api/guides`                      |
| `routes.js`        | CRUD-routes med `requirePlugin`, CSRF på mutationer       |
| `controller.js`    | HTTP-hantering                                            |
| `model.js`         | Place + MasterGuide, tenant-scope via `Database.get(req)` |
| `validation.js`    | Delad validering för route och model                      |

**API (autentiserat, plugin-gate `guides`):**

| Metod  | Path              | Beskrivning                                   |
| ------ | ----------------- | --------------------------------------------- |
| GET    | `/api/guides`     | Lista places (med master guide-fält)          |
| GET    | `/api/guides/:id` | Hämta place                                   |
| POST   | `/api/guides`     | Skapa place + MasterGuide (transaktion)       |
| PUT    | `/api/guides/:id` | Uppdatera place (MasterGuide-fält: se Epic 2) |
| DELETE | `/api/guides/:id` | Ta bort place (CASCADE master guide)          |

### Frontend (`client/src/plugins/guides/`)

- API: `api/guidesApi.ts`
- Context: `GuidesContext.tsx`, `GuidesProvider.tsx`
- Komponenter: `GuideList`, `GuideForm`, `GuideView`
- Registrering: `client/src/core/pluginRegistry.ts` (kategori Content, prefix GDS)
- Routing: `routeMap.ts`, sidebar `NavPage` `guides`

### Databas och migrationer

| Migration                             | DB                    | Innehåll                                                  |
| ------------------------------------- | --------------------- | --------------------------------------------------------- |
| `090-guides.sql`                      | Tenant                | `guide_places`, `guide_master_guides`                     |
| `092-guide-places-user-id.sql`        | Tenant                | `user_id` på `guide_places` (tenant-isolering)            |
| `093-guide-stops.sql`                 | Tenant                | `guide_stops` (Epic 3; se Epic 3-avsnitt)                 |
| `094-guide-variant-presentations.sql` | Tenant                | `guide_variant_presentations` (Epic 4; se Epic 4-avsnitt) |
| `091-grant-guides-plugin-access.sql`  | Main (`MAIN_DB_ONLY`) | Plugin-access för befintliga tenants                      |

Kör: `npm run migrate:guides` (alla tenants + main DB). Efter plugin-access: **logga ut/in**.

### Säkerhetsåtgärder (2026-07-10)

Efter första Security-underkännande:

1. **R1 – Tenant-isolering:** `guide_places.user_id` via migration 092; sätts vid INSERT från `Database.get(req).getUserId()` (`currentTenantUserId`). PostgreSQLAdapter auto-filter på LIST/GET/UPDATE/DELETE. Master guide-lookup vid UPDATE joinar `guide_places` för scope.
2. **R2 – sourceLanguage:** Delad validering i `validation.js` (`parseSourceLanguage`, `sourceLanguageBodyRule`) — regex `^[a-z]{2}(-[a-z]{2})?$`.
3. **R3 – lifecycleStatus:** Ogiltigt värde ger 400 (`parseLifecycleStatus`); tom/null → `draft`.

### Tester

`plugins/guides/__tests__/`:

- `model.test.js` — transform, create med `user_id`, user context
- `validation.test.js` — parseSourceLanguage, parseLifecycleStatus
- `tenantFilter.test.js` — PostgreSQLAdapter-kompatibilitet för CRUD-SQL

Kör: `npm test -- plugins/guides/__tests__`

### Kända begränsningar (v1)

- Alla användare med plugin-åtkomst har full CRUD inom tenant (tenant-delat CMS-innehåll).
- Delete i UI saknar `ConfirmDialog` (UX, ej säkerhetsblocker).
- Befintliga rader utan `user_id` backfillas med `user_id = 1` i migration 092 (plattformsstandard, samma som cups/requests).

### Nästa steg (historiskt)

Epic 2: se avsnitt **Guide CMS – Epic 2** ovan.

---

## Guide CMS – Epic 1 implementation (2026-07-09)

- Initial leverans: `guides`-plugin med Place CRUD och atomisk MasterGuide.
- Se avsnitt **Guide CMS – Epic 1 (klar 2026-07-10)** ovan för fullständig spec efter säkerhetsgodkännande.

---

## v1.3 – Överlämning som verkligt stopp (2026-07-07)

Förstärker rolldisciplin efter överlämning utan att ändra Team Workflow, Stage Gates eller rollbefogenheter.

### Dokumentation

- `docs/ai/team-workflow.md` – princip **Efter överlämning** under Kommunikationsregler och Principer.
- `docs/ai/cursor-implementation.md` – princip under Output Contract: rollen fortsätter inte arbetet efter överlämning om nästa roll inte aktiveras.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Efter överlämning**: rollen är klar efter överlämningsrad; svarar endast med påminnelse vid fortsättningsfraser utan rollaktivering; utför inte nästa rolls arbete.

- `role-technical-project-manager.mdc` – tillägg: TPM får inte återta överlämnad uppgift förrän rollen uttryckligen aktiveras igen.

---

## v1.2 – Rollseparation vid övertagande (2026-07-07)

Förstärker rollseparationen utan att ändra Team Workflow, Stage Gates eller rollbefogenheter.

### Dokumentation

- `docs/ai/cursor-implementation.md` – princip under Kontextkomprimering och Output Contract: utgå från föregående rolls Output Contract, inte hela chatthistoriken.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Rollseparation** (eget ansvar, referera leverabler, inte återskapa annan rolls arbete).

- `role-technical-project-manager.mdc` – tillägg **Efter specialistleverans**: TPM utvärderar och rapporterar status utan att återge specialistens detaljerade arbete.

---

## v1.1 – Rollidentitet i kommunikationen (2026-07-07)

Förbättring av användbarheten vid praktisk användning av AI Team Framework. Ingen förändring av roller, ansvar eller arbetsflöde — endast tydligare kommunikation.

### Cursor-regler (.cursor/rules/)

Alla åtta `role-*.mdc` har ny sektion **Rollidentitet i kommunikationen**:

- Identitetsrad vid aktivering eller nytt uppdrag (t.ex. `[Solution Architect]`).
- Identitetsraden upprepas inte under samma arbetspass.
- Överlämningsrad vid avslut (t.ex. `Överlämning:\nDocumentation Specialist`).
- Överlämning är kommunikativ markering — aktiverar inte nästa roll automatiskt.

### Dokumentation

- `docs/ai/cursor-implementation.md` – ny undersektion **Rollidentitet och överlämning (kommunikation)** under Output Contract.

---

## v1.0 – AI Team Framework (2026-07-07)

Första fullständiga versionen av AI Team Framework. Ramverket är projektoberoende och redo för produktion.

### Dokumentation

- `docs/ai/engineering-principles.md` – universella engineering-principer för alla roller och projekt.
- `docs/ai/team-workflow.md` – arbetsflöde med stage gates, återkopplingsloopar och kommunikationsregler.
- `docs/ai/cursor-implementation.md` – implementationsprinciper för Cursor, inkl. Output Contract och Kontextkomprimering.

### Roller (docs/ai/roles/)

- `technical-project-manager.md` – koordinerande roll; avgränsar, prioriterar och håller ihop leveransen.
- `solution-architect.md` – äger teknisk lösning och arkitektur.
- `ui-ux-designer.md` – äger användarupplevelse, flöden och gränssnittsdesign.
- `backend-developer.md` – implementerar backend enligt arkitektens design.
- `frontend-developer.md` – implementerar UI enligt design och arkitektur.
- `qa-code-reviewer.md` – teamets kvalitetsgrind; granskar objektivt och godkänner eller underkänner.
- `security-expert.md` – teamets säkerhetsgrind; granskar pragmatiskt och riskbaserat.
- `documentation-specialist.md` – teamets dokumentationsgrind; dokumenterar verifierad implementation.

### Cursor-regler (.cursor/rules/)

- `engineering-principles.mdc` – alltid aktiv (`alwaysApply: true`); universella principer i varje session.
- `role-technical-project-manager.mdc`
- `role-solution-architect.mdc`
- `role-ui-ux-designer.mdc`
- `role-backend-developer.mdc`
- `role-frontend-developer.mdc`
- `role-qa-code-reviewer.mdc`
- `role-security-expert.mdc`
- `role-documentation-specialist.mdc`

### Nyckelkoncept

- **Stage Gates** – sex beslutsgrindar (Grind 1–6) med tydliga ägare och krav för att passera. Grind 2, 3 och 5 är villkorliga och kan markeras N/A av Teknisk Projektledare.
- **Output Contract** – varje roll avslutar sitt arbete med en rollspecifik, strukturerad leverans. Definieras i respektive Cursor-regel.
- **Kontextkomprimering** – princip för att minimera AI-kostnad och säkerställa tydliga överlämningar mellan roller.
- **Single Source of Truth** – `docs/ai/` är alltid primär sanningskälla; Cursor-regler är härledda representationer.
