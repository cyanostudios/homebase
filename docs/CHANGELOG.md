# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner sedan senaste dokumenteringen.

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
- **Övriga plugins:** Ingen CSV-import (ImportWizard) i övriga; Matches har endast "Import from API (coming soon)" i settings.

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

**Senast uppdaterad:** 2026-03-20
