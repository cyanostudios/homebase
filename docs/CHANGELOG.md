# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner.

---

## 2026-02 – Homebase 3.1.5 (snapshot before migrating from 3.X)

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
