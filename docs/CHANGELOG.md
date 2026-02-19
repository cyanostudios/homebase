# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner.

---

## 2026-02 – Homebase 3.1.5 (snapshot before migrating from 3.X)

### Orders sync – inga felmeddelanden och fix för fastnad lock

- **Pool error handlers**
  - Lagt till `pool.on('error', ...)` på huvudpoolen och `sessionPool` i server/index.ts. Vid tillfälliga DB-avbrott (t.ex. Neon timeout) kraschar inte servern längre; felaktiga connections tas bort och poolen fortsätter fungera.
  - Samma error-hantering för tenant-pools i [server/core/services/connection-pool/providers/PostgresPoolProvider.js](server/core/services/connection-pool/providers/PostgresPoolProvider.js).
- **Frontend**
  - Sync-status-pollningen ignorerar fel vid tillfälliga DB/network-avbrott; användaren ser inga felmeddelanden.
- **Stale lock-fix (Orders-synken hängde sig)**
  - Om en sync kraschade (t.ex. serveromstart) sparades aldrig `running_since = NULL`; backend trodde att sync redan körde och returnerade `{ started: false, reason: "locked" }`, så ingen ny sync kunde starta och laddningsindikatorn visades aldrig.
  - Lagt till `STALE_RUNNING_MINUTES = 15`: om `running_since` är äldre än 15 minuter betraktas den som föråldrad (kraschad sync) och ignoreras.
  - `isBusyForUser`: räknar nu bara som "upptagen" om `running_since` är nyare än 15 minuter.
  - `trySetRunning`: kan nu ta över en slot när `running_since` är NULL eller äldre än 15 minuter.
  - Fil: [plugins/orders/orderSyncState.js](plugins/orders/orderSyncState.js).

### Session-stabilitet och städning

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
