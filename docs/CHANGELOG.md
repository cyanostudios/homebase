# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner sedan senaste dokumenteringen.

---

## 2026-07-24 – List filter StatCards + list chrome polish

**Status:** Implementerat. QA Approved; Security Approved; Docs Updated. **Ej prod-release** utan explicit beslut.

**Sammanfattning (verifierat mot kod):**

- **Delad `ListFilterStatCard`** (`@/core/ui/ListFilterStatCard`): label+dot vänster, siffra höger; `px-6 py-4` / `text-3xl`; hover `bg-primary/10` + `text-primary` (samma som små filterchips). Grid `gap-2`.
- **Små filterchips** (t.ex. Teams gender): inaktiv `bg-card` (ljusare än `bg-muted`).
- **Bulk-bar:** neutrala actions hover `bg-primary/10` + `text-primary`; Clear selection samma röda hover som Delete.
- **Listbakgrund:** light `--background: 210 20% 96%` (`client/src/index.css`) — påverkar alla `bg-background`-ytor.
- **Teams:** färgad top-stripe på `TeamCard` borttagen.

---

## 2026-07-24 – Card-column list expansion (Estimates, Matches, Files, Ingest, Cups, Teams)

**Status:** Implementerat. QA Approved; Security Approved; Docs Updated. **Ej prod-release** utan explicit beslut.

**Sammanfattning (verifierat mot kod):**

- **Migrerade till card-column shell** (§0.1): Estimates, Matches, Files, Ingest, Cups, Teams. Grid/List-toggle och list-`Table` borttagna (Teams behåller `TeamCard` visuellt, utan färgstripe).
- **Gemensamt:** `*ListItem` (eller TeamCard) + toolbar **1 / 2 / 3** (`columnCount`) + two-level sort (`And...`) + select-all/bulk-bar under search. Helpers `*ColumnCount.ts` / `*ListSort.ts` + tester.
- **Cups:** behåller `BulkPropertiesDialog` (ej bulk status). Estimates/Matches/Files/Ingest/Teams: ingen bulk status (ej lämplig lifecycle / modal-komplexitet).
- **Hoppat över (ej applicerbart):** Mail, Pulses (historikloggar); AI Providers (liten konfigkatalog); Schedule (tidgrid); Invoices (explicit undantag); Settings (ej datalista).
- **Säkerhet:** Klient-side sort; fasta Select-optioner; `columnCount` via settings/session; ingen ny API/auth-yta (Security Approved). Accepterade risker: None.

**UI-standard:** [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) §0.1.

---

## 2026-07-24 – Two-level list sort (Tasks, Contacts, Notes, Guides, Requests, Slots)

**Status:** Implementerat. QA Approved; Security Approved; Docs Updated. **Ej prod-release** utan explicit beslut.

**Sammanfattning (verifierat mot kod):**

- **UI (alla sex listor):** Primär sort-dropdown + valfri sekundär (`And...` / internt `none`). Båda triggers `w-[140px]`, `position="item-aligned"`. Gemensam asc/desc-knapp. Primär och sekundär kan inte vara samma fält (mutual exclusion i options + clear vid krock).
- **Beteende:** Sekundär bryter likor på primär. När primär är datumfält jämförs först **kalenderdag** (lokal tid) så sekundär syns för rader samma dag; annars är full tidsstämpel oftast unik.
- **Sortfält utökade från list-meta** (utöver tidigare snäva set): Contacts (`phone`, `tags`, `assignable`, `updatedAt`, `createdAt`); Notes (`mentions`); Guides (`createdAt`, `lifecycleStatus`, `languages`); Requests (`source`); Slots (`category`, `visible`, `booked_count`). Tasks oförändrade (redan kompletta).
- **Helpers + tester:** `*ListSort.ts` per plugin (`task` / `contact` / `note` / `guide` / `request` / `slot`) + `*ListSort.test.ts`.
- **Defaults oförändrade i praktiken** när sekundär är tom (t.ex. Tasks/Notes/Requests updated\* desc; Contacts name asc; Guides displayName asc; Slots slot_time asc). Sortval persistens: ingen (session-state i komponent).
- **Säkerhet:** Klient-side sort på redan laddad data; fasta Select-optioner; ingen ny API/auth-yta (Security Approved).
- **Begränsningar (verifierade):** Contacts `tags` sorterar på **första** taggen; Notes `mentions` och Guides `languages` sorterar på **antal** (inte innehåll); labels/`And...` delvis hårdkodade EN i flera listor (Guides/Requests mer i18n).

**UI-standard:** [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) §0.1 Sort-rad.

---

## 2026-07-24 – Card list + columns rollout (Contacts, Notes, Guides, Requests, Slots)

**Status:** Implementerat. Tasks-mönstret (kortrad + kolumnväljare 1/2/3) portat till fem plugins. **Ej prod-release** utan explicit beslut.

**Sammanfattning (verifierat mot kod):**

- **Gemensamt:** Grid/List-toggle och list-`Table` borttagna. `*ListItem` med `DETAIL_VIEW_CARD_CLASS`; toolbar **1 / 2 / 3** (`columnCount`); legacy `viewMode` grid→3, list→1.
- **Contacts / Notes / Slots:** settings + session sparar `columnCount`. Inget bulk-status (ingen lifecycle-status). Slots behåller `BulkPropertiesDialog`.
- **Guides / Requests:** session-only `columnCount` (ingen layout-settings-API). Guides behåller befintlig bulk status. Requests får `RequestBulkStatusDialog` + inline status; `shouldApplyOpenRequestSaveEffects` i `RequestProvider`.
- **i18n:** `*.columns*` (en/sv); Requests `requests.bulkStatus*`.
- **Tester:** `*ColumnCount.test.ts` (+ Requests `requestListSave`); Jest roots utökade.
- **UI-standard:** [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) §0.1 — card-column list är default för Tasks/Contacts/Notes/Guides/Requests/Slots; legacy table/grid kvar för övriga plugins.

---

## 2026-07-24 – Tasks bulk status change

**Status:** Implementerat. QA Approved; Security Approved. **Ej prod-release** utan explicit beslut. Samma UX-mönster som Guides bulk status.

**Sammanfattning (verifierat mot kod):**

- Select/bulk-raden: **Status** (`tasks.bulkStatusAction`) öppnar `TaskBulkStatusDialog`.
- Dialog: idle → applying → done; status från `TASK_STATUS_OPTIONS`; progress/resultat; Apply/Cancel/Close.
- Uppdatering: sekventiellt `saveTask` + `buildTaskListStatusSavePayload` (samma payload som inline list-status) → befintlig `PUT /api/tasks/:id` (auth/CSRF/enum).
- Efter **Close** i done-fas: `onSuccess` → `clearTaskSelection`.

**Begränsningar / avvägningar:**

- Ingen ny bulk-API; N sekventiella PUT (Guides-paritet). Security: låg residual risk, ingen ny accepterad risk som kräver TPM-beslut.
- Backdrop/Cancel i done-fas anropar inte `onSuccess` (samma som Guides) — markering kan bli kvar.
- i18n: `tasks.bulkStatus*` (en/sv).

---

## 2026-07-24 – Tasks list columns (1 / 2 / 3)

**Status:** Implementerat (pilot, Tasks). Grid/list-toggle borttagen.

**Sammanfattning:** Tasks använder en enda kortlista (`TaskListItem`) med kolumnväljare **1 / 2 / 3** (full / halv / tredjedel bredd från `sm`). Settings + session sparar `columnCount`; legacy `viewMode` `grid`→3, `list`→1. Select/bulk och sort alltid synliga. Hjälpare: `taskColumnCount.ts` + unit tests.

---

## 2026-07-24 – Tasks list row redesign (pilot)

**Status:** Implementerat. QA Approved; Security Approved. **Ej prod-release** utan explicit beslut. Pilot: endast **Tasks listläge** (grid oförändrad). Övriga plugins oförändrade.

**Sammanfattning (verifierat mot kod):**

- Listläge: ingen `Table`; vertikala kort via `TaskListItem` (`DETAIL_VIEW_CARD_CLASS`).
- Radlayout: priority (+ due-badge om due och ej completed) · compact `TaskStatusSelect` · bold titel · plain excerpt (`stripHtml`, utelämnas om tom) · meta (due / assignees / updated).
- Spacing: `space-y-3` / `gap-3` mellan filter, search, select/bulk, items, footer.
- Select/bulk-rad (samma vita kortyta): utan val → Select all; med val → Clear selection → antal → **Status** → Export CSV/PDF → Delete (textknappar). (**Status** tillagd 2026-07-24; se post _Tasks bulk status change_.)
- Sortering: toolbar-dropdown + asc/desc (ej kolumnheaders).
- Inline status: `buildTaskListStatusSavePayload` → `saveTask`; `shouldApplyOpenTaskSaveEffects` så panel/draft/`view` bara synkas när uppdaterad task = öppen task.
- Tester: `client/src/plugins/tasks/utils/__tests__/taskListSave.test.ts` (Jest root `client/src/plugins/tasks`).

**Begränsningar / avvägningar:**

- Pilotscope: Notes/Contacts m.fl. behåller tabell/list-shell enligt §0.1 tills eventuell utrullning.
- Tasks bulk sitter i select-raden (inte klassiska `BulkActionBar`); efter kolumn-pilot finns ingen separat grid/`BulkActionBar`-yta.
- Security (lågt, befintligt mönster): `stripHtml` via `innerHTML`; `data-list-item` JSON i DOM — se Security-granskning 2026-07-24.

**UI-standard:** Undantag dokumenterat i [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) §0.1 (Tasks list pilot).

---

## 2026-07-23 – Reset plugin settings view on navigate

**Status:** Implementerat.

**Sammanfattning:** Vid byte av plugin/sida (URL/`currentPage`) återställs `*ContentView` till list via `close*SettingsView` (och teams statistics / AI Providers routing). Annars stannade t.ex. Contacts Settings öppen efter Notes → Contacts.

---

## 2026-07-23 – CSV-importmallar (contacts / notes / tasks)

**Status:** Implementerat. Användaren kan ladda ner en plugin-specifik CSV-mall från Settings → Import.

**Sammanfattning:** Core `downloadImportCsvTemplate` / `buildImportCsvTemplateContent` genererar CSV med headers = `ImportSchema.field.label` + en exempelrad. Knapp i contacts/notes/tasks Settings.

---

## 2026-07-23 – Tabular Import Wizard (CSV / Excel / paste)

**Status:** Implementerat på `homebase-v3.7`. QA Approved; Security Approved (A1 eskalerad till TPM, se nedan); Docs uppdaterad. **Ej prod-release** utan explicit beslut.

**Sammanfattning:** Core `ImportWizard` stödjer fil (CSV + `.xlsx` första sheet), inklistrad TSV/CSV, required-mappning, resultatsummering. Soft limits: 5 MB (**före** filläsning) / 2000 rader. Contacts/notes/tasks returnerar `{ successCount, failureCount }`. Inget separat import-plugin.

**ADR / UX / standards:** [`docs/ai/adr/TABULAR_IMPORT_EXPORT.md`](ai/adr/TABULAR_IMPORT_EXPORT.md), [`docs/ai/design/TABULAR_IMPORT_WIZARD_UX.md`](ai/design/TABULAR_IMPORT_WIZARD_UX.md), importmönster i [`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`](PLUGIN_DEVELOPMENT_STANDARDS_V2.md) §5.

**Beroende:** SheetJS `xlsx@0.20.3` via `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (lazy-load; integrity i lockfile).

### Accepterad säkerhetsrisk (eskalerad till TPM)

| ID  | Risk                                                      | Beslut                                                                  |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| A1  | Installkälla SheetJS CDN (ej npm registry) för patchad CE | **Kräver explicit TPM-godkännande**; mitigering: pinnad URL + integrity |

---

## 2026-07-23 – ADR: Tabular Import/Export (core + adapters)

**Status:** Arkitektur beslutad och **implementerad** (v1) — se posten _Tabular Import Wizard_ ovan.

**ADR:** [`docs/ai/adr/TABULAR_IMPORT_EXPORT.md`](ai/adr/TABULAR_IMPORT_EXPORT.md)

---

## 2026-07-23 – FOGIS lagväljare i TeamForm

**Status:** Implementerat på `homebase-v3.7`. QA Approved; Security Approved (SSRF-risk dokumenterad och eskalerad till TPM, se nedan). **Ej prod-release** utan explicit beslut.

**Sammanfattning:** TeamForm fick en FOGIS-lagväljare som ersätter det tidigare fria textfältet för `external_team_id`. Användaren filtrerar och väljer lag direkt i formuläret; `Import Now` i Matcher → Inställningar är oförändrat.

### Verifierat beteende

- **Lagväljare:** `GET /api/teams/external-options` (gate: `teams`-plugin) hämtar unika FOGIS-lag från SvFF `/club/upcoming-games` och returnerar `{ externalTeams, occupiedBy }`.
- **Etikett:** `Sorgenfri FF (324323) F16` — åldershint (`F16`, `P17`, `U15` m.m.) härlett ur matchernas `competitionCategoryName`/`competitionName` via regex.
- **Filtrering:** fritextfält ovanför dropdown filtrerar på **lagnamn** (ej ID, ej ålder).
- **Occupied:** lag redan kopplade till ett _annat_ Homebase-lag visas disabled med suffix `· används av {lagnamn}`.
- **Orphan:** om ett sparat FOGIS-ID saknas i aktuell hämtning visas det som valbart extra option.
- **Felstates:** loading / saknad API-nyckel (länkhint till Matcher → Inställningar) / övriga fel med Försök igen-knapp / tom lista.
- **Persistens:** oförändrad `PUT /api/teams/:id` med `external_team_id`; ny 409 CONFLICT om ett annat lag redan äger samma ID.
- **Import:** oförändrat — `POST /api/matches/import` filtrerar på befintliga `external_team_id`.

### Arkitektur

| Ansvar                             | Ägare                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| FOGIS HTTP-transport + credentials | `plugins/matches/services/svffFogisClient.js` (ny modul)                                                       |
| Lagväljare: GET + occupiedBy       | `plugins/teams/services/externalTeamOptionsService.js` (ny) + `GET /api/teams/external-options`                |
| UI: Select + filter + states       | `client/src/plugins/teams/components/TeamForm.tsx`                                                             |
| Matchimport                        | `plugins/matches/services/matchImportService.js` — oförändrat beteende, intern refaktor till `svffFogisClient` |

Teams `require`:ar `svffFogisClient` direkt (code-beroende, ej HTTP); samma mönster som cups→ingest.

### Accepterad säkerhetsrisk (eskalerad till TPM)

| ID     | Risk                                                                                                                                                                    | Beslut                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SSRF-1 | Användarstyrd `apiBaseUrl` (Matcher → Inställningar) utan `ssrfUrlGuard` — ny `GET`-trigger vid formuläröppning utökar angreppsyta jämfört med tidigare (enbart import) | **Kräver explicit TPM-godkännande**; åtgärd rekommenderas: validera `apiBaseUrl` med `validatePublicHttpsUrl` i `svffFogisClient` |

### Inaktuell dokumentation åtgärdad

Changelog §2026-06 beskrev `external_team_id` som ett fritt textfält. Det är nu ersatt av UI-väljare; fältet kvarstår i DB och API men sätts via Select.

---

## 2026-07-22 – Generate source audio + safe regenerate

**Status:** Implementerat och pushat till `homebase-v3.8`. QA Approved; Security Needs Decision → **A1/A2 accepterade av TPM**. **Ej prod-release** utan explicit beslut. Documentation sync denna post.

**Sammanfattning:** Production-panelen har **Generate source audio** (källspråk, samma `POST …/audio/generate` som presentationens audio-sektion). Vid befintlig ready/stale-fil visas overwrite-varning. Misslyckad generate (t.ex. quota) **behåller** föregående ljudfil; fel visas i popup med provider-/servermeddelande. Cancel under regenerate återställer `stale`/`ready` via intern restore-hint (`preserveRestoreHint`).

### Verifierat beteende

- Panel: `GuideProductionPanel` → `GuideView` → `guidesApi.generateAudio(placeId, sourceLanguage)`; kräver approved källpresentation med text.
- Orkestrering: behåller `storage_ref` under `processing`; raderar gammal blob **först efter** lyckad ny upload (`AudioOrchestrationService`).
- Fel-UX: `resolveAudioGenerateErrorMessage` + `ConfirmDialog` (alert-läge utan cancel).

### Accepterade säkerhetsrisker (TPM 2026-07-22)

| ID  | Risk                                                   | Beslut                                                     |
| --- | ------------------------------------------------------ | ---------------------------------------------------------- |
| A1  | Rå provider-feltext till autentiserad guides-användare | Accepterad — CMS-operatörsyta; React textnoder (ingen XSS) |
| A2  | Ingen dedikerad rate limit på audio-generate           | Accepterad — samma trust-modell som text-production        |

---

## 2026-07-22 – Total cost text + total cost audio

**Status:** Implementerat och pushat till `homebase-v3.8`. Migration `109-guide-audio-cost.sql` (`guide_audio.cost`).

**Sammanfattning:** Information-kortet visar separat **Total cost text** (`placeTotalEstimatedCost`, user-scoped production items) och **Total cost audio** (`placeTotalEstimatedAudioCost`, kumulativ TTS-estimat på platsens `guide_audio`). List/get production-jobs returnerar båda fälten. ElevenLabs generate sparar estimated cost via `calculateTtsCost`.

---

## 2026-07-22 – ElevenLabs voice selection in AI Providers

**Status:** Implementerat och pushat till `homebase-v3.8`. Migration `108-ai-provider-settings-options.sql` (JSONB `options`).

**Sammanfattning:** ElevenLabs-settings har röstväljare (listar `/v1/voices` eller manuell voice id). Sparad `voiceId` används vid Guides audio-generate.

---

## 2026-07-22 – ElevenLabs TTS adapter (Guides audio)

**Status:** Implementerat och pushat till `homebase-v3.8`. **Ej prod-release.**

**Sammanfattning:** `ElevenLabsAudioProvider` registrerad — connection test via **minimal TTS-probe** (`"Hi"`, inte `GET /v1/user`; restricted keys saknar ofta `user_read`) + manuell generate (TTS → mp3). Syns som `audioGenerationCapable` i AI Providers; kan routas under Guides (audio).

- Adapter: `plugins/guides/audio/adapters/ElevenLabsAudioProvider.js`
- Env: `ELEVENLABS_API_KEY`, `GUIDES_AUDIO_ELEVENLABS_MODEL`, `GUIDES_AUDIO_ELEVENLABS_VOICE_ID`
- Default voice: ElevenLabs demo (`JBFqnCBsd6RMkjVDRZzb`)

---

## 2026-07-22 – Audio provider wiring (text-mönster)

**Status:** Implementerat och pushat till `homebase-v3.8`. Security Approved (wiring). **Ej prod-release.**

**Sammanfattning:** Manuell audio-generate speglar text: `AudioProviderConfigResolver` → `AIProviderRouter` (`guides-audio`) → env `GUIDES_AUDIO_PROVIDER` → `AudioProviderRegistry.create(key, options)`. Registrerade: `noop` + `elevenlabs`.

### Backend

- Ny: `plugins/guides/audio/AudioProviderConfigResolver.js`
- `AudioProviderRegistry` — factory/`create` som text-registry
- `AudioOrchestrationService` — preferred key + credentials via resolver; `provider_key` skrivs vid generate
- `setAudioGenerationState` kan uppdatera `provider_key`

### Tester

- `audio-provider-config-resolver.test.js`; uppdaterade orchestration/model-tester

### Dokumentation

- ADR: [`docs/ai/adr/P-AUDIO_GENERATION_PREP.md`](ai/adr/P-AUDIO_GENERATION_PREP.md) (decision 5 + diagram)

---

## 2026-07-22 – Guides: place total estimated cost + list jobs response shape

**Status:** Implementerat och pushat till `homebase-v3.8`. **Ej prod-release.**

**Brytande API-kontrakt (eskalerat till SA/TPM):**

- Tidigare: `GET /api/guides/:placeId/production-jobs` → `ProductionJob[]`
- Nu: `{ jobs, placeTotalEstimatedCost, placeTotalEstimatedAudioCost }`
- Job-detail inkluderar samma cost-fält (utöver `usageSummary`).

**Beteende:** `placeTotalEstimatedCost` summerar `provider_result.cost` för **completed** job-items på platsen filtrerat med `j.user_id`. `placeTotalEstimatedAudioCost` summerar `guide_audio.cost` för platsen (migration 109). UI: “Total cost text” / “Total cost audio”.

---

## 2026-07-22 – P-AUDIO_GENERATION_PREP: audiogenerering (stub / noop)

**Status:** Implementerat och pushat till `homebase-v3.8`. Security Approved för prep. **Ej merge till `main` / Railway** utan explicit releasebeslut. Utökad med ElevenLabs + cost + panel generate (se poster ovan).

**Sammanfattning:** Presentation-skopad `guide_audio` (1:1), manuell generate/cancel/preview/delete, noop-WAV, lagring under `guides/audio/`, AI Providers-capability `audioGenerationCapable` + routing-scope `guides-audio`.

### Backend

- Migration `107-guide-audio-presentations.sql` — DROP legacy + CREATE `guide_audio.presentation_id`.
- `plugins/guides/audio/*` — provider-kontrakt, registry, noop, orchestration, storageRef, upload.
- API under `/api/guides/:id/presentations/:language/audio` (+ generate/cancel/preview).
- Generate-gate: icke-tom text + `approval_status === 'approved'`; klient kan inte sätta `storageRef`/`ready`.
- Stale när presentationstext ändras och audio var `ready`.
- R2/local: valfri `keyPrefix`/`objectKey`.
- AI Providers: `audioGenerationCapable`; routable `guides-audio`.
- Env: `GUIDES_AUDIO_PROVIDER` (default `noop`).

### Frontend

- `GuideAudioSection` i presentationskort; `guidesApi` audio-metoder; i18n `guides.audio.*`.
- AI Providers UI: audio-capability + routing-rad Guides (audio).

### Dokumentation

- ADR: [`docs/ai/adr/P-AUDIO_GENERATION_PREP.md`](ai/adr/P-AUDIO_GENERATION_PREP.md)
- Synk: plats-ADR, pipeline v2, P-AI-SETTINGS (se `docs/ai/CHANGELOG.md`).

### Begränsningar / residual (Security 2026-07-22)

- Ingen prod-TTS; generate använder registry/`GUIDES_AUDIO_PROVIDER`, inte ännu `AIProviderRouter` för `guides-audio`.
- Medium defense-in-depth inför TTS: mime-allowlist på preview; R2 prefix-check; harden `objectKey`; överväg redaktera `storageRef` i API.
- Batch-fas `audio` / publik playback: utanför scope.

---

## 2026-07-22 – Fix: translation-only jobs stuck in `awaiting_review`

**Status:** Implementerat lokalt. QA + Security godkända. **Ej merge till `main` / Railway** utan explicit releasebeslut.

**Sammanfattning:** `checkpoint_mode: after_text` checkpointade felaktigt på fas-**index** 0. Translation-only jobb (`phases: ['translation']`) fastnade i `awaiting_review` med `reviewPhase: translation` utan review-UI, vilket låste Add/Edit via `hasActiveJob`.

### Backend

- **`_shouldCheckpoint`** — `after_text` stoppar endast när aktuell fas är **`text_derivation`** (fasnamn), inte när `currentPhaseIndex === 0`.
- Translation-only under `after_text` → auto-approve + `completed` (samma semantik som translation-fas i kombinerade jobb).
- Text-only och `[text_derivation, translation]` behåller HITL efter text.

### Tester

- `production-orchestration.test.js` — uppdaterat `_shouldCheckpoint`; nytt fall för translation-only auto-complete.

### Lokal recovery (verifierad)

- GDS 20 / GDS 23: stuck jobs approve item + approve-phase → `completed`; Add/Edit upplåsta.

**Säkerhet:** Inga nya attackytor; inga nya accepterade risker (Security 2026-07-22).

---

## 2026-07-22 – Guides create/produce polish + list/production reliability (`8a81785`)

**Status:** Implementerat på branch `homebase-v3.8` (commit `8a81785`). QA + Security godkända. **Ej merge till `main` / Railway** utan explicit releasebeslut.

**Sammanfattning:** Save and produce vid skapa; list-/detail-polish; HITL-approve sätter `approved`; tenant-filter fix för LATERAL/nästlade `ORDER BY`.

### Frontend

- **GuideForm** — knappar Cancel · Save · **Save and produce** (`guides.saveAndProduce`). Produce startar `phases: ['text_derivation']` för källspråk (default `en`), öppnar detail-vy; vanlig Save stänger till listan utan jobb.
- **GuidesProvider / useProductionJob** — efter produce seeds `pendingProductionDetail` så `ProductionPhaseBanner` syns direkt (`useLayoutEffect`).
- **GuideList** — filter StatCards Total / Draft / Active (`lifecycleStatus`); land-kolumn (`place.countryCode`); platsnamn trunkeras.
- **GuideView** — detail-layout i linje med contacts (`DETAIL_VIEW_CARD_CLASS`); sammanslagen info/lifecycle/editorial.
- **GuidePresentationSection** — alla presentationskort **kollapsade** vid full load (användaren expanderar).
- Översättningar: oförändrat manuellt flöde från detail (shells + `phases: ['translation']`).

### Backend

- **`POST /api/guides/:id/presentations`** — idempotent shell per språk (`ensurePresentationForLanguage`); gate + CSRF + `languageBodyRule`.
- **`applyProductionPresentationText`** — sätter `approval_status = 'approved'` (tidigare `pending_review`), så HITL-approve möjliggör publish utan extra approve-steg.
- **Publish-gate** — använder beräknad approval (inkl. när samma request sparar text som godkänd).
- **`PostgreSQLAdapter._addTenantFilter`** — top-level-only detektion av `WHERE` / `ORDER BY` / `GROUP BY` / `LIMIT` / `OFFSET` (fixar LATERAL/`ARRAY_AGG(... ORDER BY ...)` som tidigare kunde bryta listan / tenant-filter).
- **`GET /places/search?countryCode=`** — oförändrat kontrakt från Create UX Polish (validerad ISO alpha-2).

### Tester / smoke

- Guides: approval, presentations, tenantFilter, production-orchestration m.fl.
- `scripts/guides-save-and-produce-smoke.js` — lokal API-smoke (env: `GUIDES_SMOKE_API_URL`, `GUIDES_E2E_EMAIL`, `GUIDES_E2E_PASSWORD`; defaults endast för lokal e2e).

### Begränsningar / residual (Security 2026-07-22)

- Inga accepterade nya risker som kräver TPM-beslut.
- Residual: `_addTenantFilter` hoppar över om SQL redan nämner `\buser_id\b` (befintligt mönster).
- Prompt-injection via källinnehåll till text-provider: oförändrad LLM-yta.

**ADR:** [`docs/ai/adr/P-GUIDES_PLACE_PRESENTATION.md`](ai/adr/P-GUIDES_PLACE_PRESENTATION.md); HITL-domänwriteback korrigerad i [`CONTENT_PRODUCTION_PIPELINE_V2.md`](ai/adr/CONTENT_PRODUCTION_PIPELINE_V2.md).

---

## 2026-07 – Guides produce UX split (knappar, badges, språkkolumn)

**Status:** Implementerat lokalt.

**Sammanfattning:** Separata knappar för källtext vs översättningar, färgkodade statusbadges, listkolumn med genererade språk.

### Frontend

- **GuideProductionPanel** — _Generera källtext_ (`phases: text_derivation`) och _Generera översättningar_ (`phases: translation`, multi-välj målspråk; skapar presentation-shells vid behov).
- **StartProductionDialog** — lägen `source` | `translation` med egna titlar och språkval.
- **GuideLanguageBadges** — delad komponent för språk-badges (källspråk markerat).
- **GuideList / GuideCard** — kolumn _Språk_ ersätter källspråk; visar bara språk med text.
- **Badge-färger** — `GUIDE_PUBLICATION_COLORS`, `GUIDE_APPROVAL_COLORS`, `GUIDE_STALENESS_COLORS` i presentationsvy.

### Backend

- **GET /guides** och **GET /guides/:id** — fält `languages: string[]` (presentationer med non-empty `presentation_text`).

---

## 2026-07 – Guides Create UX Polish (land-filter, språkval, collapsible)

**Status:** Implementerat lokalt.

**Sammanfattning:** Förbättrar manuellt guide-skapande – enklare formulär, land-filter i platssök, per-språk produktion och collapsible texter.

### Frontend

- **GuideForm** — `short intro`-fältet borttaget från skapa/redigera-UI (kolumn kvar nullable); `sourceLanguage` default ändrat till `en`.
- **PlaceSearchField** — land-dropdown (ISO alpha-2) ovanför sökfältet; skickar `countryCode` till API.
- **StartProductionDialog** — multi-select för språk; default = språk utan text; `force` påverkar bara valda språk.
- **GuidePresentationSection** — collapsible kort per språk; `onPresentationsChange`-callback. _(Superseded 2026-07-22: alla kort kollapsade vid full load — se posten `8a81785`.)_
- **GuideView** — genererade språk visas som badges i info-sidopanelen.

### Backend

- **`GET /places/search`** — optional `countryCode` (ISO alpha-2) vidarebefordras som `countrycodes` till Nominatim.
- **`NominatimPlaceProvider`** — accepterar `options.countryCode`.

### Tester

- `nominatimMapping.test.js` — ny testsvit för `countryCode`-param.

---

## 2026-07 – Content Production Pipeline P-TEXT (`guides`-plugin, backend, Fas 2)

**Status:** Backend klar (QA, Security, Documentation). **Ej deployad** — väntar commit/merge till `main` / Railway. Bygger på P-FRONTEND + P-REGEN (lokal).

**Sammanfattning:** Första riktiga AI-integrationen i produktionskedjan — utbytbar `OpenAITextProvider` som omvandlar `canonical_narrative` till `presentation_text` per variant (`quick` / `normal` / `deep`).

### Backend

- **OpenAITextProvider** — OpenAI Chat Completions; registreras när `OPENAI_API_KEY` finns.
- **TextPromptLoader** — versionerade prompts i `plugins/guides/providers/text/prompts/` (manifest v1).
- **ProviderRateLimiter** — in-process token bucket; proaktiv limit + retry vid HTTP 429.
- **Env wiring** — `GUIDES_TEXT_PROVIDER` (default `noop`) styr text-steget i orchestration.
- **providerResult** — full JSONB-blob (`raw`, `usage`, `promptVersion`, `latencyMs`) sparas per item (P4).
- **Retry** — `_processItem` sätter `status: retry` → `pending` + `retry_after` vid rate limit.
- **Fingerprint** — `providerVersion` inkluderar modell + prompt-set (`openai@{model}@prompts-v1`).
- **Tester:** guides-sviten **150 tester** (+16 P-TEXT-relaterade).

### Env

| Variabel                        | Default       | Beskrivning         |
| ------------------------------- | ------------- | ------------------- |
| `GUIDES_TEXT_PROVIDER`          | `noop`        | `noop` \| `openai`  |
| `OPENAI_API_KEY`                | —             | Krävs för `openai`  |
| `GUIDES_TEXT_OPENAI_MODEL`      | `gpt-4o-mini` | Modell              |
| `GUIDES_TEXT_OPENAI_TIMEOUT_MS` | `60000`       | Request-timeout     |
| `GUIDES_TEXT_RATE_LIMIT_RPM`    | `60`          | Proaktiv rate limit |

### Operativt

- Kräver P-ASYNC + P-CHAIN + P-REGEN + P-FRONTEND (migration 099). Ingen ny migration.
- Default `GUIDES_TEXT_PROVIDER=noop` — befintligt beteende oförändrat utan explicit env.
- Sätt `GUIDES_TEXT_PROVIDER=openai` + `OPENAI_API_KEY` för riktig textgenerering.
- `OPENAI_API_KEY` endast i env (Railway secrets / `.env.local`); rotera vid misstanke.

### Säkerhet (godkänd 2026-07-14)

- API-nyckel: env only; ej i loggar, DB eller `provider_result`.
- Prompt injection: accepterad risk — redaktörskriven `canonicalNarrative`, HITL före domän-writeback.
- Rate limit: `ProviderRateLimiter` (60 RPM) + retry vid HTTP 429; in-process (single worker v1).
- SSRF: mitigerad — hårdkodad OpenAI-URL.

### Begränsningar

- Translation/audio fortfarande noop/skipped.
- Ingen frontend-ändring (review-UI läser `presentationText` som tidigare).
- Manuell smoke med riktig OpenAI-nyckel ej i CI.
- E2E noop-regression ej omkörd i P-TEXT-sprinten — rekommenderas före release.
- `regenerate`-endpoint utan dedikerad rate limit (ärvd); text-API-anrop begränsas av limiter.

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P-TEXT; ADR: `docs/ai/adr/P-TEXT_TEXT_PROVIDER.md`.

**Roadmap:** P-TEXT backend klar (grindad) — nästa **P-TRANS**.

---

## 2026-07 – Content Production Pipeline P-FRONTEND (`guides`-plugin, frontend, Fas 2)

**Status:** Frontend MVP klar (QA, Security, Documentation). **Ej commit/deployad** — väntar explicit användarbegäran. Bygger på P-REGEN-backend (lokal, ej deployad).

**Sammanfattning:** Redaktörs-UI för fasindelad produktion i `GuideView` — starta jobb, poll:a status, granska textutkast (HITL), fortsätt till översättning, retry/cancel och jobbhistorik.

### Frontend (`client/src/plugins/guides/`)

- **`useProductionJob`** — state + 3s poll mot `GET …/production-jobs/:jobId`; synkar `jobs`-lista vid terminal status (B1-fix).
- **`guidesApi`** — production-jobb: list, get, start, approve/reject/regenerate item, approve-phase, cancel, retry.
- **Komponenter:** `ProductionPhaseBanner`, `ProductionPhaseIndicator`, `GuideProductionPanel`, `ProductionJobHistory`, `StartProductionDialog`, `GuideReviewQueue`, `GuideReviewItem`.
- **Integrering:** `GuideView` (banner + review-kö + sidebar); scoped start från stopp/variant i `GuideStopsSection` / `GuideVariantsSection`.
- **i18n:** `guides.production.*` (sv/en).
- **Tester:** `productionJobHelpers.test.ts` — 7 unit-tester; `jest.config.js` utökad med `client/src/plugins/guides`.

### MVP-scope (levererat)

| Funktion                                               | UI                     |
| ------------------------------------------------------ | ---------------------- |
| Produktionsstatus + fasindikator (Text → Översättning) | Banner + sidebar-panel |
| Starta produktion (hel guide / stopp / variant)        | Dialog + Play-knappar  |
| Poll 3s vid aktivt jobb                                | `useProductionJob`     |
| Granska textutkast per item                            | Review-kö              |
| Godkänn / avvisa / regenerera                          | Per item               |
| Fortsätt till översättning                             | `approve-phase`        |
| Fel + retry / cancel                                   | Banner + panel         |
| Jobbhistorik                                           | Sidebar-lista          |

### Utelämnat (medvetet, MVP)

- Pre-flight estimate / kostnad (`ProductionPreflightDialog`)
- Bulk _Godkänn alla_
- Gransknings-UI för översättning och ljud (`after_text` — översättning körs utan extra review)
- P2/P5-paneler, PWA, provider-admin

### Operativt

- Kräver P-ASYNC + P-CHAIN + P-REGEN backend lokalt (migration 099, worker för E2E).
- `GUIDES_PRODUCTION_WORKER_ENABLED=true` för in-process worker i API; annars pumpa via `scripts/run-production-worker-tick.js` (se E2E nedan).
- Logga ut/in efter plugin-access-ändringar (oförändrat).

### E2E (automatiserat, 2026-07-14)

| Script                                  | Syfte                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `scripts/guides-production-e2e.js`      | Puppeteer + API — checklista A–G (start, review, approve-phase, B1, scoped start/cancel, historik, 409) |
| `scripts/run-production-worker-tick.js` | Ett worker-tick per tenant (lokal dev när API-worker är avstängd)                                       |

**Körning:**

```bash
npm run dev:all
npm run migrate:guides
npm run puppeteer:install-chrome   # vid behov
node scripts/guides-production-e2e.js
```

Env: `GUIDES_E2E_BASE_URL` (default `http://localhost:3001`), `GUIDES_E2E_EMAIL` / `GUIDES_E2E_PASSWORD`, `PUPPETEER_CACHE_DIR` (default `.cache/puppeteer`). E2E aktiverar **force** vid start för att undvika fingerprint-dedup vid upprepade körningar.

**Verifierat:** 16 PASS / 0 FAIL (lokal, admin@homebase.se).

### Backend-fixar (worker-stabilitet, samma leverans)

Blockerade E2E tills åtgärdade (P-ASYNC/P-CHAIN-berörda):

| Fix              | Fil                                                           | Effekt                                                            |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Param-räkning    | `server/core/services/database/adapters/PostgreSQLAdapter.js` | `_getParamCount` använder högsta `$N` (inte antal förekomster)    |
| Status-UPDATE    | `plugins/guides/production/ProductionJobModel.js`             | `$1::text` i `updateJobStatus` — PG-typ vid tenant-filter         |
| Stalled planning | `plugins/guides/production/ProductionOrchestrationService.js` | `_resumeStalledPlanningJobs` återupptar `planning` → `processing` |

### Begränsningar

- E2E ~5 min (worker-pump); kräver lokal stack — ej CI-dokumenterat ännu.
- `run-production-worker-tick.js` är **local dev only** (processar alla tenants i main DB).
- `production.isLoading` visas inte i UI.
- Narrative-gate före start ej enforced i backend (ärvd risk S6).
- Multi-worker race vid stalled-planning recovery (S-FIX-3, accepterad tills flera worker-instanser).

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P-FRONTEND; UX: `docs/ai/design/GUIDES_CONTENT_PRODUCTION_UX_V2.md` §8.

**Roadmap:** P-FRONTEND klar — P-TEXT backend klar (se egen sektion); nästa **P-TRANS**. Se `docs/ai/CHANGELOG.md` § Guide CMS – Roadmap (Fas 2).

---

## 2026-07 – Content Production Pipeline P-REGEN (`guides`-plugin, backend, Fas 2)

**Status:** Backend klar (QA, Security, Documentation). **Ej deployad** — väntar commit/merge till `main` / Railway. Bygger på P-CHAIN. Review-kö-UI i **P-FRONTEND**.

**Sammanfattning:** Per-item HITL — godkänn, avvisa och regenerera production items; `approve-phase` som fasövergångsgate; utökad fingerprint och `retryJob`.

### Backend

- **Per-item HITL:** `approve`, `reject`, `regenerate` på job items i aktuell review-fas.
- **`approve-phase` (refaktorerad):** gate-only — kräver terminal `review_status` på alla completed items; ingen implicit bulk-approve.
- **`bulk-approve`:** convenience-endpoint för "Godkänn alla" i aktuell fas.
- **`retryJob`:** återuppta `failed` jobs från aktuell fas.
- **Fingerprint:** `ingestRunId` (text), translation-fält; dedup scoped till `user_id`.
- **`languages`:** valfritt filter vid `startJob` (`jobOptions.languages`).
- **Tester:** 134 i guides-sviten (+11 P-REGEN-tester).

### Nya API-endpoints

| Metod | Path                                             | Beskrivning                         |
| ----- | ------------------------------------------------ | ----------------------------------- |
| POST  | `…/production-jobs/:jobId/items/:itemId/approve` | Godkänn item → applicera på domän   |
| POST  | `…/items/:itemId/reject`                         | Avvisa item (`{ reason? }`)         |
| POST  | `…/items/:itemId/regenerate`                     | Supersede + nytt pending item       |
| POST  | `…/items/bulk-approve`                           | Bulk-godkänn `pending_review` i fas |
| POST  | `…/retry`                                        | Requeue failed job                  |

### Brytande semantik (mot P-CHAIN)

- **`approve-phase`** kräver per-item-beslut (`approved` \| `rejected` \| `superseded`) innan fasövergång — bulk-approve via `bulk-approve` eller per-item `approve` först.

### Operativt

- Kräver P-ASYNC + P-CHAIN (migration 099). Ingen ny migration.

### Begränsningar

- Review-kö-UI levererades i **P-FRONTEND** (se egen sektion).
- Dedup ignorerar `review_status` — `rejected`/`superseded` blockerar omkörning utan `force`/`regenerate`.
- `regenerate` utan endpoint-rate limit (ärvd); text-API-anrop begränsas av P-TEXT `ProviderRateLimiter`.

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P-REGEN.

**Roadmap:** P-REGEN backend klar — frontend i **P-FRONTEND** (se egen sektion).

---

## 2026-07 – Content Production Pipeline P-CHAIN (`guides`-plugin, backend, Fas 2)

**Status:** Backend klar (QA, Security, Documentation). **Ej deployad** — väntar commit/merge till `main` / Railway. Bygger på P-ASYNC (migration 099). Frontend poll/review i **P-FRONTEND**.

**Sammanfattning:** Fasindelad production pipeline — text → translation via `phases` + `current_phase_index`, HITL-stopp med `approve-phase`, och `checkpoint_mode` (default `after_text`).

### Backend

- **Fasvis planering:** worker planerar endast aktuell fas (`phases[currentPhaseIndex]`); fas N+1 endast för varianter med `review_status=approved` i fas N.
- **`approve-phase`:** fasövergångsgate (semantik skärpt i **P-REGEN** — se egen sektion).
- **Checkpoint:** `after_text` (default) stoppar efter fasen **`text_derivation`** (fasnamn, inte index 0); `after_each` stoppar efter varje fas; `auto` auto-advancerar utan `awaiting_review`. Translation-only jobb under `after_text` checkpointar **inte**.
- **Deprecated:** `POST …/approve` delegerar till `approvePhase({ continue: true })` med varning i logg.
- **F1-fix:** cancel under planning skriver inte över `cancelled` → `processing`.
- **Tester:** 123 i guides-sviten (+5 P-CHAIN-tester).

### Brytande API-förändring

- **Default `phases`:** `["text_derivation", "translation"]` när klient utelämnar `phases`/`steps` (tidigare endast `text_derivation` i P-ASYNC).
- **Ny endpoint:** `POST …/production-jobs/:jobId/approve-phase` — ersätter semantiken för job-nivå `approve`.

### Operativt

- Kräver P-ASYNC (migration 099) och lokal worker om manuell E2E-test (`GUIDES_PRODUCTION_WORKER_ENABLED=true`).
- Ingen ny migration.

### Begränsningar

- Per-item HITL tillkom i **P-REGEN** (se egen sektion).
- Audio-fas planeras som `skipped` om angiven — batch audio tillhör P-AUDIO-BATCH.
- Med `after_text` auto-advancerar faser som **inte** är `text_derivation` utan `awaiting_review` (translation — inkl. translation-only jobb — får ingen HITL-stopp som default).

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P-CHAIN.

**Roadmap:** Se `docs/ai/CHANGELOG.md` § Guide CMS – Roadmap (Fas 2).

---

## 2026-07 – Content Production Pipeline P-ASYNC (`guides`-plugin, backend, Fas 2)

**Status:** Backend klar (QA, Security, Documentation). **Ej deployad** — väntar commit/merge till `main` / Railway. Kräver migration **099** per tenant (utöver 096–098).

**Sammanfattning:** Async worker-grund för ProductionJob — `POST …/production-jobs` returnerar omedelbart med `status: pending`; bakgrundsworker planerar och exekverar items via DB-kö (`FOR UPDATE SKIP LOCKED`).

### Backend

- **Worker:** `WorkerService` (poll per tenant), `SupervisorService` (stuck-item reset), `workerContext.js`.
- **Orkestrering:** `startJob` enqueuar; `runWorkerTick` claimar jobb/items asynkront.
- **Schema:** migration `099-guide-production-v2-async.sql` — fasfält, `user_id` på items, worker-heartbeat-tabell.
- **Avbrott:** `cancelJob` stoppar aktiva items; all-failed jobs → `failed` (ej `awaiting_review`).
- **Boot/shutdown:** worker startar vid plugin-init; `shutdownGuidesProductionWorker` vid app-shutdown.
- **Tester:** 118 i guides-sviten (bl.a. claim SQL, supervisor, async orchestration).

### Brytande API-förändring

- **Före (v1):** `POST …/production-jobs` körde synkront och returnerade jobb med items och ofta `awaiting_review` i samma svar.
- **Efter (P-ASYNC):** samma endpoint returnerar `{ job: { status: "pending", … }, items: [] }`; klient ska polla `GET …/production-jobs/:jobId` tills `awaiting_review`, `completed`, `failed` eller `cancelled`.

### Operativt

- Kör `npm run migrate:guides` (inkluderar 096–099) per tenant före deploy.
- Env: `GUIDES_PRODUCTION_WORKER_ENABLED` (default på utom i `NODE_ENV=test`), `GUIDES_PRODUCTION_WORKER_POLL_MS`, `GUIDES_PRODUCTION_WORKER_BATCH_SIZE`, `GUIDES_PRODUCTION_ITEM_TIMEOUT_MIN`, `GUIDES_PRODUCTION_MAX_RETRIES`.

### Begränsningar

- Multi-fas-kedja och `approve-phase` tillkom i **P-CHAIN** (se egen sektion).
- Async poll och review-kö-UI levererades i **P-FRONTEND**.
- Race vid cancel under `planning` delvis åtgärdad i P-CHAIN (F1).

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P-ASYNC.

**Roadmap:** Se `docs/ai/CHANGELOG.md` § Guide CMS – Roadmap (Fas 2).

---

## 2026-07 – Content Production Pipeline P1, P2, P5, P7 (`guides`-plugin, backend)

**Status:** Backend klar (QA, Security, Documentation). **Deployad till `main` / Railway 2026-07-13** (`guides-v1.0`). Frontend UI saknas.

**Sammanfattning:** Första backend-leverans av Content Production Pipeline — prod-hardening (P1), HITL/approval (P2), ingest-koppling (P5) och ProductionJob-orkestrering (P7) med noop Text/Translation.

### Backend

- **P1:** Blockera klient-`storageRef`/`ready` på audio CRUD; `R2StorageAdapter.download()`.
- **P2:** `approval_status`; approve-routes; publish-gates på variant och place `active`.
- **P5:** `GuideIngestBridgeService`; ingest-source, source-content, refresh.
- **P7:** ProductionJob-tabeller, batch API, fingerprint, noop providers.
- **Migrationer:** `096-guide-approval-status.sql`, `097-guide-ingest-source.sql`, `098-guide-production-jobs.sql` (tenant DB).
- **Tester:** 110+ i guides-sviten + R2-adaptertest.

### Operativt

- Kör migration 096–099 per tenant före deploy (`npm run migrate:guides`).
- `PUBLIC_GUIDES_USER_ID` på Railway + `.env.local` (oförändrat från Epic 7).

### Begränsningar

- Ingen frontend för approval, ingest eller production-jobb.
- Public API filtrerar inte `approval_status` (accepterad risk R1).
- Batch audio-steg `skipped` — manuell generate i UI (Epic 6).

**Spec:** `docs/ai/CHANGELOG.md` § Content Production Pipeline – P1, P2, P5, P7.

**Roadmap:** P1/P2/P5/P7 backend klara — se `docs/ai/CHANGELOG.md` § Guide CMS – Roadmap.

---

## 2026-07 – Guide CMS Epic 7 (`public-guides`-plugin)

**Status:** Slutförd (Backend, QA, Security, Documentation, TPM). Deployad till `main` / Railway.

**Sammanfattning:** Publik read-only Guides API utan autentisering — fyra GET-endpoints under `/api/public/guides` med strikt publiceringsfilter (A3) och audio-proxy.

### Backend

- **Plugin:** [`plugins/public-guides/`](../plugins/public-guides/) — speglar `public-cups` (tenant-pool, `PUBLIC_GUIDES_USER_ID`).
- **API:** `GET /api/public/guides`, `GET /:placeId`, `GET /:placeId/stops`, `GET /:placeId/stops/:stopId/variants/:variantId/audio`.
- **Filter:** `lifecycle_status = active`, `publication_status = published`, `staleness_status = fresh`, audio `status = ready`.
- **Rate limit:** `publicEndpointLimiter` (60/15 min per IP).
- **Shutdown:** `shutdownPublicGuidesPool` i [`server/index.ts`](../server/index.ts).
- **Tester:** 11 st i `plugins/public-guides/__tests__/`.

### Konfiguration

- `PUBLIC_GUIDES_USER_ID` / `PUBLIC_GUIDES_USER_EMAIL` i `.env.local` och Railway.
- Prod: `PUBLIC_GUIDES_USER_ID=1` (`cyanostudios@gmail.com`).

### Begränsningar

- Ingen frontend-konsument.
- `?language=` filtrerar varianter men inte stopp-listan (tomma `variants[]` möjligt).
- R2-lagrad audio stödjer stream via proxy efter P1 (S29 åtgärdad).
- Klient-`storageRef` blockeras i auth API (P1); legacy DB-data bör verifieras operativt.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 7.

**Roadmap:** Epic 1–7 slutförda — se `docs/ai/CHANGELOG.md` § Guide CMS – Roadmap.

---

## 2026-07 – Guide CMS Epic 6 (`guides`-plugin)

**Status:** Slutförd (Backend + Frontend, QA, Security, Documentation). Väntar TPM-avslut och commit.

**Sammanfattning:** Komplett audio-flöde för redaktörer — generate/cancel/preview via `AudioOrchestrationService`, noop E2E i dev, och `GuideAudioSection` i variantvyn.

### Backend

- **Orkestrering:** [`AudioOrchestrationService.js`](../plugins/guides/audio/AudioOrchestrationService.js) — generate/cancel/preview/deleteWithBlob.
- **Storage:** [`storageRef.js`](../plugins/guides/audio/storageRef.js), [`uploadAudioBuffer.js`](../plugins/guides/audio/uploadAudioBuffer.js).
- **API:** `POST …/variants/:variantId/audio/generate`, `POST …/cancel`, `GET …/preview` (utöver Epic 5 CRUD).
- **noop:** Minimal WAV + synkront `ready` i dev.
- **Regler:** `PUT …/audio` blockerar manuell `ready`; `generate` kräver `presentationText`.
- **Tester:** 91 st i `plugins/guides/__tests__/`; hela sviten 141 tester.

### Frontend

- **Komponent:** [`GuideAudioSection.tsx`](../client/src/plugins/guides/components/GuideAudioSection.tsx) inbäddad i [`GuideVariantsSection.tsx`](../client/src/plugins/guides/components/GuideVariantsSection.tsx).
- **API-klient:** `generateAudio`, `cancelAudio`, `deleteAudio`, `getAudioOrNull`, `getAudioPreviewUrl` i [`guidesApi.ts`](../client/src/plugins/guides/api/guidesApi.ts).
- **Typer:** `GuideAudio`, `AudioStatus` i [`types/guides.ts`](../client/src/plugins/guides/types/guides.ts).
- **i18n:** `guides.audio.*` i `en.json` / `sv.json`.
- **UX:** Alla states, poll 3 s, preview via proxy, confirm vid regenerering/radering.

### Begränsningar

- Extern TTS-provider, public API, prod-hardening S15/S16 (valfritt före prod).
- Preview för `stale` kan 404 (backend kräver `ready`) — se S22 i spec.
- Audio-status synkas inte automatiskt vid narrative-ändring utan reload.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 6.

**Nästa:** TPM epic-avslut; commit/deploy på begäran.

---

## 2026-07 – Guide CMS Epic 5 (`guides`-plugin, backend)

**Status:** Slutförd (Backend, QA, Security, Documentation, TPM).

**Sammanfattning:** Audio metadata CRUD under VariantPresentation — `status`, `providerKey`, `storageRef`, `durationMs`, `mimeType`, `errorMessage`. Provider-interface med `noop`-stub; staleness-propagation vid `canonicalNarrative`-ändring. Backend-grindordning godkänd.

### Backend

- **Migration:** `095-guide-audio.sql` — tabell `guide_audio` (UNIQUE FK till `guide_variant_presentations`, CASCADE).
- **API:** `GET/POST/PUT/DELETE /api/guides/:placeId/stops/:stopId/variants/:variantId/audio` (1:1, ingen separat `audioId`).
- **Provider:** `plugins/guides/audio/` — `AudioProvider`, `NoopAudioProvider`, `AudioProviderRegistry` (registreras i `index.js`).
- **Validering:** `parseAudioStatus`, `parseProviderKey`, `audioStatusBodyRule`, `providerKeyBodyRule` i [`plugins/guides/validation.js`](../plugins/guides/validation.js).
- **Staleness:** `_markAudioStaleForStop` vid narrative-ändring på stopp.
- **Tester:** 78 st i `plugins/guides/__tests__/` (18 nya/uppdaterade för audio).

### Drift

- Kör `npm run migrate:guides` lokalt och prod (inkluderar `095`).
- Logga ut/in efter plugin-access-ändringar (parity).

### Ej inkluderat

- Extern TTS, public API. _(Faktisk generering och frontend UI tillagt i Epic 6.)_

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 5.

**Nästa:** Epic 6 slutförd — se `docs/ai/CHANGELOG.md` § Guide CMS – Epic 6.

---

## 2026-07 – Guide CMS Epic 4 (`guides`-plugin)

**Sammanfattning:** VariantPresentation CRUD i API och UI under GuideStop — `variantType`, `language`, `presentationText`, `publicationStatus`, `stalenessStatus`. Auto-create av quick/normal/deep vid stop create; staleness vid `canonicalNarrative`-ändring. Full grindordning godkänd (backend + frontend, QA, Security).

### Backend

- **Migration:** `094-guide-variant-presentations.sql` — tabell `guide_variant_presentations` (FK till `guide_stops`, CASCADE); unik `(stop_id, variant_type, language)`; backfill för befintliga stopp.
- **API:** `GET/POST /api/guides/:placeId/stops/:stopId/variants`, `GET/PUT/DELETE …/variants/:variantId`.
- **Validering:** `parseVariantType`, `parsePublicationStatus`, `parseStalenessStatus`, `parseLanguage` i [`plugins/guides/validation.js`](../plugins/guides/validation.js).
- **Sidoeffekter:** `createStop` skapar 3 default-varianter; `updateStop` markerar varianter `stale` vid narrative-ändring.
- **Tester:** 60 st i `plugins/guides/__tests__/`.

### Frontend

- **Variant-sektion:** [`GuideVariantsSection.tsx`](../client/src/plugins/guides/components/GuideVariantsSection.tsx) inbäddad i [`GuideStopsSection.tsx`](../client/src/plugins/guides/components/GuideStopsSection.tsx) — lista, create/edit, delete med bekräftelse.
- **API-klient:** `getVariants`, `createVariant`, `updateVariant`, `deleteVariant` i [`guidesApi.ts`](../client/src/plugins/guides/api/guidesApi.ts).
- **Typer:** `GuideVariantPresentation`, payloads, enum-helpers i [`types/guides.ts`](../client/src/plugins/guides/types/guides.ts).
- **i18n:** `guides.variants`, `guides.variantTypes.*`, `guides.publication.*`, `guides.staleness.*`, `guides.audio.*` (Epic 6) m.m.

### Drift

- Kör `npm run migrate:guides` lokalt och prod (inkluderar `094`).

### Begränsningar

- Variantlistan laddas inte om automatiskt efter narrative-ändring på stopp (stale-badge efter reload).
- `stalenessStatus` ej klientskrivbar.
- Default-varianter kan raderas.
- `publicationStatus` utan transition-regler i v1.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 4.

---

## 2026-07 – Guide CMS Epic 3 (`guides`-plugin)

**Sammanfattning:** GuideStop CRUD i API och UI under Place — `title`, `sequenceOrder`, `canonicalNarrative`, `editorialStatus`. Full grindordning godkänd (backend + frontend, QA, Security).

### Backend

- **Migration:** `093-guide-stops.sql` — tabell `guide_stops` (FK till `guide_master_guides`, CASCADE).
- **API:** `GET/POST /api/guides/:placeId/stops`, `GET/PUT/DELETE …/stops/:stopId`, `PUT …/stops/reorder`.
- **Validering:** `parseGuideStopEditorialStatus`, `guideStopEditorialStatusBodyRule` i [`plugins/guides/validation.js`](../plugins/guides/validation.js).
- **Tenant-scope:** join `guide_places` på alla stop-queries.
- **Tester:** 36 st i `plugins/guides/__tests__/`.

### Frontend

- **Stopp-sektion:** [`GuideStopsSection.tsx`](../client/src/plugins/guides/components/GuideStopsSection.tsx) i `GuideView` — lista, create/edit, upp/ner-omordning, delete med bekräftelse.
- **API-klient:** `getStops`, `createStop`, `updateStop`, `deleteStop`, `reorderStops` i [`guidesApi.ts`](../client/src/plugins/guides/api/guidesApi.ts).
- **Typer:** `GuideStop`, `GuideStopPayload` i [`types/guides.ts`](../client/src/plugins/guides/types/guides.ts).
- **i18n:** `guides.addStop`, `guides.canonicalNarrative`, felmeddelanden m.m.

### Drift

- Kör `npm run migrate:guides` lokalt och prod (inkluderar `093`).

### Begränsningar

- Reorder kräver full lista av `stopIds` för platsen.
- Sekvensluckor efter delete.
- Upp/ner-omordning (ej drag-and-drop).
- `sourceLanguage`-ändringsregel vid befintliga stopp — öppen affärsfråga.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 3.

---

## 2026-07 – Guide CMS Epic 2 (`guides`-plugin)

**Sammanfattning:** MasterGuide kan uppdateras via API och redigeras i UI — `sourceLanguage` och `masterGuideEditorialStatus` (`draft` \| `in-progress` \| `complete`). Full grindordning godkänd (backend + frontend, QA, Security).

### Backend

- **API:** utökad `PUT /api/guides/:id` med valfria `sourceLanguage`, `masterGuideEditorialStatus`.
- **Validering:** `parseMasterGuideEditorialStatus`, `masterGuideEditorialStatusBodyRule` i [`plugins/guides/validation.js`](../plugins/guides/validation.js).
- **Tenant-scope:** MasterGuide-UPDATE joinar `guide_places` (samma mönster som Epic 1 SELECT).
- **Ingen ny migration.**

### Frontend

- **Master guide i vy:** `GuideView` visar källspråk och redaktionell status; tom sektion för Guide stops (placeholder).
- **Redigering:** `GuideForm` — `sourceLanguage` (create + edit), `masterGuideEditorialStatus` (edit only).
- **Provider:** `GuidesProvider` skickar båda fälten vid update.
- **Typer:** `MasterGuideEditorialStatus`, `MASTER_GUIDE_EDITORIAL_STATUSES` i [`types/guides.ts`](../client/src/plugins/guides/types/guides.ts).
- **i18n:** `guides.masterGuide`, `guides.editorial.*`, `guides.guideStops`, `guides.stopsNoYet`.

### Leverans

- **`.gitignore`:** `/guides/` (repo-root only) — plugin-sökvägar `client/src/plugins/guides/` och `plugins/guides/` spårbara i git.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 2.

---

## 2026-07 – Guide CMS Epic 1 (`guides`-plugin)

**Sammanfattning:** Nytt plugin för audioguide-redaktion: Place CRUD med atomisk MasterGuide vid skapande. Säkerhetsgodkänd efter tenant-isoleringsfix (migration 092).

### Backend

- **Plugin:** [`plugins/guides/`](../plugins/guides/) — route `/api/guides`, gate `requirePlugin('guides')`, CSRF på POST/PUT/DELETE.
- **Tabeller (tenant DB):** `guide_places` (090), `guide_master_guides` (090), `user_id` på places (092).
- **Validering:** delad [`plugins/guides/validation.js`](../plugins/guides/validation.js) för `sourceLanguage` och `lifecycleStatus`.
- **Tenant-scope:** `user_id` sätts vid INSERT; PostgreSQLAdapter filtrerar LIST/GET/UPDATE/DELETE.

### Frontend

- **Plugin:** [`client/src/plugins/guides/`](../client/src/plugins/guides/) — list/form/view, kategori Content, sidebar `guides`.
- **API-klient:** `guidesApi.ts` via `createApiClient('/guides')`.

### Drift

- **Migrationer:** `090-guides.sql`, `092-guide-places-user-id.sql` (tenant); `091-grant-guides-plugin-access.sql` (main).
- **Kör:** `npm run migrate:guides` (lokal + prod parity).
- **Plugin-access:** `npm run set:tenant-plugins -- --both --email=… --enable=guides` vid behov; logga ut/in efteråt.

### Begränsningar (v1)

- Ingen GuideStop, Variant, Audio eller public API.
- MasterGuide-metadata (`sourceLanguage`, `masterGuideEditorialStatus`) redigeras i UI från Epic 2.
- Full CRUD för alla med plugin-åtkomst inom tenant.

**Spec:** `docs/ai/CHANGELOG.md` § Guide CMS – Epic 1.

---

## 2026-07 – Slots: minskade API-anrop och delad cache

**Sammanfattning:** Slots-pluginet hämtar inte längre hela listan globalt var 30:e sekund; cross-plugin-vyer återanvänder provider-cache istället för egna `GET /api/slots`.

### Frontend

- **`SlotsProvider`:** Polling begränsad till `/slots`-routen när fliken är synlig (30s) + refetch vid `focus`/`visibilitychange`. Registrerad i `registerSharedDataRefresh('slots')`. Synkar till AppContext via `syncSharedSlots`.
- **`AppContext`:** Ny delad `slots[]` och `syncSharedSlots`; `getSlotsForContact` filtrerar client-side (`filterSlotsForContact`) utan extra API-anrop.
- **`MatchView`:** Relaterade slots hämtas från `useSlotsContext().slots` (filter på `match_id`), inte egen `slotsApi.getSlots()`.
- **`slotContactUtils.ts`:** Ny `filterSlotsForContact()` för kontakt–slot-kopplingar.

**Oförändrat:** Backend routes och auktorisering; initial load vid inloggning kvar.

---

## 2026-07 – Plugin golden templates (etapp 1–3)

**Sammanfattning:** Frontend-mallen uppdaterad till v3.6-konventioner (contacts/notes som referens). Backend-mallen oförändrad; valfri kommentar om `/batch`.

### Mallar

- **`templates/plugin-frontend-template/`:** Context/Provider uppdelat (`YourItemsContext` + `YourItemsProvider`); v3.6 list shell med in-card toolbar; `useItemUrl` + deep-link; full-page `YourItemsSettingsView`; inline Save/Cancel i formulär; `formatDate` i vy/lista; borttagen `TemplateContext` och panel-settings (`YourItemSettingsForm`).
- **`templates/README.md`:** dokumenterar nya konventioner; avråder från `ContentToolbar` i listvyer.
- **`templates/plugin-backend-template/routes.js`:** kommentar om valfritt `DELETE /batch`.

---

## 2026-07 – Dokumentationsstädning (inaktuellt borttaget)

**Sammanfattning:** Root README och `DEVELOPMENT_GUIDE_V2` förenklade; föråldrad plugin-/migrations-/testinformation borttagen; metadata uppdaterad.

### Dokumentation

- **`README.md` (root):** borttagen marknadsföring (overifierade metrics), föråldrad roadmap (multi-tenant som "Future", "Complete API testing suite"), duplicerad snabbstart. Ersatt med kort ingång som pekar till `docs/README.md`.
- **`docs/DEVELOPMENT_GUIDE_V2.md`:** borttagen ~550 rader föråldrat innehåll (trasig markdown, `npm run migrate`/`test:integration`, `ServiceManager.get('cache')`, duplicerad plugin-workflow). Ersatt med canonical pekare till checklistor, `server/migrations/`, troubleshooting-tabell.
- **`packages/core/README.md`:** SDK-exempel korrigerat (`Database.get(req)`).
- **`docs/TENANT_USERS_AND_RBAC.md`**, **`docs/PLUGIN_ARCHITECTURE_V3.md`:** uppdaterat "Last updated".
- **`docs/README.md`:** borttagna referenser till äldre branches `homebase-v3.6` / `homebase-V3.5`.

**Oförändrat medvetet:** `CHANGELOG.md` (historik), `LESSONS_LEARNED.md` (anti-patterns), `REFACTORING_EXISTING_PLUGINS.md` (kort referens), `CLEANUP_DEFERRED_RISKS.md` (backlog).

---

## 2026-07 – Dokumentationsindex (etapp 1)

**Sammanfattning:** `docs/README.md` utökad med AI-team, local/prod parity och tydligare status för `REFACTORING_EXISTING_PLUGINS.md`. Metadata-datum synkade.

### Dokumentation

- **`docs/README.md`:** ny sektion `docs/ai/` (engineering principles, team workflow, cursor-implementation, roller, AI-changelog); `LOCAL_PROD_PARITY.md` i snabbstart och canonical-lista; `REFACTORING_EXISTING_PLUGINS.md` förtydligad som kort referens (inte borttagen fil).
- **`docs/REFACTORING_EXISTING_PLUGINS.md`:** index-pekare till canonical docs.
- **`docs/LESSONS_LEARNED.md`:** footer `Senast uppdaterad` → 2026-06 (stämmer med CSRF/rate-limit-innehåll).

---

## 2026-06 – Teams, Requests, Schedule + Matches FOGIS

**Sammanfattning:** Tre nya plugins (Teams, Requests, Schedule), utökad Matches-integration med SvFF FOGIS-import, cross-plugin URL-navigation, UI-polish och plugin-cleanup. Utvecklingsbranch: `homebase-v3.7` → merge till `main` för Railway.

### Teams (`109d832`, `af46680`, `4f415c1`, cleanup)

- **Datamodell:** `teams` med `training_times`, `series_teams`, `season_breaks`, `responsibles`, `team_notes`, `color`, `external_team_id` (088).
- **Vyer:** list/grid (`TeamList`, `TeamCard`), detail med flikar (overview, schedule, responsibles, notes, requests, matches), statistikvy (`TeamsStatisticsView`), reorderable overview cards (`TeamsSettingsView`).
- **Settings:** full-page `TeamsSettingsView` (active season, overview card order). Panel-`TeamSettingsForm` borttagen (död kod).
- **Cross-plugin:** `TeamMatchesSection`, `TeamRequestsSection`; klick öppnar match/team via URL (se cross-plugin nedan).
- **Import:** per-team FOGIS-matchimport när `external_team_id` är satt (`4f415c1`). Kopplingen sätts numera via lagväljare i TeamForm (se §2026-07-23); fritt textfält borttaget från UI.

### Requests (`e101cea`)

- **Tabell:** `requests` (080), `user_id` (082). Plugin-access: 081 (`MAIN_DB_ONLY`).
- **UX:** list/filter (default öppna/aktiva — `44a4ee8`), `TeamRequestsSection`, publikt formulär (`PublicRequestForm`).
- **Koppling:** `team_id` till Teams.

### Schedule (`6996331`, `05fd39f`, `718ae6e`)

- **Tabell:** `schedule_events` (083), `user_id` (085), `team_id` på events (086). Plugin-access: 084 (`MAIN_DB_ONLY`).
- **UI:** `ScheduleList`, `ScheduleTimeGrid`, `ScheduleTrainingDialog`, `PlanView` (custom plans: lock, import, transfer to default).
- **Deferred saves:** `useSchedulePendingChanges` + `saveTeamTrainingTimes` i `TeamProvider` — schemaändringar sparas batchvis.

### Matches (utökningar, inkl. ocommittat arbete)

- **FOGIS-import:** [`plugins/matches/services/matchImportService.js`](../plugins/matches/services/matchImportService.js) — SvFF Club API `/club/upcoming-games`, headers `ApiKey` + `Ocp-Apim-Subscription-Key`, per-team filter via `external_team_id`.
- **Schema:** 087 (`team_id`, `external_id` på matches), 089 (`home_score`, `away_score`, `result`, `competition_name`, `is_canceled`, `is_finished`, `is_postponed`).
- **UI:** resultat/status i view/form/list, `MatchQuickInfoDialog` från Teams, `MatchTeamBadge`, `MatchStatusBadges`.
- **Settings:** full-page `MatchSettingsView` (API URL, import). Panel-`MatchSettingsForm` borttagen.

### Cross-plugin URL-navigation

- **`useItemUrl().navigateToItem`** navigerar **bara** när URL redan är på pluginens baspath (`client/src/core/hooks/useItemUrl.ts`).
- **Cross-plugin:** anropa `navigate('/<plugin>/<slug>')` — `AppContent` URL-sync öppnar panelen automatiskt.
- **Exempel:** `MatchTeamBadge` → `/teams/{slug}`; `openMatchForView` från Teams → `/matches/{slug}` när användaren inte redan är på `/matches`.
- **Dokumentation:** `docs/MENTIONS_AND_CROSS_PLUGIN_UI.md` § Cross-plugin URL navigation.

### UI / core (`d80f251`, `87bf544`, `ac3b933`, `af46680`)

- Enhetliga grid-kort, inline quick-create (notes/tasks/requests).
- Förbättrad activity log (`activityLogDisplay.ts`, `DetailActivityLog`).
- Död kod borttagen: bl.a. `SettingsList.tsx`, `useEstimateStatusActions`, oanvända panel-settings-former.
- Plugin-cleanup (matches/teams): memoized context values, delade utilities (`formatMatchDateTime`, `MatchStatusBadges`).

### Drift

- **Tenant-migrationer:** se `server/migrations/README.md` §076–089.
- **Plugin-access:** `npm run set:tenant-plugins -- --both --email=… --enable=teams,requests,schedule,matches`
- **Parity:** kör tenant-migrationer lokalt och på prod; logga ut/in efter plugin-ändringar (`docs/LOCAL_PROD_PARITY.md`).

**Commits:** `109d832` … `4f415c1` (14 st sedan `d07880b`).

---

## 2026-06 – Railway prod: CSRF 500 + rate-limit 429 (fix + docs)

**Sammanfattning:** Produktion (`ENABLE_CSRF=true`) gav 500 på `/api/csrf-token` och kedja av 429 på plugin-API. Orsak + fix dokumenterade i Railway-guiden.

### Fix (kod)

- **`server/core/middleware/csrf.js`:** `csrf({ cookie: false })` — session-lagrad secret; undviker `misconfigured csrf` utan `cookie-parser` (`0bb24b9`).
- **`server/core/middleware/errorHandler.js`:** tydligare `CSRF_MISCONFIGURED` vid konfigurationsfel.
- **`server/core/middleware/rateLimit.js`:** prod-default **3000** / 15 min (tidigare 100); valfritt `RATE_LIMIT_MAX` (`74d23d7`).
- **`server/__tests__/security.test.js`:** regressionstest för CSRF med `ENABLE_CSRF=true`.

### Dokumentation

- **`docs/RAILWAY_HOMEBASE_SETUP.md`:** nya §5–7 (CSRF, rate limit, konsolfelsökning); `RATE_LIMIT_MAX` i variabellista.
- **`docs/SECURITY_GUIDELINES.md`:** CSRF/rate-limit avsnitt synkade med faktisk implementation.
- **`docs/LESSONS_LEARNED.md`:** csurf cookie-läge + låg prod rate limit.
- **`.env.example`:** `RATE_LIMIT_MAX` kommentar.

### Drift

- Deploy Railway från **`main`** (fix fanns först bara på `homebase-v3.6`).
- Verifiering: `curl …/api/csrf-token` → 200; efter login inga mass-429 på dashboard.

---

## 2026-05 – Cupappen drift documentation (post-incident)

**Sammanfattning:** Efter återställd cupappen.se (Docker `postgresql-libs`, `CUPS_DB_URL`, redeploy) tillagd canonical driftguide så samma misstag inte upprepas.

- **Ny:** [`docs/CUPPAPPEN_RAILWAY_OPERATIONS.md`](CUPPAPPEN_RAILWAY_OPERATIONS.md) — två Railway-tjänster, Dockerfile/`libpq`, checklista, 500 vs tom lista, Cloudflare apex.
- Uppdaterat: [`CUPPAPPEN_PATHS_AND_STORAGE.md`](CUPPAPPEN_PATHS_AND_STORAGE.md), [`public-cups/README.md`](../public-cups/README.md), [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md), kommentar i [`public-cups/Dockerfile`](../public-cups/Dockerfile).

---

## 2026-05 – Documentation audit (synkad med kod)

**Sammanfattning:** Canonical docs uppdaterade mot `main` (branch, Node 22, `server/index.ts`, `vite.config.ts`, `createApiClient`, `ServiceManager`-scope). Borttaget: `CONTACTS_LISTVIEW_STYLE_ROLLOUT_V36.md`, `RAILWAY_CRON_EXAMPLE.md`. `REFACTORING_EXISTING_PLUGINS.md` ersatt med kort referens (inga felaktiga `ServiceManager.get('storage')`-exempel). List shell v3.6 införlivat i `UI_AND_UX_STANDARDS_V3.md` §0.1. Index: `docs/README.md`.

---

## 2026-05 – Code cleanup (five categories; deferred risks)

**Sammanfattning:** Städning i fem kategorier mergad till `main` (kosmetisk, död kod, TS 49→0, tester, delvis `createApiClient` / `dateFormat`).

**Medvetet utelämnat / nästa runda:** se `docs/CLEANUP_DEFERRED_RISKS.md` (csurf → modern CSRF-paket, legacy tenant paths, `parseCupSource` split, stora UI-filer, resterande plugin-API:er, ESLint `any`-skuld). Railway session-CSRF + rate limit: fix 2026-06, se `RAILWAY_HOMEBASE_SETUP.md` §5–7.

---

## 2026-04-24 – Cups auto-refresh cron

**Sammanfattning:** Implementerade ett per-tenant opt-in cron-system som håller Cups (och cupappen) uppdaterad automatiskt via Railway Cron.

### Nytt

- **`POST /api/cron/cups/refresh`** — ny intern endpoint skyddad med `x-cron-secret` header (ej bakom requireAuth/CSRF). Stöder valfri `{ userId }` i body för manuell körning.
- **`plugins/cups/services/cronRefresh.js`** — tjänst som letar fram opt-in users ur `user_settings`, resolvar tenant-pool via `TenantContextService` och kör `importFromIngest` seriellt per källa med per-user try/catch.
- **Auto refresh toggle** i Cups Settings → Import-kategorin. Sparas som `autoRefresh: boolean` i `user_settings.settings` (JSONB merge, ingen migration krävs). Default: av.
- **`CRON_SECRET` env var** dokumenterad i `.env.example` och i `docs/CUPS_AUTO_REFRESH_CRON.md`.
- **`npm run cron:cups-refresh`** — lokal curl-shortcut för manuell testkörning.
- **`docs/CUPS_AUTO_REFRESH_CRON.md`** — fullständig dokumentation av arkitektur, Railway-setup, lokal testning, response-format och säkerhetsmodell.

### Befintligt återanvänt oförändrat

- `importFromIngest.js` med mark-and-sweep (soft-delete, hard-delete efter 30 dagar) används som-är.
- `plugins/public-cups/model.js` filtrerar redan `deleted_at IS NULL` — cupappen behöver inga ändringar.

---

## 2026-04-20 – Plugin list alignment (v3.6 rollout)

**Sammanfattning:** Samtliga plugin-listor i scope (`notes`, `tasks`, `matches`, `slots`, `estimates`, `invoices`, `files`, `mail`, `pulses`, `ingest`, `cups`) har alignats med Contacts-listans shell enligt commit `4021082`.

### Gemensam list-shell i plugins

- **En huvudpanel per lista:** `Card` med `overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950`.
- **List-toolbar i samma panel:** sökfält + settings + (där relevant) Grid/List-segment i toppraden.
- **Tabellstandard:** `Table rowBorders={false}` och `TableHeader` med grå yta (`bg-slate-50/90 dark:bg-slate-900/50`) där tabell används.
- **Grid-kort:** borderless kort (`rounded-xl border-0 ... shadow-sm`) i de listor som har gridläge.
- **Badge-standard:** borderless pill badges (`border-0 rounded-md px-2 py-0.5 text-xs font-semibold`) i status/type/source-kolumner där det är relevant.

### Dokumentation i samma leverans

- **Ny rollout-checklista:** `docs/CONTACTS_LISTVIEW_STYLE_ROLLOUT_V36.md`.
- **Cups i18n:** utökade nycklar för kolumnrubriker och empty-state copy i `client/src/i18n/locales/en.json` och `client/src/i18n/locales/sv.json`.

## 2026-04 – Homebase v3.6: Contacts design alignment (list, detail, panel primitives)

**Sammanfattning:** Stor designjustering av Contacts enligt referensfiler (`guides/homebase-contact.README.md`, `guides/homebase-contact.css`) med fokus på listvy, detail cards, sidebar/topbar-element och renare UI-primitiver utan lokala workarounds.

### Contacts list (`client/src/plugins/contacts/components/ContactList.tsx`)

- **Ny list-headerstruktur:** Rubrik + beskrivning + Add-knapp, statsrad och sammanhållen toolbar/list-panel i samma visuella block.
- **Statskort i topp:** Total, Företag, Privata, Med taggar med ny `StatCard`-byggsten.
- **Nya små byggstenar i listan:** `ContactAvatar` (företagsikon/initialer), `TypeBadge` (pill med prick), `StatCard`.
- **Toolbar redesign:** Search + Settings + Grid/List i samma kortpanel som tabellen; proportions- och padding-justeringar mot referensbild.
- **Grid/List-toggle:** Ombyggd till segmenterad kontroll med tydlig aktiv state.
- **Listtabellens visual polish:** Kolumnstruktur uppdaterad (checkbox/avatar/name/type/tags/email/phone), vit radbas, subtil hover, grå header utan linjer.
- **Border cleanup:** Tabellinnehåll gjort borderless i listvyn, i linje med topprutornas card-känsla.

### Contacts detail (`client/src/plugins/contacts/components/ContactView.tsx`)

- **Detailkort harmoniserade:** Kort använder nu explicit card-surface (`bg-white` + shadow) med samma visuella “lyft” som listans kort.
- **Interna rader i kort:** Time log och related items använder nu mjuk surface-bakgrund i stället för border-boxar för en mer borderless look.
- **Tidigare designleveranser i samma period:**
  - Header/subtitle-justeringar (Contact #, Updated, Type/Private-badge i panelheader).
  - Label/icon-finputs i Contact Content/Addresses/Contact Persons enligt guide.
  - Time log flyttad till sidebar och anpassad stil.
  - Previous/Next (`ItemNavigation`) stylad enligt `hb-pager`.

### Core UI-primitiver (root-cause fixes)

- **`client/src/components/ui/table.tsx`:**
  - Nytt API `rowBorders?: boolean` (default `true`) för strukturerad kontroll av tabellborders.
  - `TableHeader`, `TableBody`, `TableRow` läser gemensam context i stället för att kräva lokala override-hacks.
  - När `rowBorders={false}` nollas borders konsekvent på `thead/tbody/tr/th/td`.
- **`client/src/components/ui/card.tsx`:**
  - Central fix: `shadow-none` innebär nu även `border-0` (inte bara transparent bakgrund), vilket tar bort behov av återkommande lokala border-workarounds.
- **`client/src/core/ui/DetailPanel.tsx`:**
  - Borttagna descendant-regler som tidigare nollade `shadow-sm` i detail-content och gjorde att kort såg “platta” ut trots shadow-klasser.

### Sidebar / Topbar / shared UI i samma designspår

- **Sidebar:** Fullbredds-nav som “Estimates”, enhetliga hover/active-states, och konsekvent ikon/text-färgförhållande.
- **Topbar:** Timer-pill och vanlig klocka redesignade enligt guide.
- **DetailSection:** Subtle title-läge renderar titelikoner utan bakgrundsplatta.
- **DetailActivityLog:** Aktivitetkort redesignat mot guide (spacing, empty state, färger).

## 2026-04 – Säkerhetsgranskning, CSRF-klient, publika delningslänkar, lazy plugin-providers

**Sammanfattning:** Genomgång av säkerhetslager (CSRF, rate limits, upload/serving), enhetlig klient för muterande API-anrop, routing för **anonyma** publika task-/note-delningar utan session, samt frontend-förbättringar (lazy providers, listtypografi, Cupappen UTM).

### Klient: `apiFetch` och CSRF

- **`client/src/core/api/apiFetch.ts`:** Wrapper runt `fetch` som för **POST/PUT/PATCH/DELETE** hämtar CSRF-token via `GET /api/csrf-token`, skickar `X-CSRF-Token` och `credentials: 'include'`, samt vid 403 från CSRF kastar bort cachad token och försöker en gång till.
- **Invalidation:** `invalidateCsrfToken()` vid utloggning, inloggning, registrering och **tenant-byte** (`TopBar.tsx` m.fl.).
- **Anrop som går via `apiFetch`:** Bland annat plugin-API:er för tasks, notes, mail, ingest, files, invoices, estimates, slots, matches, cups, contacts, pulses; samt core (`bulkApi`, `activityLogApi`, `teamApi`) och utvalda vyer/widgets (`TaskView`, `NoteView`, `ContactView`, `MentionContent`, `MentionTextarea`, `TimeTrackingWidget`).

### Miljövariabler och dokumentation

- **`.env.example`:** `ENABLE_CSRF`, `FORCE_RATE_LIMIT`, `SESSION_SECRET`, CORS-URL:er (`CORS_ORIGIN`, `CORS_ORIGINS`) med korta kommentarer.
- **`server/core/README.md`:** Tabell över säkerhetsrelaterade variabler och notis om `npm audit` / beroenden.

### Rate limiting

- **`server/core/middleware/rateLimit.js`:** `enforceRateLimits` styr både generell limiter och **auth-limiter** när `FORCE_RATE_LIMIT=true` (så staging kan tvinga 429 utan att sätta `NODE_ENV=production`).

### Publika task- och note-delningar (ingen session)

- **Problem:** Middleware krävde inloggning för `GET /api/tasks/public/:token` och `GET /api/notes/public/:token`, vilket gav 401 för anonyma mottagare.
- **Lösning:** Migration **`069-public-share-routing.sql`** (`tasks_public_share_route`, `notes_public_share_route`), core-tjänst **`server/core/services/publicShareRouting.js`** (registrering per tenant, `ServiceManager.getMainPool()`), middleware i **`server/index.ts`** som före auth matchar dessa paths och sätter `req.tenantId` + `req.tenantPool`. Plugins registrerar routing i model init (`plugins/tasks/model.js`, `plugins/notes/model.js`).
- **Kör migration:** `npm run migrate:public-share-routing` (wrapper: `scripts/run-public-share-routing-migration.js`).

### Tester

- **`server/__tests__/security.test.js`:** Integrationstester för CSRF (GET tillåten, muterande utan token nekad), rate limit under `FORCE_RATE_LIMIT`, samt kontroll att publika share-URL:er kan svara utan session när routing och data finns.

### Publik Cupappen: UTM och JSON-LD

- **`public-cups/app.js`:** `withCupappenUtm()` sätter `utm_source=cupappen` på utlänkar (t.ex. anmälan); `renderJsonLd()` sätter **Event.url** till samma URL som kortets länk (`toAbsolutePublicUrl` + `withCupappenUtm`) så strukturerad data och klick spårar likadant.

### UI: listor och slots

- **`MatchList.tsx`, `SlotsList.tsx`:** Rubrik/kolumnstyling i linje med notes/tasks (`font-semibold text-base`).
- **`SlotsList.tsx`:** Rutnät visar **namn** och **plats** på två rader (`truncate` där det behövs).

### Frontend: lazy plugin-providers och registry

- **`client/src/core/pluginRegistry.ts`:** `providerLoader` – tunga providers laddas när plugin är aktivt (`client/src/core/app/PluginProviders.tsx`).
- **`client/src/hooks/useEnabledPlugins.ts`:** Härleder aktiva plugin-id från feature-flaggor och användarinställningar.
- **Context / Provider:** För contacts, cups, estimates, files, ingest, invoices, mail, matches, notes, pulses, slots, tasks: `*Context.tsx` (hook + typer) och `*Provider.tsx` (implementation) – minskar initial bundle när plugin är avstängt.
- **`client/src/types/pluginTypes.ts`:** Barrel för plugin-relaterade typer.
- **`vite.config.ts`:** `build.rollupOptions.output.manualChunks` delar ut **Provider**- och **plugin-UI**-moduler i separata chunks (namn `plugin-*-provider` / `plugin-*`) så lazy loading och cache fungerar förutsägbart.

### Övriga produktändringar (commits, april)

- **Tasks / notes / slots:** Delnings-URL:er i task-header; anteckning → uppgift-dialog; slots-header och listpolish; m.m. (`899b92c` och närstående).
- **Bundles / notes:** Publika delningslänkar och relaterad logik (`88962d4`).
- **Estimates:** UX-förbättringar (`5ab8eeb`).
- **Cups:** Föregående/nästa-cup via id, publikt kort med distrikt (`14bcfdf`); filter Östergötland + Futsal (`e7f71ad`).
- **Contacts:** `ContactView`-memoization och delade plugin-hooks (`2ab07d0`).

---

## 2026-04 – Cups: SvFF-import (`parseCupSource`), formulär och publik sajt

Sammanfattning av ändringar som bygger vidare på cups/ingest efter mars-dokumentationen, inklusive regional HTML-import, import-UX och `public-cups`.

### `plugins/cups/services/parseCupSource.js` – profiler och detektering

`detectCupSourceProfile` väljer parser utifrån HTML/PDF och i vissa fall **värdnamn** (URL). Typer (`CupSourceProfile`): `stockholm_pdf_table`, `labeled_plaintext_pdf`, `svff_yearmonth_list`, `angermanland_labeled`, `sodermanland_accordion`, `svff_table`, `svff_paragraph_list`, `smaland_label_list`, `skane_accordion`, `bohuslan_html_list`, samt PDF-varianter där det gäller.

- **`svff_table`:** HTML-tabell med kolumn **Cupnamn** (t.ex. Västerbotten, Västmanland).
- **`svff_paragraph_list`:** Uppland (_Arr. förening_), Jämtland-liknande (_Cuper YYYY_ i rubrik).
- **`sodermanland_accordion`:** Accordion med **h3**-titlar och sanktionsdatum i id.
- **`svff_yearmonth_list`:** Accordion per **år**, månadsrubriker (`<strong>Januari</strong>`) och `<ul>/<li>`-rader.
  - Triggas av texten **Lista över cuper med tillstånd** (tidigare Östergötland-variant), eller av **`ostergotland.svenskfotboll.se` + Sanktionerade cuper** + accordion (sidan `/tavling/sanktionerade-cuper/`).
  - **Futsal-rader** tas inte med i importen (`match_format === 'Futsal'` eller rad som slutar med `, Futsal`).
- **`angermanland_labeled`:** Etiketter _Tävling / Cup:_ i stycken.
- Övriga: Skåne-accordion, Småland (_Tävlingens namn:_), Bohuslän-Dalsland (_Fotbollscuper_), m.m.

### Östergötland-listor – tolkning av datum och namn

`parseOstergotlandListItem` / `parseOstergotlandDateRaw` / `parseSwedishSlashDateRange` har utökats för verkliga listrader: **komma saknas** mellan datum och cupnamn (t.ex. efter länk), **d/m – d/m** över månadsgräns, **flera datum** (`17 - 18/1, 24/1`), **`och`** mellan datum, **`<br>`** som avgränsare, **punkt före kategori** (t.ex. _MAIK-Cupen. F/P …_), kompakta former som **3-6/4**, **28/29/3** (två dagar samma månad).

### Cups admin / API (övrigt i samma period)

- **CupForm:** fält som hör till **ingest/import** (källa, körning m.m.) **bevaras** vid spara så de inte nollas av misstag.
- **Reimport:** manuell **plats** kan bevaras när cuper uppdateras från källa (justerat beteende i cups-flödet).
- **Publik konsumtion:** `public-cups/api/cups.php` läser endast **`visible`**-cuper (`COALESCE(c.visible, TRUE) = TRUE`); klienten i `public-cups/app.js` filtrerar också bort poster där `visible` är explicit falskt.

### `public-cups/` (statisk sajt + PHP-API)

- **API:** fetch mot **`public-cups/api/cups.php`**; standardbas-URL kan följa **aktuell origin** vid behov.
- **Drift:** `Dockerfile` för statisk sajt + PHP-API; dokumenterad i samma leverans.
- **SEO & spårning:** förbättrade sociala metadata/strukturerad data; **Google Tag Manager** (GTM-T9Z5HTC6); **footer-disclaimer** (formaterad copy).
- **UI:** kort använder **blå/grön** accent beroende på om cup har länk/plats; palett justerad mot tidigare utseende; **mobil/layout** (bl.a. `4ddb896`).
- **CSS (`public-cups/styles.css`):** `.cup-action` med flex/min/max så **långa cupnamn** inte spränger kortlayouten; `.cup-title`-radbrytning (~23ch); responsiva justeringar för smala vyer.

### Klient / dev (samma tidslinje)

- **Vite:** kompatibilitetsväg i `vite.config.mts` återställd där det behövdes (`5941928`).
- **Frontend:** styling-pipeline och mobil cups-UX i admin/publik riktning (`4ddb896`).

---

## 2026-04 – Files-plugin: inställningar och lista i linje med mail/contacts

- **Branch / release-line:** Pågående arbete under **`homebase-V3.5`** (spårar `origin/homebase-V3.5`). Tidigare agent-/pending-branch **`cursor/pending-changes-2161`** användes för isolerade ändringar innan merge/synk.

- **Files-inställningar (mail-liknande mönster):**
  - `CloudStorageSettings.tsx` – provider/credentials-layout som mail, OAuth-fält inline, ingen “key toggle”-överraskning.
  - `FileSettingsForm.tsx` / `FileSettingsView.tsx` – förenklad vy i linje med övriga settings-flöden.

- **Lista och detaljvy:**
  - `FileList.tsx` – egen header (sök, rutnät/lista, lägg till), `contentFlush`, ingen duplicerad `ContentHeader`.
  - `FileView.tsx` – kortstil och i18n som övriga detaljvyer.

- **App / primär åtgärd:**
  - `App.tsx` och `resolvePrimaryAction.ts` – files-sidans chrome och primär knapp matchar övriga plugins.

- **Översättningar:** Uppdaterade nycklar i `client/src/i18n/locales/en.json` och `sv.json` för nya/ändrade strängar i files-flödet.

### Files / notes (lagring och bilagor, samma release-spår)

- **Lagring:** fler **storage providers** och inställningsvägar i files-plugin (backend + klient).
- **Anteckningar:** **bilagor via files** – API (`client/src/plugins/files/api/filesApi.ts`), `FileAttachmentsSection.tsx`, samt `NoteForm.tsx` / `NoteView.tsx` för att knyta och visa bilagor.
- **Server:** motsvarande stöd i `plugins/files/controller.js` där det tillkommit.

## 2026-04 – Frontend bundle-analys (Vite)

- **`npm run build:ui:analyze`:** kör produktionsbuild med `ANALYZE=1` och skriver interaktiv treemap till `bundle-stats.html` i repo-roten (gitignoreras).
- **`vite.config.mts`:** `rollup-plugin-visualizer` aktiveras endast när `ANALYZE` är satt; vanlig `npm run build:ui` påverkas inte.
- **Dokumentation:** `docs/FRONTEND_BUNDLE_ANALYSIS.md`; länkar från `docs/README.md` och `docs/DEVELOPMENT_GUIDE_V2.md` (Performance → Frontend).

---

## 2026-03 – Cups/Cupappen (hel plugin-dokumentation, återinförd och utbyggd)

- **Cups återinförd efter tidigare teardown (end-to-end):**
  - Tenant-schema och modellflöde i `plugins/cups/model.js` uppdaterat för moderna cup-fält och importflöden.
  - Kopplingar mot ingest/hämtning förstärkta via `plugins/cups/services/parseCupSource.js`, `plugins/ingest/services/fetchSource.js` och `plugins/ingest/services/fetchSourceBrowserFetch.js`.
  - Serverkonfiguration justerad för publik cups-konsumtion i `server/index.ts` (inkl. CORS-relaterad drift för publik klient).

- **Datamodell och egenskaper i cups:**
  - Egenskaperna `visible`, `sanctioned` och `featured` används genom hela kedjan (DB -> backend -> API -> admin UI -> publik listning).
  - Bulk-hantering och visning i adminlistor/paneler uppdaterad i cups-flödet (`CupsList`, `CupForm`, `CupView`, `CupsContext`, `cupsApi`, typer).
  - Formvalidering/date-normalisering i `CupForm` förbättrad för att undvika låsta submit-lägen efter valideringsfel.

- **Migrationer och scripts för cups:**
  - Tenant-migrationer uppdaterade/utökade för cups, inklusive basmigration och senare schemaändringar i `server/migrations/058-cups-v1.sql` och dokumentation i `server/migrations/README.md`.
  - Nya migrationsscripts och npm-kommandon i `package.json` (cups-egenskaper och relaterade schemauppdateringar).

- **Admin-UI för cups (klientplugin):**
  - Komplett cups-plugin på klientsidan med uppdaterade typer/API/kontext:
    - `client/src/plugins/cups/types/cups.ts`
    - `client/src/plugins/cups/api/cupsApi.ts`
    - `client/src/plugins/cups/context/CupsContext.tsx`
    - `client/src/plugins/cups/components/CupForm.tsx`
    - `client/src/plugins/cups/components/CupView.tsx`
    - `client/src/plugins/cups/components/CupsList.tsx`
  - HTML entity-dekodning centraliserad i cups-API-lagret för renare text i adminvyer.

- **Public cups-app (`public-cups`) etablerad och produktionsanpassad:**
  - Statisk publik app för Cupappen med SEO/metadata, structured data, robots/sitemap/llms och svensk copy.
  - Utsortering på `visible`, sektion för `featured`, svensk filter-UX (datum/kategori/distrikt), custom dropdowns, mobil kollapsbar filterpanel och filter-breadcrumbs.
  - Förbättrad fritextsökning över fler fält samt normalisering/alias-hantering av kategorier.
  - HTML entities dekodas i publik rendering så text visas korrekt.

- **Mindre efterjusteringar dokumenterade i samma period:**
  - `plugins/pulses/routes.js` har nu CSRF på alla write-routes.
  - `public-cups/app.js` visar svenska kategorilabels i breadcrumbs (inte engelska nycklar).

---

## 2026-03 – Ingest-plugin (hel plugin-dokumentation)

- **Roll:** Delad **kapabilitet** – registrera externa källor, hämta innehåll, spara körhistorik; återanvändbar backend för andra plugins (samma mönster som mail-plugin i guide). Inte bara CRUD.

- **Backend (`plugins/ingest/`):**
  - `plugin.config.js` – `routeBase: /api/ingest`, beskrivning av syfte.
  - `index.js` – plugin-init, exponerar router + config.
  - `controller.js` / `model.js` – källor, runs, validering och tenant-scope.
  - `routes.js` – REST för list/skapande/uppdatering/körning; **CSRF på muterande rutter** (samma säkerhetsmönster som övriga plugins).

- **Delat servicelager (återanvändning från andra plugins):**
  - `services/ingestService.js` – `runSourceById`, `fetchSourceFromRecord`, `getLatestSourceContent`, samt re-export av `fetchSource` / `fetchSourceFromUrl` / `runIngest`.
  - `services/fetchSource.js` – central hämtning (URL, `sourceType`, `fetchMethod`).
  - `services/fetchSourceBrowserFetch.js` – browser-fetch-väg där det behövs.
  - `services/runIngest.js` – full körning (motsvarar manuell run från UI/API).
  - `services/pdfTextFromBuffer.js` – extraherad PDF-text för ingest/parser-flöden.
  - `services/browserFetchStartupDiagnostics.js` – diagnostik kring browser-fetch.

- **Databas och åtkomst:**
  - Tenant: `054-ingest-sources-and-runs.sql` (`ingest_sources`, `ingest_runs`).
  - Huvud-DB: `055-grant-ingest-plugin-access.sql` – plugin-rättigheter; kör `npm run migrate:ingest-plugin-access`.
  - Uppföljning: `056-ingest-runs-updated-at-and-rss-cleanup.sql` (`updated_at` på runs, legacy `rss` → `other`).
  - Se `server/migrations/README.md` § **054 / 055 / 056 – Ingest-plugin**.

- **Frontend (klientplugin):**
  - `IngestSourceList`, `IngestSourceForm`, `IngestSourceView` med `IngestContext` – källor, manuell körning, körhistorik med utdrag; kontext/hooks i linje med övriga list-plugins (selection, refresh).

- **Koppling till cups:** Cups-import/parser (`plugins/cups/services/parseCupSource.js`) bygger på samma hämtningsstack som ingest där det är relevant; ingest förblir **generisk** (inga domänmodeller som `cups` i ingest-kärnan).

---

## 2026-03 – Övriga småfix och dev-stabilitet (från commits)

Sammanfattning av mindre ändringar som inte har egen stor sektion ovan men finns i git-historiken:

- **Dev / port-kollision:** Vite använder `strictPort` på **3001** så klienten inte kan “ta” API-port **3002** av misstag (`fix(dev): vite strictPort 3001…`).

- **Server / miljö:** Laddning av `.env` / `.env.local` från **projektroten** för konsekvent konfiguration (`fix(server): load .env/.env.local from project root`).

- **Puppeteer / browser_fetch (ingest):**
  - Cache pin till `.cache/puppeteer`, Chrome-installationsscript, ignorerar sandbox-injicerad `PUPPETEER_CACHE_DIR` där det stör.
  - `.env.example` dokumenterar sandbox-override för Puppeteer-cache.
  - Valbar **startup-diagnostik** för `browser_fetch` när det är aktiverat.
  - Förbättrad **HTML-parsning** och diagnostik vid browser-hämtning.
  - UI: fel vid “Latest fetch” visas som röd varning där det ska, utan att feltext färgas fel i infosidopanelen.

- **Klient:** `App.tsx`-orkestrering utbruten till **core helpers** (lättare att läsa och testa; `refactor(client): extract App.tsx orchestration…`).

- **Notes:** Snabbåtgärder **To Task** och **Delete** i notes-flödet (`feat(notes): To Task and Delete quick action`).

---

## 2026-03 – Pulses CSRF-hardening + svensk kategori-label i public cups

- **Pulses write-routes säkrade med CSRF (mönster-alignment mot mail):**
  - `plugins/pulses/routes.js` importerar nu `csrfProtection` från `server/core/middleware/csrf`.
  - CSRF middleware tillagd på samtliga muterande endpoints:
    - `POST /api/pulses/send`
    - `POST /api/pulses/test`
    - `POST /api/pulses/settings`
    - `POST /api/pulses/history/delete`
  - Läsrutter (`GET /history`, `GET /settings`) är oförändrade.
  - Ingen ändring i provider-logik, adapterval eller frontend-API-kontrakt.

- **Public cups: breadcrumbs-kategorier visas nu på svenska:**
  - `public-cups/app.js`: breadcrumbtext använder `getCategoryLabel(selectedCategory)` i stället för rått filtervärde.
  - Åtgärdar att engelska nycklar (`women`, `men`, `girls`, `boys`) kunde visas i UI.
  - Resultat: svenska labels i breadcrumbs (`Damer`, `Herrar`, `Flickor`, `Pojkar`, `Flickor och Pojkar`).

---

## 2026-03 – Cups-plugin borttaget, aktivitetslogg i vy, DB-teardown

- **Cups borttaget (hela stacken):** Klient (`client/src/plugins/cups`), backend (`plugins/cups`), registrering i `pluginRegistry.ts`, `App.tsx`, `routeMap.ts`, `Sidebar` (`NavPage`), `DetailSection` (`iconPlugin`), i18n, temavariabler (`index.css`), `cheerio`-beroende och cups-specifika npm-scripts under `scripts/`.
- **Databas:** `052-drop-cups-tables.sql` tar bort tabellerna `cups` och `cup_sources` på tenant-/data-DB. `053-remove-cups-plugin-access.sql` (markerad `MAIN_DB_ONLY`) tar bort `plugin_name = 'cups'` från `user_plugin_access` / `tenant_plugin_access` på huvuddatabasen; kör via `npm run migrate:remove-cups-plugin-access` mot rätt `DATABASE_URL`.
- **Aktivitet i detaljvy:** `DetailActivityLog` i sidopanelen för **vy-läge** i `ContactView`, `TaskView` och `NoteView` (samma mönster som slots/matcher). Nycklar `contacts.activity` och `tasks.activity` i `en.json` / `sv.json`.
- **Polyfill-kommentar:** `server/core/polyfills/nodeWebGlobals.js` beskriver generellt undici/`File` på Node 18 (inte cups-specifikt).
- **lint-staged:** ESLint anropas med `--no-warn-ignored` så ignorerade filer (t.ex. vissa `.d.ts`) inte failar pre-commit med varningar.

---

## 2026-03 – Matches streamline: optional format, dialogs och duplikering

- **Format frivilligt (end-to-end):**
  - Frontend-validering i matches kräver inte längre `format`.
  - Backend-validering och modell accepterar tomt `format`.
  - Ny migration `044-matches-format-nullable.sql` + script `run-matches-format-nullable-migration.js` för tenant-synk.
- **UX och copy i matches:**
  - `dateTimePlaceholder` i matches uppdaterad från "Set date & time" / "Välj datum och tid" till "Date & time" / "Datum och tid".
  - Browser `alert()` i matches ersatta med appens dialogmönster (`ConfirmDialog`) för enhetlig prompt-stil.
  - Ta bort kontakt i match-vy kräver nu bekräftelse-dialog.
- **Duplikering av match:**
  - Duplicate-dialogen skriver nu namn till `name` (inte `location`).
  - Default för dubblett använder matchnamn/fallback och kopierar övriga fält korrekt.
- **Cleanup:**
  - Död kod borttagen i matches (`formatDateOnly`/`formatTimeOnly`, oanvänd CSRF-metod i matchesApi, oanvänd `pendingCloseRef`, oanvänd prop i MatchForm).
  - Minutes-fältets placeholder `90` borttagen.

---

## 2026-03 – Footer-refaktorering: window-bridges borttagna, inline Save/Cancel

- **Slots export:** `SlotsContext` exponerar nu `exportFormats`/`onExportItem`; `SlotView` har en `SlotExportOptionsCard` i sidopanelen (samma mönster som notes/tasks/contacts).
- **PanelFooter förenklad:**
  - `if (currentMode === 'view')` blocket borttaget — QuickActionsCard/ExportOptionsCard i sidebar hanterar view-actions.
  - Edit/create Save/Cancel-blocket borttaget — formulären hanterar det inline.
  - `PanelFooter` renderar nu bara knappar för `settings`-läge.
- **Inline Save/Cancel i alla 8 formulär:** `SlotForm`, `NoteForm`, `TaskForm`, `ContactForm`, `EstimateForm`, `InvoicesForm`, `MatchForm`, `FileForm` har nu egna Save/Cancel-knappar. Inga window-globals registreras längre i create/edit-formulär.
- **window-bridge cleanup:** `window.submitXxxForm` / `window.cancelXxxForm` borttagna ur alla create/edit-formulär och deras contexts. `global.d.ts` uppdaterad — window-globals deklareras bara för `*SettingsForm`-komponenter (settings-läge).
- **Dokumentation:** `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12 (nytt), `PLUGIN_DEVELOPMENT_STANDARDS_V2.md`, `LESSONS_LEARNED.md` uppdaterade med nya kontrakt.

---

## 2026-03 – Plugin cleanup + auth rate-limit stabilisering

- **Systematisk cleanup i plugins (`contacts`, `notes`, `tasks`, `slots`):**
  - Legacy/workaround-kod borttagen, inklusive död CSRF-klientkod i plugin-API-lager.
  - Redundant kommentering och `console.log`-debugrester rensade.
  - Gemensamma UI-mönster harmoniserade med återanvändbara konstanter för bättre läsbarhet och konsekvens.
- **Kontext- och felhantering:**
  - Flera `alert()`-flöden ersatta med validerings-/state-baserad felhantering för en enhetlig UX.
  - Oanvänd/dead code-paths i context/list/view/form-filer borttagna för mindre komplexitet.
- **Stabilisering av inloggning i dev:**
  - `server/core/middleware/rateLimit.js` uppdaterad så auth/health-endpoints korrekt exkluderas från global limiter även när `/api`-prefix är strip:at av middleware-mount.
  - Resultat: `/api/auth/login` throttle:as inte felaktigt i lokal utveckling.

---

## 2026-03 – Tasks/Slots alignment: properties, mentions, multi-assignee, date/time pickers

- **Tasks detail/edit alignment mot slots/notes:**
  - Properties flyttade till huvudkolumn under content (view), med samma typografi- och kontrollskala som slots (`text-sm` labels, `h-9` controls, `text-xs` control text).
  - `mentioned contacts` i tasks justerade till samma designmönster som notes (radstruktur, ikon-only open action, spacing).
- **Tasks assignees: single -> multi (end-to-end):**
  - Ny migration `039-tasks-add-assigned-to-ids.sql`.
  - Backend (`plugins/tasks/model.js`, `plugins/tasks/routes.js`) stöd för `assigned_to_ids` med bakåtkompatibel fallback till `assigned_to`.
  - Frontend (`types`, `api`, `context`, `TaskForm`, `TaskView`, `TaskList`, export-config) uppdaterat för flera ansvariga.
  - Search/header/export visar nu flera assignees korrekt.
- **Slots date/time picker harmonisering:**
  - Datumfält i `SlotForm` bytta till popover-baserad datepicker (DayPicker).
  - Tidsfält uppdaterade till visuellt matchande popover-trigger/UI mot datepicker.
- **Dokumentationsuppdatering:**
  - `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`, `PLUGIN_DEVELOPMENT_STANDARDS_V2.md`, `UI_AND_UX_STANDARDS_V3.md`, `LESSONS_LEARNED.md` utökade med bindande refactor-kontrakt (funktion + stil).

---

## 2026-03 – Plugin design-checklista: view/edit + hooks

- **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`:** Utökad sektion **E (Form)** med instruktioner för kortordning, egenskaper- och kontakter-kort i linje med slots view. Ny sektion **I** (hooks, vit sida, side-by-side-jämförelse, i18n). **H** kompletterad med tips om edit-läge efter form-ändringar.

---

## 2026-03 – Plugin design-checklista (docs)

- **Ny fil:** `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` – återanvändbar checklista (A–H) för att aligna list/settings/detail/App med slots/notes-mönster.
- **Index:** `docs/README.md` länkar checklistan under snabbstart och canonical-dokument.

---

## 2026-03 – Slots categories, header actions och unsaved-close harmonisering

_Slots har utökats med kategorier/taggar end-to-end, detail-panelens actions har flyttats till headern, och close/unsaved-flöden har harmoniserats mellan header och footer._

### Slots: kategori/taggar (end-to-end)

- **Databas:** Ny migration `039-slots-add-category.sql` lägger till `slots.category`.
- **Migreringsscript:** `scripts/run-slots-category-migration.js` + npm-script `migrate:slots-category` för att köra migrationen på befintliga tenants.
- **Backend:** `plugins/slots/model.js` och `plugins/slots/routes.js` stöder `category` i create/update/batch + change summary och validering.
- **Frontend data:** `types/slots.ts` + `slotsApi.ts` uppdaterade för `category`.
- **Settings:** Slots settings har nu kategorihantering (lägga till/ta bort) enligt samma mönster som contact tags.
- **Form/View/List:** SlotForm kan välja kategori, SlotView visar kategori i detail, och SlotsList visar kategori-badge i grid/list.

### Detail-panel actions (header-first)

- **Header i view-läge:** `ItemNavigation` + `Edit/Update` + `Close` ligger i headern; `Update` visas när quick-edit/tags ändrats och `Edit` döljs då.
- **Header i edit-läge:** `Close` + `Update` visas i headern.
- **Footer i view-läge:** `Close/Edit/Update` borttagna från footer för att undvika dubbel-UI; kvar är vänstersidans actions (Delete/Duplicate/Send/Export).
- **Close-beteende:** Header-close använder samma guardade close som footer (inkl. plugin-specifik `getCloseHandler` där tillgängligt), så osparade ändringar hanteras konsekvent.

### Slots UX/cleanup

- **Inline location-edit i view borttagen:** Location kan nu endast ändras i edit-läge.
- **Quick actions i slots:** Edit/Update borttagna därifrån; färgsättning/hover och knappbredd harmoniserade med sidebar-stilen.
- **Kodstädning:** Oanvänd kod/imports i slots-filer borttagna och formatering/lint justerad.

---

## 2026-03 – Slots: plugin cleanup, trekolumns-detail och per-item activity log

_Slots-plugin refaktorering enligt plan: borttagen död kod, centraliserade konstanter, mindre duplicering, utbrutna subkomponenter och dedikerad settings-hook. Detail-vyn får tre kolumner (Info | Properties | Activity) med per-slot activity timeline._

### Slots plugin cleanup

- **Dead code:** Borttaget `csrfToken`/`getCsrfToken`/`getSlot` från slotsApi; `position`/`length` från SlotMention; `setPanelMode` från SlotsContext; `_openSlotPanel`/`_deleteSlot` och shadowing av `selectedSlots` i SlotsList.
- **Konstanter:** `SLOTS_SETTINGS_KEY` och `SlotsViewMode` centraliserade i `types/slots.ts`; tre duplicerade deklarationer borttagna i SlotsList, SlotsSettingsForm, SlotsSettingsView.
- **Felhantering:** Helper `extractErrorMsg` i SlotsContext, fem duplicerade felmönster ersatta.
- **canSendMessages/canSendEmail:** Exponeras från context; duplicat i SlotsList borttaget.
- **slotContactUtils:** `resolveSlotsToContacts` och `resolveSlotsToEmailContacts` slagna ihop till generisk `resolveSlotMentionsToRecipients`; befintliga anrop oförändrade.
- **hooks/useSlots.ts:** Borttagen; SlotsList och SlotForm använder `useSlotsContext` direkt; pluginRegistry behåller alias.
- **SlotView:** `displaySlot` (useMemo) och `hasMatch` tillagda; upprepade draft/null-uttryck ersatta. Subkomponenter utbrutna: SlotPropertiesCard, SlotInfoCard, SlotBookingsCard (samma fil eller egna).
- **useSlotSettings:** Ny hook `hooks/useSlotSettings.ts`; SlotsSettingsForm och SlotsSettingsView använder den, mindre duplicering.

### Trekolumns detail och activity log

- **DetailLayout:** Ny optional prop `rightSidebar`; vid tre kolumner grid t.ex. `grid-cols-[1fr_280px_280px]` (main | sidebar | rightSidebar). Utan prop oförändrat tvåkolumnslayout.
- **SlotView:** Kolumn 1 = info-kort (slot number, location, match, time, capacity, visible, notifications). Kolumn 2 = properties + information + Public Bookings. Kolumn 3 = per-slot activity timeline.
- **Activity log backend:** ActivityLogService.getActivityLogs tar optional `entityId`; WHERE-filtrering på entity_id. Settings-controller skickar `entity_id`/`entity_type` från query till getActivityLogs.
- **activityLogApi:** Parametrar `entityId` och `entityType` tillagda; anrop med entity-filter för per-item loggar.
- **DetailActivityLog:** Ny komponent `client/src/core/ui/DetailActivityLog.tsx` – tar `entityType` och `entityId`, hämtar activity logs och visar kompakt timeline. Återanvändbar för andra plugins.

### Övriga ändringar (samma commit)

- **RichText:** Nya komponenter `RichTextContent.tsx` och `RichTextEditor.tsx` (notes/tasks eller annat innehåll).
- **BulkPropertiesDialog:** Ny komponent i slots för bulk-åtgärder på valda slots.
- **Notes/Tasks:** Uppdateringar i NoteForm, NoteList, NoteView, TaskForm, TaskList, TaskView (t.ex. rich text eller småfix).
- **Core:** AppContext, BulkEmailDialog, BulkMessageDialog, DetailSection, LoginComponent, index.css – diverse justeringar.
- **Backend:** validation, settings controller/model, slots controller/model, notes/tasks routes, ActivityLogService, PostgreSQLAdapter – småfix och stöd för entityId.

---

## 2026-02 – URL-routing (react-router-dom), sid- och item-URL:er, UI-komponenter utan direkt styling

_Refaktorering: navigation drivs av URL. Varje sida och varje öppet item får egen URL. Back-knapp, deep links och bokmärken fungerar. Samtidigt krävs att sidor och rate-komponenter använder UI-komponenter (Button, Input, Card, Table osv.) och ingen direkt/custom styling (inga inline `style={{}}`, inga råa `<button>`/`<input>` där det finns komponent)._

### React Router och URL-schema

- **react-router-dom (v6):** Tillagt i `package.json`. `main.tsx` wrappar `<App />` i `<BrowserRouter>`.
- **URL-schema:**
  - Sidor: `/` (dashboard), `/contacts`, `/notes`, `/tasks`, `/matches`, `/slots`, `/estimates`, `/invoices`, `/invoices/recurring`, `/invoices/payments`, `/invoices/reports`, `/files`, `/mail`, `/pulses`, `/settings`.
  - Item-paneler (deep link): `/contacts/:id`, `/notes/:id`, `/tasks/:id` osv. Öppnar rätt panel vid direktlänk eller back.
- **Route-map:** Ny fil `client/src/core/routing/routeMap.ts`: `navPageToPath`, `pathToNavPage(pathname)`, `itemPath(page, id)`. Invoices-subrutter (`recurring`, `payments`, `reports`) hanteras explicit så att de inte kolliderar med `/invoices/:id`.

### App.tsx – URL som enda källa för "nuvarande sida"

- **currentPage:** Ingen längre `useState` + localStorage. Härleds från URL med `useLocation()` och `pathToNavPage(location.pathname)`.
- **handlePageChange:** Anropar `navigate(navPageToPath[page])` och vid behov `closeOtherPanels()`. Skyddas fortfarande av `attemptNavigation` (osparade ändringar).
- **URL → panel-sync (useEffect):** Vid ändrad pathname: om URL har plugin + id öppnas motsvarande item-panel (`openXForView(item)`); om URL saknar id stängs panelen (`closeXPanel`). Ger back/forward-stöd.
- **Routes:** `<Routes>` i App: `<Route path="/public/estimate/:token" element={<PublicEstimateRoute />} />` och `<Route path="/*" element={...providers + AppContent />}`. Publika sidor utan auth/providers.
- **Cross-plugin:** "Create task from note" och "Create slot from match" anropar `navigate('/tasks')` respektive `navigate('/slots')` i stället för `setCurrentPage`.

### Publik route (estimate)

- **PublicRouteHandler:** Förenklad till ren passthrough. `/public/estimate/:token` hanteras av react-router i App.tsx; `PublicEstimateRoute` läser `:token` med `useParams()` och renderar `PublicEstimateView`.

### MainLayout, Sidebar, TopBar

- **NavPage:** Typen i `Sidebar.tsx` utökad med `'mail'` och `'pulses'`.
- **Sidebar/TopBar:** Fortfarande `currentPage` och `onPageChange` som props (currentPage kommer från App som pathToNavPage(location)). Inga NavLink-ändringar i Sidebar – klick går genom samma guard som tidigare.

### RegularRateDetailPage & RegularRateListPage

- **Detail:** SectionCard bytt till `Card`/`CardHeader`/`CardContent`. SegmentedControl- och booking type-knappar bytta till `Button` (variant ghost/outline). Alla `style={{ fontWeight: 500 }}` ersatta med `font-medium`; `minHeight: 52px` med `min-h-[52px]`. Select behåller native `<select>` med design-tokens (focus-visible:ring).
- **List:** Sökfältet använder `Input`; alla filter/refresh/clear/expand-knappar använder `Button`. Status-pills, export-trigger och bulk "Clear" är `Button`. Tabellwrapper är `Card`. Pagination bytt till komponenten `TablePagination`. Inga inline styles; `font-medium` och Tailwind för transform/z-index/height på bulk-bar.

### useItemUrl och plugin-kontexter

- **useItemUrl(basePath):** Ny hook i `client/src/core/hooks/useItemUrl.ts`. Returnerar `navigateToItem(id)`, `navigateToBase()`, `isOnPluginPage()`. Navigerar endast när användaren redan är på plugin-sidan (undviker URL-pollution vid cross-plugin-paneler).
- **Plugin-kontexter (rate):** Alla tio rate-kontexter (Contact, Note, Task, Match, Slot, Estimate, Invoice, File, Mail, Pulse) kan använda useItemUrl för att uppdatera URL vid öppna/stäng panel. App.tsx URL-sync öppnar panel vid deep link när data finns.

### Rate-komponenter under `client/src/components/rate` – enbart UI-komponenter

- **InlineEditCell:** Rå `<button>` ersatt med `Button` (variant ghost) när cellen inte redigeras.
- **ErrorBanner:** `className` satt med `cn()` i stället för template literal.
- **RateListSkeleton:** Rå `<table>`/`<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` ersatta med `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`.
- **RateStatusBadge:** Rå `<button>` och inline `style={{ fontWeight: 500 }}` borttagna; använder `Button` och TweakCN-tokens (`bg-success/10`, `text-success`, `border-success/30` för aktiv; `bg-muted`, `text-muted-foreground` för inaktiv).
- **DistanceTierEditor:** Tabell bytt till UI `Table`-komponenter; native `<select>` kvar med samma design-tokens.
- **RegularRateForm:** Alla `style={{ fontWeight: 500 }}` på rubriker ersatta med `font-medium`.
- **PriceAdjustmentForm, RateDeleteGuard, ScheduleEditor:** Redan konsekventa (Input, Checkbox, Button, Table, Dialog, DatePicker).

### GlobalNavigationGuard

- **Oförändrad:** `attemptNavigation(action)` används fortfarande av App och Sidebar/MainLayout. Vid navigering (inkl. via `navigate()`) körs guard innan `closeOtherPanels` och `navigate(path)`. Ingen react-router blocker implementerad; befintlig dialog vid osparade ändringar behållen.

### Server och Vite

- **Ingen ändring:** Produktion har redan SPA-fallback (`app.get('*', ...)` → index.html). Vite hanterar dev. All routing är client-side.

---

## 2026-02 – Settings-design, Import under Settings, knappar, statusbadge, TopBar-widgets (sedan commit cfbb968)

_Dokumentation av alla ändringar sedan senaste commit ("Public booking app, slot bookings in admin, SlotView UX")._

### Enhetlig Settings-design (alla plugins)

- **Fullsidig inställningsvy:** Samma mönster som Notes/Contacts för alla plugins: flikar (View, Import, Tags osv.) + kort med innehåll + footer med Save endast vid ändringar. Close-knapp i headern.
- **Nya SettingsView-komponenter:** Varje plugin har nu en dedikerad fullsidig inställningsvy:
  - `ContactSettingsView`, `TaskSettingsView`, `SlotsSettingsView`, `MatchSettingsView`, `EstimateSettingsView`, `FileSettingsView`, `MailSettingsView`, `PulseSettingsView`, `NotesSettingsView` (redan fanns, anpassad).
- **Flikknappar i headern:** Flikarna (View, Import, Tags osv.) sätts via `setHeaderTrailing` i respektive SettingsView och i Core Settings (`SettingsList`), så att de visas på samma rad som sidrubriken – ingen separat flikrad i innehållet.
- **ContentView, List, App Close:** Tasks, Slots, Matches, Estimates, Files, Mail, Pulses (och Notes, Contacts) använder konsekvent contentView/list/settings-vy och App Close.

### Import under Settings (som Notes)

- **Notes:** Import fanns redan som flik under Notes-inställningar.
- **Contacts:** Import-knappen flyttad från list-headern till Settings. Ny flik "Import" i `ContactSettingsView` med beskrivning och knapp som öppnar ImportWizard (samma schema och `importContacts`). Import-knapp och ImportWizard borttagna från `ContactList`.
- **Tasks:** Samma – flik "Import" i `TaskSettingsView`, Import-knapp och ImportWizard borttagna från `TaskList`.
- **Övriga plugins:** Ingen CSV-import (ImportWizard) i övriga. **Matches** har FOGIS API-import i settings (`MatchSettingsView`); se changelog §2026-06 Teams/Requests/Schedule.

### Enhetlig knappdesign (list-header, detail-footer, settings)

- **Storlek:** Add-, Close- och alla ghost-knappar i list-header och list-footer: `h-9 text-xs px-3`. Samma storlek för flikknappar i settings (ghost, `h-9 text-xs px-3`).
- **List-header:** Alla knappar utom Add: ghost, ikon + text. Grid/List-knappar utan bakgrund när aktiv – endast textfärg (`text-primary`). Gäller Notes, Tasks, Slots, Matches, Estimates, Files, Contacts, Mail, Pulses.
- **ContentHeader & PanelFooter:** Close-knappen i samma storlek som Add (`h-9 text-xs px-3`). PanelFooter uppdaterad för konsekvent knappstorlek.
- **Sökfält:** `ContentToolbar` – sökfält med `h-9 text-xs`, bredd `sm:w-96`.

### Enhetlig "Settings"-etikett

- **i18n:** `common.settings` tillagd i `en.json` och `sv.json` ("Settings" / "Inställningar").
- **Listvyer:** Alla plugin-listvyer använder `t('common.settings')` för Settings-knappen i toolbaren. MatchList fick `useTranslation` för detta.

### Statusbadge Mail och Pulse bredvid rubriken

- **Layout:** Statusbadgen (Resend/SMTP, Twilio/Mock) visas bredvid sidrubriken ("Mail", "Pulse") i stället för i toolbaren.
- **Implementation:**
  - `ContentLayoutContext`: ny `setHeaderTitleSuffix(node)`; provider tar optional `onTitleSuffixChange`.
  - `MainLayout`: state `headerTitleSuffix`, rensas vid sidbyte; båda `ContentLayoutProvider`-blocken får `onTitleSuffixChange`; `ContentHeader` får prop `titleSuffix`.
  - `ContentHeader`: ny prop `titleSuffix` renderas efter `<h1>` (titeln); titelraden har `flex-wrap` för att badge ska få plats.
  - `MailList` och `PulseList`: anropar `setHeaderTitleSuffix(<Badge ...>)` när listvy är aktiv; badge borttagen från `rightActions`. Toolbaren behåller plugin-filter (där det finns), Settings och Refresh.

### Inloggning – tydligare felmeddelanden

- **API:** `login()` returnerar `{ success, error? }` så att servern kan skicka tillbaka ett felmeddelande.
- **LoginComponent:** Visar `result.error` för användaren när inloggning misslyckas, så att serverns felmeddelande syns i stället för endast generisk text.

### TopBar – Pomodoro och Time Tracker (ghost, endast färgad text)

- **Bakgrund borttagen:** Trigger-knappen och Start/Pause (Pomodoro) respektive Start/Stop (Time Tracker) har ingen bakgrund eller kant – samma design som knappar i list-header och list-footer.
- **Stil:** Ghost-knappar, `h-9 text-xs px-3`, endast färgad text (t.ex. röd/grön/blå för Pomodoro-session, grön för Start, orange för Pause/Stop; blå för Time Tracker). Hover enligt Button ghost-variant.
- **Pomodoro compact:** I "endast ikon"-läge visas bara Timer-ikonen (utan progress-bakgrund); med tidsvisning: ikon + tid i sessionfärg.
- **Avstånd:** Tätare mellan ikon och siffror: `gap-1` i trigger-knappen (Pomodoro och Time Tracker).

### Övriga justeringar

- **PreferencesSettingsForm / ActivityLogForm / ProfileSettingsForm / TeamSettingsForm:** Justeringar för konsekvent layout och knappar i Core Settings.
- **Switch-komponent:** Mindre stiländring vid behov för inställningsformulär.
- **App.tsx / kontexter:** Uppdateringar för contentView, Settings-vy och panelhantering för alla berörda plugins.
- **Docs:** Ytterligare konsolidering: `FRONTEND_PLUGIN_GUIDE_V2.md` och `BACKEND_PLUGIN_GUIDE_V2.md` borttagna efter att export-pattern flyttats till `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` och bulk-delete (FK hybrid) till `CORE_SERVICES_ARCHITECTURE.md`.

---

## 2026-02 – Pulse & Mail: UI/UX redesign, bulk delete, BulkActionBar placement

### Pulse & Mail Settings: Provider Cards

- **Provider-val med cards:** Ersatt provider dropdown/knappar med klickbara kort (Twilio/Mock för Pulse, Resend/SMTP för Mail). Varje kort visar:
  - Grön/röd statusindikator (configured/not configured)
  - Provider-namn och aktiv markering
- **Credentials-sektion:** Separerad `DetailSection` för credentials som bara visas när aktuell provider är vald.
- **Plugin sources (Pulse):** Ny sektion som visar vilka plugins som har skickat meddelanden via Pulse (badges).

### Pulse & Mail List: Status Badge

- **Dynamisk status-badge:** I `ContentToolbar` visas nu aktivt provider-namn ("Twilio", "Resend" etc.) med grön färg om konfigurerad, röd om inte.
- **Plugin-filter återställd (Pulse):** Dropdown för att filtrera på plugin-källa (contacts, tasks etc.) återställd bredvid sökfältet.

### Bulk Delete för Pulse & Mail

- **Frontend:**
  - `PulseContext` / `MailContext`: Nya state och funktioner för selection (`selectedIds`, `selectedCount`, `isSelected`, `toggleSelected`, `selectAll`, `clearSelection`, `deleteHistory`).
  - `PulseList` / `MailList`: Checkboxar per rad, "select all filtered", `BulkActionBar` med Delete-action, `BulkDeleteModal` för bekräftelse.
- **Backend:**
  - `plugins/pulses/model.js` / `plugins/mail/model.js`: Ny metod `deleteHistory(req, ids)`.
  - `plugins/pulses/controller.js` / `plugins/mail/controller.js`: Ny `deleteHistory` endpoint.
  - `plugins/pulses/routes.js` / `plugins/mail/routes.js`: `POST /history/delete` route med validering.
- **API:** `pulseApi.deleteHistory(ids)` / `mailApi.deleteHistory(ids)`.

### BulkActionBar Placement (UX Best Practice)

- **Ovanför listan:** `BulkActionBar` flyttad från under tabellen (inuti Card) till ovanför (utanför Card) i Pulse och Mail. Detta följer UX best practices:
  - Fitts' Law: Närmare checkboxar minskar musrörelse.
  - Proximity Principle: Aktioner nära relaterade kontroller.
  - Industry standard: Gmail, Outlook, Salesforce etc. placerar bulk actions ovanför.
  - Sticky toolbar pattern: Möjliggör synlighet vid scroll.

### Auth: Default tenant provider

- **TENANT_PROVIDER fallback:** Om `NEON_API_KEY` saknas används automatiskt `local` som tenant provider (förhindrar inloggningsproblem i lokal utveckling).

### i18n

- **Nya nycklar:** `pulses.credentials`, `pulses.pluginSources`, `pulses.pluginSourcesHint`, `pulses.noPluginSources`, `mail.credentials` (en/sv).

---

## 2026-02 – Lokal inloggning permanent fix; Bulk message & export

### Lokal inloggning (permanent fix)

- **TenantContextService:** I local-steg 4: om `createTenant` kastar (t.ex. migreringsfel) försöker vi ändå `getTenantConnection(userId)` så att befintligt schema används och inloggning lyckas.
- **AuthService:** När `getTenantContextByUserId` returnerar null och `TENANT_PROVIDER=local` används fallback: tenant-servicen anropas direkt (tenantExists → createTenant vid behov → getTenantConnection) och kontext byggs så att inloggning fungerar.
- **.env.example:** `TENANT_PROVIDER=local` tillagd med kommentar så att lokal utveckling får rätt inställning och inloggning fungerar efter setup-database.

### Bulk message & export

- **BulkMessageDialog:** Ny komponent i `client/src/core/ui/BulkMessageDialog.tsx` – modal för att skriva meddelande och skicka SMS till valda mottagare via Pulses (`pulseApi.send`). Visar antal mottagare, varning för de utan telefon, progress och resultat (X skickade / Y misslyckade).
- **Slots:** I SlotsList – bulk-actions "Skicka meddelande" (samlar unika kontakter från valda slots’ mentions via `resolveSlotsToContacts`) och "Export CSV" (valda slots till CSV). Ny util `client/src/plugins/slots/utils/slotContactUtils.ts`.
- **Contacts:** I ContactList – bulk-action "Skicka meddelande" (valda kontakter som mottagare). Export CSV/PDF fanns redan.
- **i18n:** Nya nycklar under `bulk.*` för send message (title, recipients, body, send, result).

---

## 2026-02 – Slots: UX, "To slot från match", Source Match, detail-redesign

### Informationsruta (sidopanel)

- **Samma layout som notes/tasks:** Informationsblocket i slot-sidopanelen använder samma typsnitt och radlayout som notes/tasks (ID med `formatDisplayNumber('slots', id)`, Created, Updated, `space-y-4 text-xs`, etiketter `text-muted-foreground`, värden `font-mono`/`font-medium`).
- **Endast metadata:** Innehållet begränsat till system-ID, Created, Updated och (när slot skapats från match) Source Match – ingen plats/tid/kapacitet/synlighet/notiser i informationsrutan (de finns i huvudinnehållet).

### "To slot från match"

- **Fix:** I `App.tsx` användes `slotsContext` utan att den sattes – nu sätts `slotsContext = slotsEntry?.context` så att `refreshSlots` och `setRecentlyDuplicatedSlotId` anropas efter skapande. "To slot från match" fungerar igen efter namnbyte kiosk → slots.
- **Match kopplas till slot:** Vid skapande av slot från match skickas `match_id` till API. Backend: migration `034-kiosk-slots-add-match-id.sql` (kolumn `match_id` på `slots`, FK till `matches(id)`), `plugins/slots/model.js` (create/transformRow inkl. `match_id`). Migreringsscript: `scripts/run-slots-match-id-migration.js`, körs med `npm run migrate:slots-match-id`.

### Source Match (som Tasks "Source Note")

- **Visning:** I slot-information visas raden "Source Match" med klickbar länk (hemmalag – bortalag) eller "Deleted Match" om matchen inte finns. Samma mönster som Tasks "Source Note".
- **Data:** Matchen hämtas först från `useMatches().matches`, annars via `matchesApi.getMatch(slot.match_id)`. Länktext endast hemmalag – bortalag (ingen plats).
- **AppContext/App:** Match-objektet till `openToSlotDialog` inkluderar `id`; vid create skickas `match_id: matchForSlot.id` till `slotsApi.createSlot`.

### Slot detail view – innehållsdesign

- **Tydligare och annorlunda:** Huvudinnehållet i slot-detail (main content) har större typsnitt och en rad per information för bättre läsbarhet.
- **Ordning:** Slot Nbr (t.ex. SLT-123) först som rubrik; sedan Match (länk om från match), Matchnummer (t.ex. MAT-5), Location, Capacity (med CapacityAssignedDots), Time, Visible, Notifications. Varje fält har liten uppercase-etikett ovanför och större värde (`text-base`).
- **i18n:** Nya nycklar `slots.slotNbr`, `slots.match`, `slots.matchNumber`, `slots.deletedMatch` (en/sv).

### Previous / Next i detail-vy

- **ItemNavigation:** Knappar för att gå till föregående/nästa objekt direkt från detail-vyn (utan att stänga panelen). Visas i panelens header när plugin kontexten har stöd för det och det finns fler än ett objekt.
- **Plugins som stöder prev/next:** Tasks, Notes, Contacts, Invoices, Estimates, Files. Varje kontext exponerar `navigateToPrevItem`, `navigateToNextItem`, `hasPrevItem`, `hasNextItem`, `currentItemIndex`, `totalItems`; `DetailLayout`/panel-renderer använder dessa för att visa `ItemNavigation` (t.ex. "2 / 14" med pil-upp/pil-ner).
- **Komponent:** `client/src/core/ui/ItemNavigation.tsx`.

### Övriga ändringar i samma commit

- **Tenant:** Local-fallback i `TenantContextService.getTenantContextByUserId()` så att inloggning fungerar för lokala användare utan tenant-rad (skapande av tenant-schema vid behov).
- **Pulses-plugin:** Nytt plugin (SMS), migration 033, script och frontend-stöd.
- **Mail m.m.:** Diverse uppdateringar i mail-plugin och konfiguration.

---

## 2026-02 – CORS och inloggning i production

- **Problem:** När frontend och API ligger på olika domäner (t.ex. Vercel + Railway) blockerade webbläsaren svar pga saknad `Access-Control-Allow-Origin`; inloggning/cookies fungerade inte.
- **Lösning:** I production används `process.env.FRONTEND_URL` som tillåten CORS-origin när den är satt (i stället för hårdkodat `origin: false`). Se `server/index.ts` och `docs/DEPLOYMENT_V2.md`.
- **Krav:** Sätt miljövariabeln **FRONTEND_URL** till frontendens URL (t.ex. `https://din-app.vercel.app`) på API-servern och starta om.

---

## 2026-02 – Slots-plugin

- **Nytt plugin:** Slots – slots med plats, tid, kapacitet (1–5), synlighet och notiser.
- **Backend:** `plugins/slots/` (model, controller, routes), migration `029-kiosk.sql`, tabell `slots` (historiskt `kiosk_slots`, omdöpt i migration 035).
- **Frontend:** `client/src/plugins/slots/` (SlotsList, SlotForm, SlotView, SlotsContext, slotsApi).
- **Koppling till Matches:** I match-detail kan användaren skapa slot från match via "To Slot" (AppContext `openToSlotDialog` / `registerOpenToSlotDialog`, SlotsContext registrerar action `create-slot-from-match`).

---

## 2026-02 – Matches-plugin och pluginSingular-refaktor

- **Matches-plugin:** Eget plugin (list/form/view, MatchContext, navigation under Main). Tidigare workarounds borttagna.
- **pluginSingular:** Core-lager för singular-entity-plugins (panelKey, currentItem, open/close/save/delete) så att plugins inte behöver duplicera samma logik. Matches (och andra) använder detta där det passar.

---

## 2026-02 – Estimates: quick-edit status, Share, view-footer

- **Quick-edit status:** Snabb redigering av estimate-status i view-läge; Update-knapp för att spara.
- **Share:** ShareDialog för att dela estimate (layout och flöde uppdaterade).
- **View-footer:** Tydligare footer-aktioner (Update, share/view) och städning av oanvända knappkomponenter.

---

## 2026-02 – Tenant users och RBAC

### Multi-user per tenant

- **Tenant-användare och roller**  
  Varje tenant kan ha flera användare med roller: **user**, **editor**, **admin**. Plugin-åtkomst är per tenant (delad). En användare tillhör exakt en tenant.
- **Main DB:** Nya tabeller `tenant_memberships` (tenant_id, user_id UNIQUE, role, status) och `tenant_plugin_access` (tenant_id, plugin_name). Kolumnen `owner_user_id` tillagd på `tenants`. Migration + backfill: `npm run migrate:tenant-memberships` (se `scripts/db/README.md`).
- **Session:** Nya fält `tenantId`, `tenantRole`, `tenantOwnerUserId`. `currentTenantUserId` sätts till ägaren så att alla medlemmar ser samma tenant-data (befintlig user_id-filter i tenant-DB).
- **Auth:** Login/signup och GET /me sätter tenant-context; plugins hämtas från tenant (tenant_plugin_access) med fallback till user_plugin_access. **Legacy:** inloggning fungerar även om migrationen inte körts (fallback till tenants WHERE user_id och user_plugin_access).
- **Plugin-åtkomst:** `requirePlugin()` använder tenant_plugin_access när session.tenantId finns; vid fel (t.ex. tabell saknas) fallback till user_plugin_access.
- **RBAC:** Ny middleware `requireTenantRole(['admin'|'editor'|'user'])` med rollhierarki; superuser bypass. Injicerad i PluginSDK som `context.middleware.requireTenantRole`. Context-hjälpare: `getTenantRole`, `hasTenantRoleAtLeast`.
- **Team-API:** GET/POST/PATCH/DELETE `/api/team/users` för att lista, lägga till, ändra roll och ta bort medlemmar (kräver tenant admin/editor där det gäller).
- **Activity log:** Loggning använder tenant-scope (currentTenantUserId) som user_id; metadata innehåller actor_user_id och actor_email.
- **Dokumentation:** Allt beskrivet i `docs/TENANT_USERS_AND_RBAC.md`.

---

## 2026-02 (efter 2026-01-27)

### Validation & formulär

- **Kontakter: valfria e-post och telefon**  
  E-post och telefon är inte obligatoriska. Backend validerar format endast när fält har ett värde.
  - `server/core/middleware/validation.js`: `email` och `phone` använder `.optional({ values: 'falsy' })` så att tom sträng, `null` och `undefined` inte triggar formatvalidering.
  - `plugins/contacts/routes.js`: använder dessa regler utan extra `.optional()`.

### Panel & scroll

- **Detail panel scroll i add-läge**  
  I add-läge (t.ex. ny kontakt) rullade panelen mer än nödvändigt.
  - `client/src/core/ui/DetailPanel.tsx`:
    - Scroll återställs till toppen när panelen öppnas eller titel ändras (via `requestAnimationFrame`).
    - `min-h-0` på flex-containern och scroll-div så att bara innehållsområdet scrollar, inte hela panelen.
  - Gäller både mobil (Sheet) och desktop.

### Discard changes i edit-läge (Contacts, Notes, Tasks)

- **Tillbaka till detail view vid "Discard changes"**  
  I edit-läge: Cancel → dialog "Vill du verkligen lämna?" → "Discard changes" ska stänga dialogen och gå tillbaka till detail view (inte stanna kvar i edit).
  - `ContactForm.tsx`, `NoteForm.tsx`, `TaskForm.tsx`: i `handleDiscardChanges` för edit-läge anropas `confirmDiscard()` och explicit `onCancel()` så att panelen växlar tillbaka till view.

### Tasks: quick-edit (status, priority, due date, assignee)

- **Quick-edit i task view**  
  I task detail view kan användaren ändra status, priority, due date och assignee. Ändringarna sparas inte förrän användaren klickar **Update**.
  - **TaskContext:**
    - `quickEditDraft` – lokal state för ändringar.
    - `setQuickEditField('status' | 'priority' | 'dueDate' | 'assignedTo', value)`.
    - `hasQuickEditChanges` – true när draft skiljer sig från sparad task.
    - `onApplyQuickEdit()` – bygger payload från task + draft, anropar `saveTask`, rensar draft.
    - Draft rensas vid panel-close och vid byte av task (view/edit).
  - **TaskView:** Status, priority, due date, assignee använder `displayTask` (task + draft) och uppdaterar bara draft (inga direkta save-anrop).
  - **PanelFooter (view mode, tasks):**
    - Knapp **Update** (grön) visas när `hasQuickEditChanges`.
    - Update placerad bredvid Edit (ordning: Close, Edit, Update).

- **Close med osparade quick-edit-ändringar**  
  Vid Close med osparade quick-edit-ändringar visas en bekräftelsedialog.
  - **TaskContext:**
    - `getCloseHandler(defaultClose)` returnerar en funktion som vid `hasQuickEditChanges` öppnar dialogen och sparar `defaultClose`; annars anropas `defaultClose` direkt.
    - `onDiscardQuickEditAndClose()` rensar draft och stänger dialogen; anropar **inte** panel-close (användaren stannar i detail view).
  - **createPanelFooter:** För tasks används `currentPluginContext.getCloseHandler(baseClose)` som Close-handler.
  - **TaskView:** `ConfirmDialog` med "Unsaved changes" – "Discard changes" / "Continue editing".

### UI: gröna Update-knappar

- **Update-knappen grön**
  - Tasks quick-edit **Update** i panel footer: `bg-green-600 hover:bg-green-700 text-white border-none`.
  - Form footer **Save/Update** (Contacts, Notes, Tasks m.fl.): samma gröna styling så att både "Save" och "Update" är gröna i alla plugins.

---

**Senast uppdaterad:** 2026-07-07
