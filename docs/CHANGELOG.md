# Changelog

Kronologisk översikt över beteendeförändringar och nya funktioner sedan senaste dokumenteringen.

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

**Senast uppdaterad:** 2026-02-13
