# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner sedan senaste dokumenteringen.

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
- **Slots:** I KioskList – bulk-actions "Skicka meddelande" (samlar unika kontakter från valda slots’ mentions via `resolveSlotsToContacts`) och "Export CSV" (valda slots till CSV). Ny util `client/src/plugins/kiosk/utils/slotContactUtils.ts`.
- **Contacts:** I ContactList – bulk-action "Skicka meddelande" (valda kontakter som mottagare). Export CSV/PDF fanns redan.
- **i18n:** Nya nycklar under `bulk.*` för send message (title, recipients, body, send, result).

---

## 2026-02 – Slots: UX, "To slot från match", Source Match, detail-redesign

### Informationsruta (sidopanel)

- **Samma layout som notes/tasks:** Informationsblocket i slot-sidopanelen använder samma typsnitt och radlayout som notes/tasks (ID med `formatDisplayNumber('slots', id)`, Created, Updated, `space-y-4 text-xs`, etiketter `text-muted-foreground`, värden `font-mono`/`font-medium`).
- **Endast metadata:** Innehållet begränsat till system-ID, Created, Updated och (när slot skapats från match) Source Match – ingen plats/tid/kapacitet/synlighet/notiser i informationsrutan (de finns i huvudinnehållet).

### "To slot från match"

- **Fix:** I `App.tsx` användes `slotsContext` utan att den sattes – nu sätts `slotsContext = slotsEntry?.context` så att `refreshSlots` och `setRecentlyDuplicatedSlotId` anropas efter skapande. "To slot från match" fungerar igen efter namnbyte kiosk → slots.
- **Match kopplas till slot:** Vid skapande av slot från match skickas `match_id` till API. Backend: migration `034-kiosk-slots-add-match-id.sql` (kolumn `match_id` på `kiosk_slots`, FK till `matches(id)`), `plugins/slots/model.js` (create/transformRow inkl. `match_id`). Migreringsscript: `scripts/run-kiosk-slots-match-id-migration.js`, körs med `npm run migrate:kiosk-slots-match-id`.

### Source Match (som Tasks "Source Note")

- **Visning:** I slot-information visas raden "Source Match" med klickbar länk (hemmalag – bortalag) eller "Deleted Match" om matchen inte finns. Samma mönster som Tasks "Source Note".
- **Data:** Matchen hämtas först från `useMatches().matches`, annars via `matchesApi.getMatch(slot.match_id)`. Länktext endast hemmalag – bortalag (ingen plats).
- **AppContext/App:** Match-objektet till `openToSlotDialog` inkluderar `id`; vid create skickas `match_id: matchForSlot.id` till `kioskApi.createSlot`.

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

## 2026-02 – Kiosk-plugin

- **Nytt plugin:** Kiosk – slots med plats, tid, kapacitet (1–5), synlighet och notiser.
- **Backend:** `plugins/kiosk/` (model, controller, routes), migration `029-kiosk.sql`, tabell `kiosk_slots`.
- **Frontend:** `client/src/plugins/kiosk/` (KioskList, KioskForm, KioskView, KioskContext, kioskApi).
- **Koppling till Matches:** I match-detail kan användaren skapa slot från match via "To Kiosk" (AppContext `openToSlotDialog` / `registerOpenToSlotDialog`, KioskContext registrerar action `create-slot-from-match`).

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

**Senast uppdaterad:** 2026-02-10
