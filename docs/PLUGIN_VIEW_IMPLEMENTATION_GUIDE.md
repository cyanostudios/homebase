# Plugin View Implementation Guide

**Status:** **Obligatorisk** vid ny plugin, list/view/form-implementation och design-alignment av befintliga CRUD-plugins. Läs hela guiden **innan** du skriver List / QuickContext / View / Form. Skippa inte sektioner.

**Purpose:** Complete checklist for implementing list quick-context, full detail view, view/edit layout sync, headers/buttons, and default confirm dialogs when building or aligning a plugin.

**Canonical references (copy, do not invent):**

| Area                        | Primary reference                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List header (canonical)** | `client/src/plugins/contacts/components/ContactList.tsx` — Select/Clear, `BulkActionRoundBar`, `RoundExpandableSearch`                                                                                                                             |
| Quick context (mail-layout) | `client/src/plugins/contacts/components/ContactQuickContextPanel.tsx` — full-only header card in `*View`                                                                                                                                           |
| Full QC with domain facts   | `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx` — used from `GarmentView`, not a list aside                                                                                                                                |
| List wiring (mail-layout)   | `client/src/plugins/contacts/components/ContactList.tsx` (also Cups / Slots for table chrome)                                                                                                                                                      |
| **Full detail (canonical)** | `client/src/plugins/contacts/components/ContactView.tsx` — 2-col layout, header menus, always-visible Addresses + Contact Persons (empty states), no system Information card; **Activity** as last URL tab (`?tab=activity`) + `DetailActivityLog` |
| Activity log (shared)       | `client/src/core/ui/DetailActivityLog.tsx` — last detail tab when the view has tab chips; otherwise a stack card (e.g. `SlotView.tsx`)                                                                                                             |
| Detail header menus         | `client/src/plugins/contacts/components/ContactDetailHeaderMenus.tsx` (thin wrapper) + `client/src/core/ui/DetailHeaderMenus.tsx`                                                                                                                  |
| List page shell             | `PLUGIN_PAGE_LIST_SHELL_CLASS` in `client/src/core/ui/pluginPageStyles.ts` (`overflow-x-clip`, not `hidden`)                                                                                                                                       |
| Provider list (search-only) | `client/src/plugins/ai-providers/components/AIProvidersList.tsx` — `RoundExpandableSearch` in header, no Select                                                                                                                                    |
| Shared tokens               | `client/src/core/ui/detailViewCardStyles.ts`                                                                                                                                                                                                       |
| Preview hook (legacy)       | `client/src/core/hooks/useQuickContextPreview.ts` — **do not use for new mail-layout lists**                                                                                                                                                       |

**Read alongside:**

- [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md) — deep-link, duplicate, delete, form footer
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — list shell, typography, detail chrome
- [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](NEW_PLUGIN_INTEGRATION_CHECKLIST.md) — registry / wiring
- [`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`](PLUGIN_DEVELOPMENT_STANDARDS_V2.md) — naming and contracts

**Principle:** Kopiera exakt från referensfilerna. Ändra bara plugin-namn och domänfält. Gissa aldrig layout, knappar eller dialoger.

**New CRUD scaffolds (default):** copy **`templates/plugin-frontend-template/`** or **`ContactList.tsx`** — **Contacts-class mail-layout** (table-only, 20/80 desktop split, detail column shows stacked `*View`, inline create/edit, or `*StatisticsView` when empty). Register `contentFlush: true` and `contentOwnsScroll: true` in `pluginRegistry.ts`. See ADR [`ai/adr/PLUGIN_FRONTEND_TEMPLATE_MAIL_LAYOUT.md`](ai/adr/PLUGIN_FRONTEND_TEMPLATE_MAIL_LAYOUT.md).

**Legacy/alternate:** a **50/50 sticky aside** with a separate `*QuickContextPanel` (`variant="list"`) beside the list — **removed from production** (Slots migrated to mail-layout 2026-09-16). Do **not** reintroduce.

---

## Mental model

```
Mail-layout (default — Contacts-class):
List (*List.tsx)  →  detail column *View (full *QuickContextPanel as first card)
                  →  inline *Form on create/edit
                  →  *StatisticsView when empty

Legacy list-side QC (Slots only):
List (*List.tsx)
  │  row click (desktop)
  ▼
Quick Context Panel (*QuickContextPanel variant="list")  ← sticky aside
  │  Open full profile / Edit
  ▼
DetailPanel / *View (variant="full")
```

Delete, Duplicate, and Export belong in the **full view header menus** (`DetailHeaderMenus`), not in the quick context panel or sidebar cards. Full views do **not** render the system Information card (ID/Created/Updated). Plugins that log entity changes must show **`DetailActivityLog`** on full view — as the **last** URL tab `activity` when the view uses tab chips, otherwise as a **stack card** in the detail column (§2 Activity).

---

## 1. Quick Context Panel

### When to add one

Add a `*QuickContextPanel` as the **first card of `*View`** (mail-layout full-only header: title + `*DetailHeaderMenus`, optional `headerBelow`), **or** mount `*DetailHeaderMenus` with `leading` in the view header card (Cups / Slots). Do **not** add a sticky list-side preview.

**Existing production (verified 2026-09-16):**

| Pattern                                          | Plugins                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Full-only QC in `*View` (no `variant`)           | contacts, notes, tasks, requests, teams, matches, invoices, **estimates**, files, garments inventory, cups |
| Mail-layout detail column (stacked `*View`)      | slots, cups, contacts, clubdesk guides/price lists, and other mail-layout lists                            |
| List-side sticky QC (`variant="list" \| "full"`) | **none** (removed; do not reintroduce)                                                                     |

Do **not** put Delete / Duplicate / Export in the quick context **body**. Mail-layout QC mounts `*DetailHeaderMenus` in the header (Actions / Export / Delete live there).

### Props contract

**Mail-layout (copy Contacts):**

```tsx
{
  item: T;
  headerBelow?: React.ReactNode; // optional row under the title (e.g. view chips)
}
```

Header actions come from `*DetailHeaderMenus` (`leading={titleLeading}`). There is no `variant`, `onClose`, `onOpenFullProfile`, or list footer.

### Layout structure

**Mail-layout (Contacts — copy this):**

```
Card (DETAIL_VIEW_CARD_CLASS, flex-col; natural height — no max-h / no internal scroll)
└── Header (px-4 py-5)
      *DetailHeaderMenus (leading = icon + title)
      optional meta row (type / counts / updated first; badges last)
      optional headerBelow
```

### Header (exact pattern)

**Mail-layout:** mount the plugin’s `*DetailHeaderMenus` with `leading={titleLeading}`. Do not copy ghost `Button` icons.

### Fact grid labels

Reuse `DETAIL_FIELD_LABEL_CLASS` / `DETAIL_FIELD_VALUE_CLASS` from `detailViewCardStyles.ts`, or the equivalent uppercase micro-label used in inventory:

```tsx
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
```

Fact grid: `grid grid-cols-2 gap-x-4 gap-y-3`.

### Description truncation

- Preview budget: `LIST_CONTENT_PREVIEW_CHARS = 1200` (same as notes/tasks).
- Full view: show full text (no list-side “Read more” toggle — that pattern belonged to removed sticky QC).

### Comment callout

```tsx
<div className={DETAIL_NOTE_CALLOUT_CLASS}>
  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
    {comment}
  </p>
</div>
```

### Hook: `useQuickContextPreview`

**Legacy only — no production list uses this for sticky QC anymore.** Mail-layout lists select a row into the detail column without this hook (local preview state). Do not add it to new CRUD plugins.

```tsx
import { useQuickContextPreview } from '@/core/hooks/useQuickContextPreview';

const { previewItem, setPreviewItem, showQuickContext, markPendingAndOpen, activateRow } =
  useQuickContextPreview({
    storeKey: 'my-plugin', // unique per plugin
    items: filteredItems,
    getItemId: (item) => String(item.id),
  });
```

| Helper                           | Behavior                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activateRow(item, openForView)` | Desktop → set preview (same row again closes); compact (`max-width: 1023px`) → open full view. Space on a focused list row triggers this via row click — not full view. |
| `markPendingAndOpen(item, open)` | Remember id so closing full view restores the sticky preview                                                                                                            |
| `showQuickContext`               | `true` when preview is set and viewport is not compact                                                                                                                  |

**Contacts** uses local preview state (`setPreviewContact`) instead of this hook. `handleRowActivate` must still toggle: same id again → `null`. Do not call `open*ForView` from desktop row activate.

### List keyboard (platform)

Global handler: `client/src/core/keyboard/keyboardHandlers.ts`, registered **capture-phase** on `document` from `AppContent`. Ignore `INPUT` / `TEXTAREA` / `contentEditable`.

| Key                     | Focused `[data-list-item]`                                                                                                                                                                    | Other                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **ArrowUp / ArrowDown** | Move focus to previous/next sibling item (wrap). Table: `tr[data-list-item]` in the same `<table>`. Cards: nearest ancestor with multiple `[data-list-item]`. DOM order, not 2D grid.         | Unhandled                                                                                 |
| **Space**               | `preventDefault` + `click()` on the focused row (same as mouse). Desktop QC plugins → `activateRow` toggle. Compact → full view. Lists **without** QC → existing row click (often full view). | If a plugin **full panel** is open (`panelKey`), Space **closes** that panel (unchanged). |

Do **not** call `open*ForView` from the global Space handler. Full profile stays on Open full / `markPendingAndOpen`.

**Required row attributes:** `data-list-item`, `data-plugin-name`, `tabIndex={0}` when the row is clickable, `role="button"`. Shared table: `SortableListTable` sets `tabIndex={0}` when `onRowClick` is set. Do not add `*ListItem` card rows.

### Wiring in `*List.tsx`

Use the **Contacts list header** (§4) — not `ListToolbar` — above the split. Outer page shell must use `PLUGIN_PAGE_LIST_SHELL_CLASS` (`overflow-x-clip` — `overflow-x-hidden` breaks sticky). Do **not** nest the header row inside a shrinking flex child.

**Default (mail-layout):** **20/80** list|detail columns on desktop (`≥1024px` / `showDesktopSplit`). Left: table only. Right: stacked `*View`, inline `*Form` with `headerTrailing={<InlinePanelFormActions … />}` in the form header title row (Close/Update — view-chrome parity; verified Contacts/Notes/Tasks/Estimates/Invoices), or `*StatisticsView` when nothing selected. Do **not** put a separate Close/Update bar above the form. Copy `ContactList.tsx` / `YourItemList.tsx`:

```tsx
<div
  className={cn(
    'grid min-h-0 min-w-0 gap-2',
    showDesktopSplit
      ? 'flex-1 grid-cols-[minmax(220px,20%)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch'
      : 'grid-cols-1 items-start',
  )}
>
  <div
    className={cn(
      'min-w-0',
      showDesktopSplit && 'h-full min-h-0 overflow-y-auto overscroll-contain',
    )}
  >
    {/* *ListTable only; pass activeItemId */}
  </div>
  {showDesktopSplit ? (
    <aside
      className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
      role="region"
      aria-label="Item preview"
    >
      {/* inlineForm ? *Form stacked headerTrailing={InlinePanelFormActions} : detailItem ? *View stacked : *StatisticsView */}
    </aside>
  ) : null}
</div>
```

**Legacy sticky list-side QC (50/50):** Removed. Do **not** reintroduce sticky list-side QC; use mail-layout detail column instead.

### Active row highlight

Pass `active*Id={previewItem?.id ?? selectedId}` into `*ListTable` so the selected row shows an active ring. Keep bulk selection available while the detail column / list-side QC is open. Do **not** add `*ListItem` card rows.

### Checklist — Quick Context

- [ ] Component lives at `plugins/<name>/components/*QuickContextPanel.tsx` **or** detail header menus live in `*View` (Cups/Slots pattern)
- [ ] Mail-layout: full-only props (`item` + optional `headerBelow`); header is `*DetailHeaderMenus` with `leading`
- [ ] Uses `DETAIL_VIEW_CARD_CLASS` on the outer `Card`
- [ ] No Delete / Duplicate / Export in the panel **body** (header menus are OK)
- [ ] Mail-layout list uses 20/80 split + detail column (`ContactList.tsx` / template `YourItemList.tsx`); do **not** add 50/50 sticky list-side QC
- [ ] Outer list shell uses `PLUGIN_PAGE_LIST_SHELL_CLASS` (not hardcoded `overflow-x-hidden`)
- [ ] Active row id synced to the open detail / preview; bulk selection may run while the panel is open
- [ ] i18n: `common.open`, `common.edit`, `common.close`, `common.select`, `common.clear`; `*.quickContext.title` / empty pane keys as needed (**en** and **sv**)
- [ ] List header follows §4 (Select/Clear + BulkActionRoundBar + RoundExpandableSearch) — not `ListToolbar`

---

## 2. Full Detail View (`*View.tsx`)

### Shell

Full view renders inside core `DetailPanel` (wired by `AppContent` + `pluginRegistry`). The view body uses `DetailLayout`:

```tsx
<DetailLayout
  leftSidebar={/* identity + properties + description (full *QuickContextPanel) */}
  sidebar={/* optional: related entities / domain cards only — no QuickActions, Export, Information; Activity lives on main stack or activity tab (§2) */}
>
  {/* optional main column: primary working content (e.g. variants, linked items) */}
</DetailLayout>
```

| Prop              | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `leftSidebar`     | Identity header + details/properties cards            |
| `children` (main) | Primary working content when a third column is needed |
| `sidebar`         | Optional domain/relations cards only (when needed)    |

**Detail header menus (platform):** full-view **Actions / Export** (and plugin-specific extras like Contacts **Time log**) live in the detail **panel title** slot via `pluginContext.getPanelTitle` → `DetailHeaderMenus` (or a thin `*DetailHeaderMenus` wrapper). Do **not** put Quick Actions / Export as sidebar cards. Do **not** render the system **Information** card (ID/Created/Updated). **`DetailActivityLog`** is **required** on full view for plugins with entity activity logging — see §2 Activity (tab or stack; not a legacy sidebar metadata card). Sticky preview belongs on the **list** quick-context aside only.

Desktop columns share the same top edge (`items-start`). On phone, column 3 (`sidebar` / `rightSidebar`) stacks last via `order-*`.

**App right rail:** Fixed narrow tool strip with slide-out flyouts (User / Theme / Settings → `/settings` / Pomodoro / Timer). Plugin `sidebar` content stays inline in the detail grid — it is not portaled into the rail.

**Limits (verified):** tools/flyouts are desktop-rail-only (unavailable on phone/pad); Settings navigates to Core Settings (`navigateToSettings`) rather than an in-rail settings panel; Form/View `sidebar` columns stay inline (no `detailLayoutPortal`).

Do **not** put primary content properties only in the right sidebar — see §6 in `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`.

### Cards and sections

- Outer cards: `<Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>`
- Sections: `<DetailSection title={…} icon={…} subtleTitle className="p-4">` (or `p-6` where the plugin already uses denser padding)
- Field values: `DETAIL_FIELD_VALUE_CLASS`
- Property rows: `DETAIL_PROP_ROW_CLASS`
- Notes/comments: `DETAIL_NOTE_CALLOUT_CLASS`
- Info rows: `DETAIL_INFO_ROW_CLASS`
- Quick action rows: `DETAIL_QUICK_ACTION_ROW_CLASS`
- **Empty messages inside a detail card:** `DETAIL_EMPTY_STATE_CLASS` (`text-xs text-muted-foreground`) — same as Contacts linked when empty. Do **not** wrap empties in bordered/dashed boxes.

**Contacts full view (canonical):** Always render **Addresses** and **Contact Persons** cards (column 1, after Quick Context). When empty, show the shared muted empty message (`DETAIL_EMPTY_STATE_CLASS` / `contacts.noAddresses` / `contacts.noContactPersons`) — do not omit the cards.

**Notes / Tasks / Requests full detail (header card):** Title/actions live in the QuickContext card (`*DetailHeaderMenus` + optional `headerBelow` for URL tab chips). There is **no** list-side QC for these plugins. Primary body (content, linked mentions, attachments, activity) lives in `*View` tab panels, not as QC `children`.

**Attachments (shared):** Use `FileAttachmentsSection` (`DetailSection` + `subtleTitle` + Paperclip, `iconPlugin="files"`). Attachment rows use `FileIdentityCell` (same identity as Files list name column). Empty/loading: `DETAIL_EMPTY_STATE_CLASS`.

**Tasks / Requests status · priority · due chips:** Use inline labels via `StatusOutlineBadge` / `BADGE_CHIP_*` + `QC_STATUS_BADGE_COLORS` / `DUE_DATE_*` — Lucide icon + extrabold colored text only (**no** fill, border, fixed height, or padding). Select triggers share `BADGE_SELECT_TRIGGER_CLASS` (rounded trigger chrome is OK on selects; value content stays icon+label). Tasks due labels/colors go through `formatTaskDueDisplay` / `DUE_DATE_*` in `badgeStyles` + `tasks.ts`. Requests **response-due** urgency stays on `RESPONSE_DUE_URGENCY_COLORS` (SLA days control), not `DUE_DATE_*`.

**Requests column order (verified):** Left (`leftSidebar`) = QC/header+description → submitted details (if any) → submitter → **Properties**. Right (main) = **Attachments** → assignee → team. View and form match.

### Identity block (left column header)

Match quick context: initials avatar (`h-11 w-11`) + `text-lg font-semibold` title inside a card header with `border-b border-border/50 px-4 py-3`.

### Activity (entity audit log)

Use **`DetailActivityLog`** (`client/src/core/ui/DetailActivityLog.tsx`) on full **view** when the backend exposes the standard entity activity pattern (same props as existing views: `entityType`, `entityId`, `limit={30}`, `showClearButton`, `refreshKey` from `updatedAt`/id).

| Placement                                     | When                                                                              | Verified examples                                                                                                                                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Last URL tab** `activity` (`?tab=activity`) | View uses URL tab chips (`?tab=…`, e.g. `CONTACT_VIEW_TABS` in `ContactView.tsx`) | contacts, tasks, requests, invoices, estimates, matches, teams, cups (`entityType="cup"`), ingest, clubdesk guides + price lists (`entityType="clubdesk"`), notes — e.g. `ContactView.tsx`, `TaskView.tsx`, `NoteView.tsx`, `CupView.tsx`, `ClubdeskView.tsx`, `PriceListView.tsx` |
| **Stack card** on the detail column           | View has **no** tab chips                                                         | slots, instructions — e.g. `SlotView.tsx`, `InstructionView.tsx`                                                                                                                                                                                                                   |

Render the log only inside the **activity** tab panel when using tabs; do **not** duplicate it on other tabs. Do **not** mount `DetailActivityLog` in the optional `sidebar` column as system metadata — it belongs in the main stack or the activity tab.

**Forms:** create/edit layouts that already had sidebar `DetailActivityLog` stay as-is; new work follows the same **view** rule above.

### Sidebar order (when `sidebar` is used)

Full views follow the **Contacts canonical layout**: Actions / Export / plugin extras in **header menus** (§4); **no** system Information card; **Activity** via §2 (tab or stack).

When a plugin still passes `sidebar`, limit it to **domain content** only, for example:

1. **Related entities** — mentions, assignees, links (`QuickContextLinkTile` when applicable)
2. **Domain sections** — plugin-specific cards (not system metadata)

Do **not** add sidebar QuickActions, ExportOptions, or system Information (ID/Created/Updated) to new work. Legacy sidebar quick-action cards are deprecated (§4).

**Guides exception:** domain sections under `guides.information.*` (costs, generated languages) are **domain fields**, not the system Information card — they may remain in Guides full view.

Sidebar spacing: `space-y-4` (Contacts/inventory) or `space-y-6` — stay consistent within the plugin.

### Checklist — Full View

- [ ] Uses `DetailLayout` with correct column roles (Contacts-class: often 2-col, no `sidebar` or domain-only `sidebar`)
- [ ] All content cards use `DETAIL_VIEW_CARD_CLASS`
- [ ] Actions / Export in `DetailHeaderMenus` via `getPanelTitle` — **not** sidebar QuickActions / Export cards
- [ ] **No** system Information card (ID/Created/Updated) in layout
- [ ] **`DetailActivityLog`** on full view when entity activity is logged — last tab `activity` or stack card (§2 Activity)
- [ ] Delete / Duplicate dialogs live in the view or header-menu wrapper (see §5)

---

## 3. View / Edit layout sync (`*Form.tsx`)

**Rule:** Create/edit chrome must match view chrome so switching modes does not jump layout.

### Shared rules

| Rule                                 | Detail                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same `DetailLayout`                  | Same column structure as view (main + optional sidebar)                                                                                                                                                                                                                                                  |
| Same card tokens                     | `DETAIL_VIEW_CARD_CLASS` per section                                                                                                                                                                                                                                                                     |
| Same section titles/icons/order      | Details, variants, description, etc.                                                                                                                                                                                                                                                                     |
| No bleed shell                       | No `md:-mx-6`, no extra outer padding — content sits in DetailPanel (`px-2 sm:px-3` phone / `px-6` pad/desktop)                                                                                                                                                                                          |
| No `PANEL_MAX_WIDTH` on form main    | Avoid constraining create/edit differently from view                                                                                                                                                                                                                                                     |
| No nested max-h scroll in form cards | Phone/desktop: form cards grow with content (same as view); page scroll only — do not use `max-h-[calc(100vh-…)]` + inner `overflow-y-auto` on identity cards                                                                                                                                            |
| Edit sidebar                         | Prefer Contacts-class pattern: **2 columns** (`leftSidebar` content + main properties); **no** system Information card in edit or view. **View:** Activity per §2. **Edit/create:** keep existing sidebar `DetailActivityLog` only where the plugin already had it. Keep tokens/Save-Cancel rules below. |
| Create                               | Same chrome as edit when the plugin uses 2-column edit (e.g. Contacts, Invoices); otherwise single column OK                                                                                                                                                                                             |
| Field grids on phone                 | Prefer `grid-cols-1 … sm:grid-cols-2` / `md:grid-cols-2` so edit matches view stacking                                                                                                                                                                                                                   |

### Form field chrome (required)

**Source of truth:** `client/src/core/ui/formFieldStyles.ts`.

Two families — do **not** replace one with the other globally:

| Family                     | When                                                                                                                                                                                                                               | Tokens                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ghost** (view-matched)   | Plugin **detail** create/edit **fact fields** (label + value grids that mirror `*View`) — Contacts canonical; Notes/Tasks title + `RichTextEditor variant="ghost"`; Requests/Tasks ghost textareas via `FORM_GHOST_TEXTAREA_CLASS` | `FORM_GHOST_INPUT_CLASS`, `FORM_GHOST_SELECT_CLASS`, `FORM_GHOST_PROP_CONTROL_CLASS`, `FORM_GHOST_TEXTAREA_CLASS`, `FORM_GHOST_READONLY_CLASS` |
| **Filled** (compact muted) | Plugin **settings**, **dense** in-plugin editors (invoice lines, PersonMatrix, inventory steppers), and plugins not yet migrated to ghost                                                                                          | `FORM_INPUT_CLASS`, `FORM_PROP_CONTROL_CLASS`, `FORM_TEXTAREA_CLASS`, `FORM_COMPACT_*`                                                         |

Do **not** change shadcn `Input` / `Textarea` / `NativeSelect` defaults — apply tokens via `className`. Do **not** change `FORM_INPUT_CLASS` to look like ghost (would regress settings / matrices).

**Ghost rules:** typography matches `DETAIL_FIELD_VALUE_CLASS` (`text-base font-extrabold`) for **single-line** fact inputs/selects; **soft light-blue idle surface** (`bg-primary/10`) so edit mode is visible without compact filled chrome; **visible focus ring** (WCAG); empty fields keep placeholders; validation via `FORM_INPUT_ERROR_CLASS` (ring). Selects keep a visible chevron/affordance. Hero title and Notes/Tasks `RichTextEditor variant="ghost"` use the same soft idle surface. Multi-line ghost textareas (`FORM_GHOST_TEXTAREA_CLASS`) use **normal** `text-sm` weight (like view body/description), with `field-sizing-content` / height sync so the control **grows with text** (no inner scroll). No contenteditable for fact fields, no always-on-edit.

**Contacts create/edit tabs:** `ContactForm` uses the **same URL `?tab=` shell** as `ContactView` (`information` | `addresses` | `persons` | `linked` | `activity`). Properties is **not** a separate chip — it is card #2 on the Information tab (below the main info card). Legacy `?tab=properties` maps to `information`. View→Edit preserves the active tab when it is editable (`useItemUrl.navigateToItem` keeps `window.location.search`). Editable tabs: information, addresses, persons. **Linked and Activity** stay visible in the chip row but are **greyed out / disabled** in edit (view-only); if the URL is on those tabs when entering edit, the form redirects to information. Validation errors on a hidden editable tab show a destructive dot on that chip. Create uses the same shell (starts on information). Do **not** reintroduce the 2-column `leftSidebar` form stack for Contacts.

**Information + Properties merge (all Contacts-class plugins that had both):** When a plugin previously had both chips, keep a single **Information** chip. Render the former Properties body as the second card under Information (below description / main info). Same rule for View and Form. **Requests:** on Information, order is Description → (optional Submitted details) → **Properties** → **Submitter**. **Estimates (verified 2026-09-21):** uses the same **Information** tab shell (`information` | `lines` | `linked` | `activity`); card #1 = facts (incl. order/delivery), card #2 = **Estimate properties** (status, reasons, **notes**), then Share + preview — not a separate Properties chip.

**Estimates create/edit tabs:** `EstimateForm` mirrors `EstimateView` `?tab=` chips. **Linked** and **Activity** stay visible but **disabled** in edit. Invoiced estimates cannot open edit (provider + header menus). Line items on **Lines** via `EstimateLineItemsEditor` → shared invoice line editor.

**Notes / Tasks / Requests create/edit tabs (same pattern):** `NoteForm`, `TaskForm`, and `RequestForm` reuse their View `?tab=` chips. Linked and/or Activity chips stay visible but **disabled** in edit; non-editable tab URLs redirect to the first editable tab. Notes focus mode (edit only) portals the editor into a **viewport-centered** overlay — see `UI_AND_UX_STANDARDS_V3.md` (Notes focus mode).

```tsx
import {
  FORM_GHOST_INPUT_CLASS,
  FORM_GHOST_SELECT_CLASS,
  FORM_INPUT_ERROR_CLASS,
} from '@/core/ui/formFieldStyles';

<Input className={cn(FORM_GHOST_INPUT_CLASS, getFieldError('email') && FORM_INPUT_ERROR_CLASS)} />
<NativeSelect className={FORM_GHOST_SELECT_CLASS}>…</NativeSelect>
```

**Filled tokens (settings / dense):**

| Token                                                    | Use on                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `FORM_INPUT_CLASS`                                       | Settings cards; dense list-detail blocks (e.g. garments matrix-adjacent editors) until migrated                    |
| `FORM_PROP_CONTROL_CLASS`                                | Narrow filled property-row controls (`max-w-[180px]`)                                                              |
| `FORM_TEXTAREA_CLASS`                                    | Settings / dense `Textarea`                                                                                        |
| `FORM_COMPACT_INPUT_CLASS` / `FORM_COMPACT_SELECT_CLASS` | Dense rows: invoice line items, garment variants, garments `PersonMatrix` cells, inventory QC quantity             |
| `FORM_INPUT_ERROR_CLASS`                                 | Validation — combine with filled **or** ghost tokens (not `border-red-500`; borders are invisible with `border-0`) |
| `FORM_INPUT_READONLY_CLASS`                              | Read-only **filled** controls                                                                                      |

```tsx
import { FORM_INPUT_CLASS, FORM_INPUT_ERROR_CLASS, FORM_TEXTAREA_CLASS } from '@/core/ui/formFieldStyles';

<Input className={cn(FORM_INPUT_CLASS, getFieldError('title') && FORM_INPUT_ERROR_CLASS)} />
<Textarea className={FORM_TEXTAREA_CLASS} />
```

**Other exceptions (do not force filled or ghost):**

- Hero title: `DETAIL_FORM_TITLE_INPUT_CLASS` (contacts / garments / notes / tasks / requests title) — focus ring required
- Most dialogs (`*Dialog.tsx`), list search (`RoundExpandableSearch`), public forms — keep default bordered shadcn chrome
- **Documented dense-dialog exception:** garments `GarmentPersonImportDialog` tag `NativeSelect` uses `FORM_COMPACT_SELECT_CLASS` for parity with PersonMatrix density
- Rich text: Notes and Tasks edit use `RichTextEditor variant="ghost"`; other surfaces may keep default bordered chrome; errors via `FORM_INPUT_ERROR_CLASS`
- Height sync helper: `client/src/core/ui/syncTextareaHeight.ts` (Contacts notes; Requests description / intake comment / internal notes)
- Duplicate/warning emphasis: use **ring** (e.g. amber), not `border-*` (invisible with `border-0`)

### Date pickers (required)

**Source of truth:** `client/src/core/ui/DatePicker.tsx` (Tasks Due date is the visual reference).

- Date-only fields: use shared `DatePicker` (DayPicker popover) — **not** native `<Input type="date">`.
- Date+time fields: use shared `DateTimePicker` (same calendar chrome + time input; `variant="filled"` in plugin forms).
- In plugin forms/settings with filled chrome: `variant="filled"` (and `propWidth` / `fullWidth` as needed).
- String `YYYY-MM-DD` values: `parseDateInputValue` / `formatDateInputValue` from the same module (local calendar — avoid `toISOString().split('T')[0]`).
- Tasks list/QC/form due date: thin wrapper `TaskDueDatePicker` → `DatePicker` (`propWidth`, compact `h-7` aligned with status/priority selects).
- Tasks due **display** (list/table/QC/header/public): shared `formatTaskDueDisplay` / `getTaskDueUrgency` / `getTaskDueDiffDays` in `plugins/tasks/types/tasks.ts` (injectable `nowMs` for tests). Do not re-implement overdue/today/tomorrow strings per surface.

**Known limitation:** Some required dates (e.g. invoice issue date, estimate valid-to) keep the Clear control but ignore `null` (`date ?? previousValue`). Prefer hiding Clear or validating null when product allows empty.

### Inline Save / Cancel (required)

`PanelFooter` does **not** save forms. No `window.submitXxxForm` / `window.cancelXxxForm`.

```tsx
<div className="flex justify-end gap-2 pt-4 border-t border-border">
  <Button
    type="button"
    variant="secondary"
    size="sm"
    icon={X}
    onClick={onCancel}
    disabled={isSubmitting}
    className="h-9 text-xs px-3"
  >
    {t('common.cancel')}
  </Button>
  <Button
    type="button"
    variant="primary"
    size="sm"
    icon={Check}
    onClick={handleSubmit}
    disabled={hasBlockingErrors || isSubmitting}
    className="h-9 text-xs px-3 bg-green-600 hover:bg-green-700 text-white border-none"
  >
    {isSubmitting
      ? t('common.saving')
      : panelMode === 'edit'
        ? t('common.update')
        : t('common.save')}
  </Button>
</div>
```

- `hasBlockingErrors = validationErrors.some((e) => !e.message.includes('Warning'))`
- Implement `PanelFormHandle` (`forwardRef` + `useImperativeHandle` with `{ submit, cancel }`) for core panel integration
- Unsaved changes: wire `useUnsavedChanges` so nav guard + warning dialog work (see §5)

### Checklist — Form sync

- [ ] Side-by-side compare with `*View.tsx`: same cards, order, tokens
- [ ] Detail fact fields use `FORM_GHOST_*` (Contacts-class) or documented filled exception — not ad-hoc `h-9`/`h-10` bordered inputs
- [ ] Settings / dense grids still use `FORM_*` filled / compact tokens
- [ ] Date-only fields use shared `DatePicker` (not `type="date"`); date+time use `DateTimePicker`
- [ ] Inline Save/Cancel present; window globals **absent**
- [ ] Button size `h-9 text-xs px-3`; Save uses green primary classes above
- [ ] Edit mode has no QuickActions; no system Information / Activity cards (Contacts-class 2-col edit)
- [ ] Create mode has no sidebar / full width
- [ ] Unsaved-changes warning on navigate away when dirty

---

## 4. Headers and buttons

### List page header (canonical — CRUD lists)

**Reference:** `ContactList.tsx` and `templates/plugin-frontend-template` (`YourItemList.tsx`). Do **not** use `ListToolbar` as the default list header — new CRUD scaffolds and the golden template use the Contacts-class header below. (`ListToolbar` is **legacy / exception only** for older live plugins that have not migrated yet.)

Layout (desktop, `hidden md:block`):

```
flex items-start justify-between gap-6
├── Left column (flex min-w-0 flex-1 flex-col gap-5)
│   ├── PLUGIN_PAGE_TITLE_ROW_CLASS
│   │     h2 (PLUGIN_PAGE_TITLE_CLASS) + Settings (soft) + Select|Clear (alwaysExpanded)
│   └── BulkActionRoundBar (when selectionMode)
└── PLUGIN_PAGE_HEADER_ACTIONS_CLASS
      RoundExpandableSearch + Add (soft, alwaysExpanded)
```

**Select / Clear:** `ExpandableIconButton` — Select `variant="soft"`, Clear `variant="danger"`, both `alwaysExpanded`. Toggle `selectionMode` state; show only when the list has items.

**Bulk actions:** `BulkActionRoundBar` below the title row when `selectionMode` is true. Gray secondary pills, count pill blue; message `text-sky-500`, email `text-red-800`, delete `tone: 'destructive'`.

**Search:** `RoundExpandableSearch` in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS` beside Add — not in a full-width toolbar row.

**Table checkboxes:** pass `selectionEnabled={selectionMode}` into `*ListTable` / row components so checkbox columns appear only in select mode.

**Provider / config lists without meaningful bulk:** search-only header — `RoundExpandableSearch` in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS`, no Select/Clear. Reference: `AIProvidersList.tsx`.

```tsx
<div className={PLUGIN_PAGE_TITLE_ROW_CLASS}>
  <h2 className={PLUGIN_PAGE_TITLE_CLASS}>{t('nav.myPlugin')}</h2>
  {/* Settings, etc. */}
  {items.length > 0 ? (
    selectionMode ? (
      <ExpandableIconButton icon={XCircle} label={t('common.clear')} variant="danger" alwaysExpanded onClick={handleExitSelectionMode} />
    ) : (
      <ExpandableIconButton icon={CheckSquare} label={t('common.select')} variant="soft" alwaysExpanded onClick={handleEnterSelectionMode} />
    )
  ) : null}
</div>
{selectionMode ? <BulkActionRoundBar selectedCount={selectedCount} actions={bulkRoundActions} /> : null}
{/* … */}
<div className={PLUGIN_PAGE_HEADER_ACTIONS_CLASS}>
  <RoundExpandableSearch value={searchTerm} onChange={setSearchTerm} placeholder={…} />
  {/* optional toolbar sort controls — table headers also sort via SortableListTable */}
  <ExpandableIconButton icon={Plus} label={t('myPlugin.add')} variant="soft" alwaysExpanded onClick={…} />
</div>
```

**List layout:** **Table-only** (`*ListTable` / `SortableListTable`). Do not add a cards/column layout toggle. Do not add a settings **View** tab for list layout. **Status on the identity column:** prefer bold colored meta text (`text-[10px] font-extrabold` + `QC_*` / plugin status color tokens) on the row under the title — not a title-row badge/icon. Optional dedicated status columns may still use `StatusOutlineBadge`.

**Settings categories:** use `PluginSettingsPageShell` round category buttons whenever `categories.length >= 1` (keep the button chrome even for a single category, e.g. Tasks Import-only, **Estimates Numbering**). When `categories.length === 0` (temporary empty shell only), still pass required `children` and empty-state copy — do not omit `children` (TypeScript requires it).

**List table columns:** **not** user-configurable in settings. Default visible columns are **name/title only** (required identity: `name` / `title` / `matchup` / `articleName` / `estimateNumber` / `invoiceNumber`, etc.). Extra metadata columns are decided **per plugin in code** later — keep column defs in `*ListTable` + helpers in `*TableColumns.ts` / `client/src/core/list/tableColumnsPref.ts`, and have `resolveVisible*` return code defaults (ignore any legacy `user_settings.tableColumns`). Do not add column pickers on the list toolbar or a settings **Columns** category. Garments list **checkbox** custom columns remain list-entity settings — see [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md) (Person rows).

### Panel / page titles

- List page title and primary Add action come from `MainLayout` / content header wiring in context (`getPanelTitle`, content view keys).
- Plugins with `contentFlush: true` own in-page padding and often render their own list header (title + count + Settings + Add).
- Detail panel title/subtitle come from context helpers consumed by `AppContent` → `createPanelTitles` (`PanelTitles.tsx`).
- The app shell has **no TopBar breadcrumbs**. When `getPanelTitle` returns a React node (`DetailHeaderMenus`), that node is for the DetailPanel title only — never inject action bars into shell chrome.

### Detail header menus (platform reference)

Shared primitive: `client/src/core/ui/DetailHeaderMenus.tsx`. Plugin wrappers (e.g. `ContactDetailHeaderMenus`, `TaskDetailHeaderMenus`) supply actions/export/extra menus + dialogs. Wire via `Provider.getPanelTitle` in view mode; `PanelTitles` prefers non-string React nodes **before** the mobile “blank title” early-return.

**Layout (all breakpoints):** trigger buttons (`Actions` / `Export` / extras) stay on the first row (menus cluster on the right) and may scroll horizontally when needed. When a menu is open, its action pills **always** render on the **row below** inside the same menus column — **right-aligned with the rightmost trigger**, regardless of which menu is open (`justify-end`, `size="xs"` / `text-xs` — same density as Contacts `BulkActionRoundBar`). Do **not** render submenu pills inline beside the active trigger.

**Spacing:** use shared `DETAIL_HEADER_CHIP_GAP_CLASS` (`gap-1.5`) for trigger buttons, submenu pills, and trigger↔submenu. Title/`leading` ↔ triggers stays `gap-3`. Meta/badge rows under the menus use the same chip gap plus `DETAIL_HEADER_BELOW_MENUS_CLASS` (`mt-1.5`), with type / counts / **updated first** and **badges last** on that row (Tasks / Notes / Matches / Invoices / Inventory / Teams / Files / Estimates). **Requests exception (verified):** source Internal/External is the **first** meta badge in `RequestQuickContextPanel`, then type / status / priority / response-due. Use `DetailHeaderMetaRow` / `DetailHeaderMetaDot` for separators.

**Optional `leading`:** identity (name / invoice # / title) on the same row as the triggers, left side (`min-w-0 flex-1`). Used in mail-layout full QC card headers where there is no separate panel title. Edit remains under Actions (no standalone Edit beside menus).

| Trigger     | Idle / open                                                                   | Expanded row (below triggers)                                                                                       |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Actions** | `RoundIconLabelButton` `variant="soft"` / `primary` when open                 | Secondary pills: Edit (`soft`), Delete / Duplicate (colored icons), Message (`text-sky-500`), Mail (`text-red-800`) |
| **Export**  | same soft/primary toggle                                                      | TXT / CSV / PDF (+ share) secondary pills                                                                           |
| **Extras**  | optional (e.g. Contacts **Time log** only when ≥1 entry + orange count badge) | Plugin-specific content                                                                                             |

Delete / duplicate stay behind `ConfirmDialog` / `DuplicateDialog`. Remount menus with `key={item.id}` when switching items.

### Legacy sidebar quick actions — do not use for new work

Older `*QuickActionsCard` / `*ExportOptionsCard` ghost-row sidebars are **deprecated**; migrate to `DetailHeaderMenus`. Icon color reference for any remaining ghost rows:

| Action       | Icon CSS                               | Button / hover                                                 |
| ------------ | -------------------------------------- | -------------------------------------------------------------- |
| Edit         | `text-blue-600 dark:text-blue-400`     | `DETAIL_QUICK_ACTION_ROW_CLASS` / `hover:bg-muted`             |
| Delete       | `text-red-600 dark:text-red-400`       | `h-9 … hover:bg-red-50 dark:hover:bg-red-950/30` (red text OK) |
| Duplicate    | `text-green-600 dark:text-green-400`   | `DETAIL_QUICK_ACTION_ROW_CLASS`                                |
| Send message | `text-violet-600 dark:text-violet-400` | muted hover                                                    |
| Send email   | `text-red-600 dark:text-red-400`       | muted hover                                                    |

**Header Actions row** uses round pills: Message/Mail icon colors match **bulk** (`text-sky-500` / `text-red-800`).

### List header action buttons (canonical)

Use **`ExpandableIconButton variant="soft"`** for Settings, Add, and routing shortcuts in the title row / `PLUGIN_PAGE_HEADER_ACTIONS_CLASS` — reference `ContactList.tsx`.

**Legacy (`ListToolbar` / plain `Button` rows):** exception-only. When retained, use `Button variant="secondary" size="sm" icon={Settings} className="h-9 text-xs px-3"` with icon + label — not icon-only.

### Bulk selection actions

**Default (`BulkActionRoundBar`):** gray secondary pills, `alwaysExpanded`; count pill blue; message icon `text-sky-500`, email `text-red-800`, delete `tone: 'destructive'`. Reference: `ContactList.tsx`.

**Legacy (`ListToolbar`):** exception-only — neutral bulk actions hover `bg-primary/10` + `text-primary`; Clear selection and Delete use red hover language. Do not use for new CRUD lists.

### Checklist — Buttons

- [ ] List header: Select/Clear (`alwaysExpanded`) + `BulkActionRoundBar` when `selectionMode` + `RoundExpandableSearch` in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS`
- [ ] `selectionEnabled={selectionMode}` on table/rows; no `ListToolbar` unless documented legacy exception
- [ ] Quick action icon colors match the table (header menus §4)
- [ ] Delete has red hover background (header menu pills)
- [ ] No `variant="default"` full-width rows in Quick actions
- [ ] Header actions use `ExpandableIconButton variant="soft"` (Settings, Add) or round pattern above
- [ ] Quick context / detail header uses `*DetailHeaderMenus` with `leading` (not ghost `h-8 w-8` icons)
- [ ] Dialog footers use `DialogRoundButtons` / `AlertDialogRound*` with `alwaysExpanded`

---

## 5. Default behaviors (dialogs / confirmations)

Import from `@/core/ui/` — do not invent local modals for these cases.

### 5.1 Delete item — `ConfirmDialog` (`variant="danger"`)

**Context:** expose `getDeleteMessage(item)`.

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

<ConfirmDialog
  isOpen={showDeleteConfirm}
  title={t('dialog.deleteItem', { label: t('nav.myPlugin') /* or entity label */ })}
  message={item ? getDeleteMessage(item) : ''}
  confirmText={t('common.delete')}
  cancelText={t('common.cancel')}
  onConfirm={() => {
    void deleteMyPlugin(item.id);
    setShowDeleteConfirm(false);
  }}
  onCancel={() => setShowDeleteConfirm(false)}
  variant="danger"
/>;
```

- QuickActions Delete (header menus) → `setShowDeleteConfirm(true)` only (never delete immediately).
- Panel close after delete is owned by context `delete*` when that is the plugin’s pattern.

### 5.2 Duplicate item — `DuplicateDialog`

**Context** (prefer `usePluginDuplicate`):

- `getDuplicateConfig(item) → { defaultName, nameLabel, confirmOnly } | null`
- `executeDuplicate(item, newName) → Promise<{ closePanel, highlightId? }>`
- `recentlyDuplicated*Id` + `setRecentlyDuplicated*Id`

**View:**

```tsx
onDuplicate={() => setShowDuplicateDialog(true)}  // NOT executeDuplicate

<DuplicateDialog
  isOpen={showDuplicateDialog}
  onConfirm={(newName) => {
    executeDuplicate(item, newName)
      .then(({ closePanel, highlightId }) => {
        closePanel();                                           // 1
        if (highlightId) setRecentlyDuplicatedMyPluginId(highlightId); // 2
        setShowDuplicateDialog(false);                          // 3
      })
      .catch(() => setShowDuplicateDialog(false));
  }}
  onCancel={() => setShowDuplicateDialog(false)}
  defaultName={getDuplicateConfig(item)?.defaultName ?? ''}
  nameLabel={getDuplicateConfig(item)?.nameLabel ?? t('myPlugin.title')}
  confirmOnly={Boolean(getDuplicateConfig(item)?.confirmOnly)}
/>
```

**List highlight:**

```tsx
recentlyDuplicatedMyPluginId === String(item.id) && 'bg-green-50 dark:bg-green-950/30';
```

Clear `recentlyDuplicated*Id` in every `open*ForView` / `open*ForEdit` / `open*Panel` (no `alreadyViewingSame` guard). Deep-link must be pathname-based or highlight will reset on list refresh — see `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §1 and §4.

### 5.3 Unsaved changes — `ConfirmDialog` (`variant="warning"`)

- Form: `useUnsavedChanges` + dirty tracking for field state.
- Global discard dialog is owned by `AppContent`. Aligned mail-layout create/edit forms register `() => true` while mounted so **list row, plugin settings, left sidebar, and right-rail Settings** always confirm leave (same dialog as Close) — not only when dirty. Verified callers include Contacts, Notes, Tasks, Requests, Matches, Cups, Teams, Guides, Clubdesk, PriceList, Ingest, Estimates, Invoices, Slots, Garments (incl. inventory), Instructions, Files. Close uses `attemptAction(..., { force: true })`. Right-rail Settings goes through `attemptNavigation` in `AppRightSidebar`. **Limit:** client UX only (browser tab close / hard refresh skips the prompt); not server access control.
- **`ConfirmDialog` confirm race:** Confirm must **not** invoke `onCancel` when the dialog closes after confirm (`AlertDialog` fires `onOpenChange(false)`). Implementation uses a `confirmingRef` so Discard / leave confirm runs the pending action once. Do **not** remove that guard.
- Local form confirm (optional, garments-style) for cancel with pending edits also uses `variant="warning"`. Inventory edit Discard should call the shared discard path once and return to view (not double-`onCancel` that closes the panel).

### 5.4 Bulk delete — `BulkDeleteModal`

```tsx
<BulkDeleteModal
  isOpen={showBulkDeleteModal}
  onClose={() => setShowBulkDeleteModal(false)}
  onConfirm={handleBulkDelete}
  itemCount={selectedCount}
  itemLabel={t('myPlugin.itemLabel')}
  isLoading={isDeleting}
  warningMessage={/* optional extra warning */}
/>
```

Opened from list `BulkActionRoundBar` Delete action — not from the detail sidebar.

### 5.5 Sub-item delete (rows inside a form)

Example: delete a variant row in `GarmentForm`.

```tsx
const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

<ConfirmDialog
  isOpen={pendingDeleteIndex !== null}
  title={…}
  message={…}
  confirmText={t('common.delete')}
  cancelText={t('common.cancel')}
  onConfirm={() => { /* remove row */; setPendingDeleteIndex(null); }}
  onCancel={() => setPendingDeleteIndex(null)}
  variant="danger"
/>
```

### 5.6 Dialog chrome — layout tokens + round actions

Custom modals and shared dialogs use `@/core/ui/dialogStyles.ts` for consistent padding and typography:

```tsx
import { DIALOG_HEADER_CLASS, DIALOG_BODY_SCROLL_CLASS, DIALOG_FOOTER_CLASS } from '@/core/ui/dialogStyles';
import { DialogHeading } from '@/core/ui/DialogHeading';
import { DialogCancelButton, DialogSaveButton } from '@/core/ui/DialogRoundButtons';

<div className={DIALOG_HEADER_CLASS}>
  <DialogHeading>{title}</DialogHeading>
</div>
<div className={DIALOG_BODY_SCROLL_CLASS}>{/* fields */}</div>
<div className={DIALOG_FOOTER_CLASS}>
  <DialogCancelButton onClick={onClose} />
  <DialogSaveButton onClick={onSave} />
</div>
```

Radix alert dialogs: `AlertDialogRoundCancel`, `AlertDialogRoundSave`, `AlertDialogRoundDelete` — always `asChild` + round buttons. Do not use raw `Button` rows in modal footers for standard Save/Cancel/Delete.

### Checklist — Dialogs

- [ ] Item delete: `ConfirmDialog` + `variant="danger"` + `getDeleteMessage`
- [ ] Duplicate: `DuplicateDialog` + order `closePanel` → highlight → close dialog
- [ ] List green highlight after duplicate
- [ ] Unsaved changes: warning variant / nav guard
- [ ] Bulk delete: `BulkDeleteModal` from list `BulkActionRoundBar`
- [ ] Nested row delete: local danger confirm
- [ ] Modal headers use `DialogHeading`; body/footer use `dialogStyles` tokens
- [ ] Footer actions use `DialogRoundButtons` (not legacy filled `Button` pairs)
- [ ] Quick context has **none** of the above destructive dialogs

---

## 6. Context checklist

Every CRUD plugin with full view (+ duplicate when supported) must expose:

| API                                                            | Required                   |
| -------------------------------------------------------------- | -------------------------- |
| `openXPanel` / `openXForView` / `openXForEdit` / `closeXPanel` | yes                        |
| `getDeleteMessage(item)`                                       | yes                        |
| `getDuplicateConfig` / `executeDuplicate`                      | if duplicate is supported  |
| `recentlyDuplicated*Id` / `setRecentlyDuplicated*Id`           | if duplicate is supported  |
| Clear highlight in all open-\* helpers                         | yes                        |
| Pathname-based deep-link (`useLocation`)                       | yes (when URL slugs exist) |
| `registerPanelCloseFunction`                                   | yes                        |
| Panel title / subtitle helpers for `AppContent`                | yes                        |

Duplicate implementation detail: prefer shared `usePluginDuplicate` (as garments inventory) over a one-off copy.

### Checklist — Context

- [ ] `setRecentlyDuplicated*` destructured in View
- [ ] `openXForView` always clears highlight
- [ ] Deep-link effect depends on `[location.pathname, items]`, not `[items]` alone
- [ ] `closeXPanel` declared before effects that register it (TDZ)
- [ ] NullProvider stubs include no-op duplicate/delete helpers when the plugin can be disabled

---

## 7. i18n checklist

Keys in **both** `client/src/i18n/locales/en.json` and `sv.json`.

### Required for detail chrome

```json
"myPlugin": {
  "quickActions": "…",
  "exportOptions": "…",
  "title": "…",
  "deleteConfirmThis": "…",
  "deleteConfirmNamed": "…"
}
```

`information` keys stay unused for the removed system Information card. Provide **`activity`** (and `*.tabs.activity` when using tab chips) when the view renders `DetailActivityLog` (§2). Domain keys (e.g. `guides.information.*`) are separate.

### Quick context

```json
"common": {
  "open": "…",
  "openFullProfile": "…"
},
"myPlugin": {
  "quickContext": {
    "readMore": "…",
    "showLess": "…"
  }
}
```

### Reuse platform keys

`common.edit`, `common.delete`, `common.duplicate`, `common.cancel`, `common.save`, `common.update`, `common.saving`, `common.close`, `common.created`, `common.updated`, `dialog.deleteItem`, `bulk.selected`, `common.clearSelection`.

No hard-coded English UI strings in components.

### Checklist — i18n

- [ ] All new keys in en **and** sv
- [ ] `myPlugin.title` exists for DuplicateDialog `nameLabel`
- [ ] Empty list uses `*.noYet` + Create; filtered empty uses no-match copy without Create

---

## 8. Verification checklist (before merge)

Walk in order. No “probably OK” — verify in the running app.

### Quick context

**Mail-layout (default):**

- [ ] Desktop row click shows stacked `*View` (full QC) in the detail column; compact uses panel flow
- [ ] Same desktop row again (click or Space) clears the detail selection where the list toggles preview
- [ ] Space on a focused list row does **not** call `open*ForView` on desktop
- [ ] Active row ring matches the open detail item
- [ ] Header menus (not QC body) own Edit / Delete / Duplicate / Export
- [ ] Bulk selection still works with the detail column open

### Full view

- [ ] Layout columns match Contacts reference (identity left + main; actions in panel title header menus)
- [ ] Quick actions: blue Edit, red Delete (+ red hover), green Duplicate — via `DetailHeaderMenus` (§4)
- [ ] Contacts: Actions / Export / Time log live in DetailPanel title menus only (no shell breadcrumb chip)
- [ ] Contacts: Time log trigger hidden when there are zero entries; count badge when ≥1
- [ ] Delete opens danger confirm; confirm deletes and closes as designed
- [ ] Duplicate opens name dialog; after confirm: panel closes, green list row
- [ ] Green highlight survives list refresh; clears when opening another item
- [ ] **No** system Information card (ID/Created/Updated) in layout
- [ ] **`DetailActivityLog`** present on full view when applicable — last tab `activity` or stack card (§2 Activity)

### View / edit sync

- [ ] Edit uses same card order and tokens as view
- [ ] Inline Save (green) / Cancel; no window form globals
- [ ] Create/edit leave via list, settings, left sidebar, or right-rail Settings shows discard confirm (aligned mail-layout forms: always while form open via `() => true`)
- [ ] Discard confirm runs once (ConfirmDialog confirm must not clear pending via `onOpenChange`)
- [ ] Cancel in edit returns to view (or closes create) per context rules

### List defaults

- [ ] Contacts-class header: Select/Clear + `BulkActionRoundBar` + `RoundExpandableSearch` in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS` (not `ListToolbar`)
- [ ] `selectionEnabled={selectionMode}` on table; bulk delete uses `BulkDeleteModal`
- [ ] Provider lists without bulk: search-only header (`AIProvidersList.tsx` pattern)
- [ ] Empty state Create; **table-only** list (`SortableListTable` / `*ListTable`) — no cards/column layout toggle
- [ ] Clickable table rows are focusable (`tabIndex={0}` via `SortableListTable`); ArrowUp/Down moves between `[data-list-item]`

### Quality gates

- [ ] `npm run lint` clean on touched files
- [ ] Relevant unit/integration tests updated and green
- [ ] Docs updated if behavior standards changed (`CHANGELOG.md` when shipping)

---

## What must not exist

| Anti-pattern                                           | Replace with                                            |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Delete/Duplicate inside QuickContextPanel              | Full view header menus (`DetailHeaderMenus`)            |
| Sidebar QuickActions / Export / Information / Activity | Header menus; domain cards only in sidebar when needed  |
| `onDuplicate={() => executeDuplicate(item, '')}`       | Open `DuplicateDialog` first                            |
| `setRecentlyDuplicatedId` before `closePanel()`        | closePanel → highlight → close dialog                   |
| `window.submitXxxForm` in `*Form.tsx`                  | Inline Save/Cancel (§3)                                 |
| Form bleed `md:-mx-6` / mismatched padding vs view     | Shared DetailPanel padding + `DETAIL_VIEW_CARD_CLASS`   |
| Full-width filled buttons in Quick actions             | Ghost rows + colored icons                              |
| Deep-link on `[items]` only                            | Pathname-based sync                                     |
| Invented confirm modals for delete/duplicate/bulk      | `ConfirmDialog` / `DuplicateDialog` / `BulkDeleteModal` |

---

## Reference file map

| File                                                                         | Shows                                                                                                                        |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `client/src/core/ui/QuickContextHeaderActions.tsx`                           | Shared quick context Open/Edit/Close + footer CTA                                                                            |
| `client/src/core/ui/dialogStyles.ts`                                         | Dialog header/body/footer layout tokens                                                                                      |
| `client/src/core/ui/DialogHeading.tsx`                                       | Shared dialog title component                                                                                                |
| `client/src/core/ui/DialogRoundButtons.tsx`                                  | Round dialog action buttons                                                                                                  |
| `client/src/components/ui/round-icon-label-button.tsx`                       | Base round pill button                                                                                                       |
| `client/src/plugins/contacts/components/ContactList.tsx`                     | Canonical list header: Select/Clear, BulkActionRoundBar, RoundExpandableSearch                                               |
| `client/src/plugins/contacts/components/ContactDetailHeaderMenus.tsx`        | Contacts view: Actions / Export / Time log in panel title                                                                    |
| `client/src/plugins/contacts/components/ContactView.tsx`                     | Canonical full view (2-col; Information tab + Addresses/Persons; no system ID/Created card; Activity tab)                    |
| `client/src/plugins/ai-providers/components/AIProvidersList.tsx`             | Provider list: search-only header (no Select)                                                                                |
| `client/src/core/ui/PanelTitles.tsx`                                         | `createPanelTitles`; view React nodes before mobile blank; create/edit/settings prefer plugin `getPanelTitle` when non-empty |
| `client/src/core/ui/MainLayout.tsx` / `SidebarBrand` / `MobileShellControls` | App shell without TopBar; brand in sidebar; floating phone/pad Menu + account                                                |
| `client/src/plugins/contacts/components/ContactQuickContextPanel.tsx`        | Mail-layout full-only QC (header card + optional `headerBelow`)                                                              |
| `client/src/plugins/garments/components/GarmentView.tsx`                     | Inventory delegates to tabbed `InventoryQuickContextPanel`; lists PersonMatrix                                               |
| `client/src/plugins/garments/components/GarmentForm.tsx`                     | Inventory create/edit same `?tab=` shell as view (Activity greyed); list form separate                                       |
| `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx`      | Full inventory detail with `?tab=` chips + meta row                                                                          |
| `client/src/plugins/garments/components/GarmentList.tsx`                     | Mail-layout inventory/lists table (no sticky QC)                                                                             |
| `client/src/plugins/garments/context/GarmentProvider.tsx`                    | `usePluginDuplicate`, `getDeleteMessage`, panel open helpers                                                                 |
| `client/src/plugins/tasks/components/TaskQuickContextPanel.tsx`              | Full-only task header card (`TaskDetailHeaderMenus`)                                                                         |
| `client/src/plugins/matches/components/MatchQuickContextPanel.tsx`           | Full-only match header card                                                                                                  |
| `client/src/plugins/teams/components/TeamQuickContextPanel.tsx`              | Full-only team header card                                                                                                   |
| `client/src/plugins/slots/components/SlotsList.tsx` / `SlotView.tsx`         | Mail-layout list                                                                                                             | detail; `SlotDetailHeaderMenus` in view |
| `client/src/core/keyboard/keyboardHandlers.ts`                               | List ArrowUp/Down + Space → row click (not `openForView`)                                                                    |
| `client/src/core/ui/SortableListTable.tsx`                                   | Shared table; `tabIndex={0}` + `data-list-item` when clickable                                                               |
| `client/src/core/ui/detailViewCardStyles.ts`                                 | Shared class tokens                                                                                                          |
| `client/src/core/ui/ConfirmDialog.tsx`                                       | Danger / warning confirms; confirm must not call `onCancel` via `onOpenChange`                                               |
| `client/src/core/ui/DuplicateDialog.tsx`                                     | Rename-on-duplicate dialog                                                                                                   |
| `client/src/core/ui/BulkDeleteModal.tsx`                                     | Multi-select delete                                                                                                          |
| `client/src/core/ui/DetailLayout.tsx`                                        | Multi-column detail shell                                                                                                    |

---

## Related docs

- [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md) — sections 1–12 (deep-link, duplicate, delete, form footer)
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — list shell §0.1, detail panels §3
- [`PLUGIN_RUNTIME_CONVENTIONS.md`](PLUGIN_RUNTIME_CONVENTIONS.md) — panelMode / contentView naming
- [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md) — operator notes for the garments reference plugin
