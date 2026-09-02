# Plugin View Implementation Guide

**Status:** **Obligatorisk** vid ny plugin, list/view/form-implementation och design-alignment av befintliga CRUD-plugins. Läs hela guiden **innan** du skriver List / QuickContext / View / Form. Skippa inte sektioner.

**Purpose:** Complete checklist for implementing list quick-context, full detail view, view/edit layout sync, headers/buttons, and default confirm dialogs when building or aligning a plugin.

**Canonical references (copy, do not invent):**

| Area                          | Primary reference                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **List header (canonical)**   | `client/src/plugins/contacts/components/ContactList.tsx` — Select/Clear, `BulkActionRoundBar`, `RoundExpandableSearch`            |
| Quick context panel           | `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx`                                                           |
| List wiring (split + preview) | `client/src/plugins/contacts/components/ContactList.tsx`, `client/src/plugins/garments/components/GarmentList.tsx`                |
| **Full detail (canonical)**   | `client/src/plugins/contacts/components/ContactView.tsx` — 2-col layout, header menus, no Information/Activity cards              |
| Detail header menus           | `client/src/plugins/contacts/components/ContactDetailHeaderMenus.tsx` (thin wrapper) + `client/src/core/ui/DetailHeaderMenus.tsx` |
| List page shell               | `PLUGIN_PAGE_LIST_SHELL_CLASS` in `client/src/core/ui/pluginPageStyles.ts` (`overflow-x-clip`, not `hidden`)                      |
| Provider list (search-only)   | `client/src/plugins/ai-providers/components/AIProvidersList.tsx` — `RoundExpandableSearch` in header, no Select                   |
| Shared tokens                 | `client/src/core/ui/detailViewCardStyles.ts`                                                                                      |
| Preview hook                  | `client/src/core/hooks/useQuickContextPreview.ts`                                                                                 |

**Read alongside:**

- [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md) — deep-link, duplicate, delete, form footer
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — list shell, typography, detail chrome
- [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](NEW_PLUGIN_INTEGRATION_CHECKLIST.md) — registry / wiring
- [`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`](PLUGIN_DEVELOPMENT_STANDARDS_V2.md) — naming and contracts

**Principle:** Kopiera exakt från referensfilerna. Ändra bara plugin-namn och domänfält. Gissa aldrig layout, knappar eller dialoger.

---

## Mental model

```
List (*List.tsx)
  │  row click (desktop)
  ▼
Quick Context Panel (*QuickContextPanel)     ← sticky aside, preview + light edit
  │  Open full profile / Edit
  ▼
DetailPanel (core shell)
  ├─ panelMode === 'view'  → *View.tsx   (DetailLayout + DetailHeaderMenus in panel title)
  └─ panelMode === 'edit'|'create' → *Form.tsx  (same DetailLayout chrome)
```

Delete, Duplicate, and Export belong in the **full view header menus** (`DetailHeaderMenus`), not in the quick context panel or sidebar cards. Full views do **not** render the system Information card (ID/Created/Updated) or `DetailActivityLog` in the layout (canonical Contacts pattern).

---

## 1. Quick Context Panel (list-side preview)

### When to add one

Add a `*QuickContextPanel` when the entity has enough fields that a sticky preview + light inline edit is useful without opening the full detail panel. Existing implementations: contacts, notes, tasks, requests, teams, matches, slots, garments inventory.

Do **not** put Delete / Duplicate / Export in the quick context panel.

### Props contract

```tsx
{
  item: T;
  onClose?: () => void;
  onOpenFullProfile?: () => void;
  onEdit: () => void;
  variant?: 'list' | 'full'; // default 'list'
  // domain-specific optional callbacks, e.g.:
  // onVariantQuantityChange?: (variantId, quantity) => void | Promise<void>;
  // quantitySaving?: boolean;
}
```

| `variant`          | Behavior                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `'list'` (default) | Show ExternalLink, Close (X), and footer “Open full profile” CTA                                                    |
| `'full'`           | Hide ExternalLink, Close, and footer CTA — used when the same component is embedded as the left column of full view |

### Layout structure

```
Card (DETAIL_VIEW_CARD_CLASS, flex-col; natural height — no max-h / no internal scroll)
├── Header row (border-b, px-4 py-2.5)
│     initials avatar | title | QuickContextHeaderActions (Open / Edit / Close)
├── Body (px-4 py-4) — grows with content; list scrollport sticks the aside (`lg:sticky lg:top-4 self-start`)
│     updated timestamp
│     2×2 fact grid (uppercase labels)
│     domain list / inline editors
│     truncated description + read more
│     amber comment callout
└── Footer (list only): `QuickContextOpenFullFooter` — right-aligned round “Open full profile”
```

### Header (exact pattern)

Use **`QuickContextHeaderActions`** — do not copy ghost `Button` icons.

```tsx
import { QuickContextHeaderActions } from '@/core/ui/QuickContextHeaderActions';

<QuickContextHeaderActions
  onOpen={!isFullView && onOpenFullProfile ? onOpenFullProfile : undefined}
  onEdit={onEdit}
  onClose={!isFullView && onClose ? onClose : undefined}
  editLabel={t('common.edit')}
  closeLabel={t('common.close')}
/>;
```

| Control   | Expansion                                     |
| --------- | --------------------------------------------- |
| **Open**  | `alwaysExpanded` (`common.open`)              |
| **Edit**  | Collapsed; label on hover                     |
| **Close** | Collapsed icon-only (`expandOnHover={false}`) |

Footer (list variant only):

```tsx
import { QuickContextOpenFullFooter } from '@/core/ui/QuickContextHeaderActions';

{
  !isFullView && onOpenFullProfile ? (
    <QuickContextOpenFullFooter onOpen={onOpenFullProfile} />
  ) : null;
}
```

### Fact grid labels

Reuse `DETAIL_FIELD_LABEL_CLASS` / `DETAIL_FIELD_VALUE_CLASS` from `detailViewCardStyles.ts`, or the equivalent uppercase micro-label used in inventory:

```tsx
const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
```

Fact grid: `grid grid-cols-2 gap-x-4 gap-y-3`.

### Description truncation

- Preview budget: `LIST_CONTENT_PREVIEW_CHARS = 1200` (same as notes/tasks).
- In `'list'` mode, show “Read more” / “Show less” toggle when truncated.
- In `'full'` mode, show full text (no toggle).

### Comment callout

```tsx
<div className={DETAIL_NOTE_CALLOUT_CLASS}>
  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
    {comment}
  </p>
</div>
```

### Footer CTA (list mode only)

Use **`QuickContextOpenFullFooter`** (see Header section above) — right-aligned round button, `alwaysExpanded`, label `common.openFullProfile`. Do not use full-width primary `Button` rows.

### Hook: `useQuickContextPreview`

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

**Required row attributes:** `data-list-item`, `data-plugin-name`, `tabIndex={0}` when the row is clickable, `role="button"`. Shared table: `SortableListTable` sets `tabIndex={0}` when `onRowClick` is set. Cards already use `tabIndex={0}` on `*ListItem`.

### Wiring in `*List.tsx`

Use the **Contacts list header** (§4) — not `ListToolbar` — above the split. Outer page shell must use `PLUGIN_PAGE_LIST_SHELL_CLASS` (`overflow-x-clip` — `overflow-x-hidden` breaks sticky). Do **not** nest the header row inside a shrinking flex child.

Canonical quick-context split (Contacts / Tasks / Notes / …): **50/50 grid**, sticky only in **list** view.

```tsx
<div
  className={cn(
    'grid items-start gap-4',
    showQuickContext && previewItem ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
  )}
>
  {showQuickContext && previewItem ? (
    <aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">
      <MyPluginQuickContextPanel
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onOpenFullProfile={() =>
          markPendingAndOpen(previewItem, () =>
            attemptNavigation(() => openMyPluginForView(previewItem)),
          )
        }
        onEdit={() =>
          markPendingAndOpen(previewItem, () =>
            attemptNavigation(() => openMyPluginForEdit(previewItem)),
          )
        }
      />
    </aside>
  ) : null}
  <div className="flex min-w-0 flex-col gap-3">
    {/* table or card grid only; pass activeId = previewItem?.id */}
  </div>
</div>
```

Do **not** sticky the quick-context panel in full detail view — sticky is list-only.

### Active row highlight

Pass `active*Id={previewItem?.id ?? null}` into `*ListItem` / `*ListTable` so the selected row shows an active ring while the quick context is open. Keep bulk selection available while the panel is open.

### Checklist — Quick Context

- [ ] Component lives at `plugins/<name>/components/*QuickContextPanel.tsx`
- [ ] Props include `item`, `onEdit`, optional `onClose` / `onOpenFullProfile`, `variant?: 'list' | 'full'`
- [ ] Uses `DETAIL_VIEW_CARD_CLASS` on the outer `Card`
- [ ] Header uses `QuickContextHeaderActions` (Open expanded; Edit hover-expand; Close icon-only)
- [ ] Footer uses `QuickContextOpenFullFooter` when `variant !== 'full'`
- [ ] No Delete / Duplicate / Export in the panel
- [ ] List uses `useQuickContextPreview` + 50/50 `lg:grid-cols-2` with sticky `<aside className="min-w-0 self-start lg:sticky lg:top-4 lg:z-10">`
- [ ] Outer list shell uses `PLUGIN_PAGE_LIST_SHELL_CLASS` (not hardcoded `overflow-x-hidden`)
- [ ] Active row id synced to preview; bulk selection may run while panel is open
- [ ] i18n: `common.open`, `common.openFullProfile`, `common.edit`, `common.close`, `common.select`, `common.clear`; plugin keys for readMore / showLess in **en** and **sv**
- [ ] List header follows §4 (Select/Clear + BulkActionRoundBar + RoundExpandableSearch) — not `ListToolbar`

---

## 2. Full Detail View (`*View.tsx`)

### Shell

Full view renders inside core `DetailPanel` (wired by `AppContent` + `pluginRegistry`). The view body uses `DetailLayout`:

```tsx
<DetailLayout
  leftSidebar={/* identity + properties + description (quick context variant="full") */}
  sidebar={/* optional: related entities / domain cards only — no QuickActions, Export, Information, Activity */}
>
  {/* optional main column: primary working content (e.g. variants, linked items) */}
</DetailLayout>
```

| Prop              | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `leftSidebar`     | Identity header + details/properties cards            |
| `children` (main) | Primary working content when a third column is needed |
| `sidebar`         | Optional domain/relations cards only (when needed)    |

**Detail header menus (platform):** full-view **Actions / Export** (and plugin-specific extras like Contacts **Time log**) live in the detail **panel title** slot via `pluginContext.getPanelTitle` → `DetailHeaderMenus` (or a thin `*DetailHeaderMenus` wrapper). Do **not** put Quick Actions / Export as sidebar cards. Do **not** render the system **Information** card (ID/Created/Updated) or **`DetailActivityLog`** in full view — canonical pattern matches Contacts. Sticky preview belongs on the **list** quick-context aside only.

Desktop columns share the same top edge (`items-start`). On phone, column 3 (`sidebar` / `rightSidebar`) stacks last via `order-*`.

**App right rail:** Fixed narrow tool strip with slide-out flyouts (User / Theme / Settings → `/settings` / Pomodoro / Timer). Plugin `sidebar` content stays inline in the detail grid — it is not portaled into the rail.

**Limits (verified):** tools/flyouts are desktop-rail-only (unavailable on phone/pad); Settings navigates to Core Settings (`navigateToSettings`) rather than an in-rail settings panel; Form/View `sidebar` columns stay inline (no `detailLayoutPortal`).

Do **not** put primary content properties only in the right sidebar — see §6 in `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`.

### Cards and sections

- Outer cards: `<Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>`
- Sections: `<DetailSection title={…} icon={…} subtleTitle className="p-4">`
- Field values: `DETAIL_FIELD_VALUE_CLASS`
- Property rows: `DETAIL_PROP_ROW_CLASS`
- Notes/comments: `DETAIL_NOTE_CALLOUT_CLASS`
- Info rows: `DETAIL_INFO_ROW_CLASS`
- Quick action rows: `DETAIL_QUICK_ACTION_ROW_CLASS`

### Identity block (left column header)

Match quick context: initials avatar (`h-11 w-11`) + `text-lg font-semibold` title inside a card header with `border-b border-border/50 px-4 py-3`.

### Sidebar order (when `sidebar` is used)

Full views follow the **Contacts canonical layout**: Actions / Export / plugin extras in **header menus** (§4); **no** system Information card; **no** `DetailActivityLog`.

When a plugin still passes `sidebar`, limit it to **domain content** only, for example:

1. **Related entities** — mentions, assignees, links (`QuickContextLinkTile` when applicable)
2. **Domain sections** — plugin-specific cards (not system metadata)

Do **not** add sidebar QuickActions, ExportOptions, system Information (ID/Created/Updated), or DetailActivityLog to new work. Legacy sidebar quick-action cards are deprecated (§4).

**Guides exception:** domain sections under `guides.information.*` (costs, generated languages) are **domain fields**, not the system Information card — they may remain in Guides full view.

Sidebar spacing: `space-y-4` (Contacts/inventory) or `space-y-6` — stay consistent within the plugin.

### Checklist — Full View

- [ ] Uses `DetailLayout` with correct column roles (Contacts-class: often 2-col, no `sidebar` or domain-only `sidebar`)
- [ ] All content cards use `DETAIL_VIEW_CARD_CLASS`
- [ ] Actions / Export in `DetailHeaderMenus` via `getPanelTitle` — **not** sidebar QuickActions / Export cards
- [ ] **No** system Information card (ID/Created/Updated) in layout
- [ ] **No** `DetailActivityLog` in layout
- [ ] Delete / Duplicate dialogs live in the view or header-menu wrapper (see §5)

---

## 3. View / Edit layout sync (`*Form.tsx`)

**Rule:** Create/edit chrome must match view chrome so switching modes does not jump layout.

### Shared rules

| Rule                                 | Detail                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same `DetailLayout`                  | Same column structure as view (main + optional sidebar)                                                                                                                            |
| Same card tokens                     | `DETAIL_VIEW_CARD_CLASS` per section                                                                                                                                               |
| Same section titles/icons/order      | Details, variants, description, etc.                                                                                                                                               |
| No bleed shell                       | No `md:-mx-6`, no extra outer padding — content sits in DetailPanel (`px-2 sm:px-3` phone / `px-6` pad/desktop)                                                                    |
| No `PANEL_MAX_WIDTH` on form main    | Avoid constraining create/edit differently from view                                                                                                                               |
| No nested max-h scroll in form cards | Phone/desktop: form cards grow with content (same as view); page scroll only — do not use `max-h-[calc(100vh-…)]` + inner `overflow-y-auto` on identity cards                      |
| Edit sidebar                         | Prefer Contacts-class pattern: **2 columns** (`leftSidebar` content + main properties); **no** system Information / Activity in edit or view. Keep tokens/Save-Cancel rules below. |
| Create                               | Same chrome as edit when the plugin uses 2-column edit (e.g. Contacts, Invoices); otherwise single column OK                                                                       |
| Field grids on phone                 | Prefer `grid-cols-1 … sm:grid-cols-2` / `md:grid-cols-2` so edit matches view stacking                                                                                             |

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
- [ ] Inline Save/Cancel present; window globals **absent**
- [ ] Button size `h-9 text-xs px-3`; Save uses green primary classes above
- [ ] Edit mode has no QuickActions; no system Information / Activity cards (Contacts-class 2-col edit)
- [ ] Create mode has no sidebar / full width
- [ ] Unsaved-changes warning on navigate away when dirty

---

## 4. Headers and buttons

### List page header (canonical — CRUD lists)

**Reference:** `ContactList.tsx`. Do **not** use `ListToolbar` as the default list header (`ListToolbar` is **legacy / exception only**, e.g. plugin template).

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
  {/* optional sort controls */}
  <ListColumnLayoutToggle
    columnCount={columnCount}
    listViewMode={listViewMode}
    onSelectColumns={setColumnCount}
    onSelectTable={() => setListViewMode('table')}
    columnAriaLabel={(count) => t(`myPlugin.columns${count}`)}
    tableAriaLabel={t('common.tableView')}
  />
  <ExpandableIconButton icon={Plus} label={t('myPlugin.add')} variant="soft" alwaysExpanded onClick={…} />
</div>
```

**Layout toggle:** desktop only **3 | table** (`ListColumnLayoutToggle`). Persisted cards preference is always `columnCount: 3`. Pass `{ quickContextOpen }` into `useEffectiveColumnCount` / `useEffectiveCardColumnCount` so the card grid shows **2** columns while quick context is open (preference unchanged). Hidden on pad/phone (effective clamps apply).

**Chrome:** shared shell tokens `LIST_LAYOUT_TOGGLE_SHELL_CLASS` / `LIST_LAYOUT_TOGGLE_DIVIDER_CLASS` in `pluginPageStyles.ts` — white pill (`bg-white` / `dark:bg-slate-950`), selected half uses `bg-primary/10 text-primary`.

**Settings categories:** use `PluginSettingsPageShell` round category buttons whenever `categories.length >= 1` (keep the button chrome even for a single category, e.g. Tasks Import-only). Do **not** add a settings **View** tab for cards/table — that lives on the list header (`ListColumnLayoutToggle`).

**Table column visibility:** optional per-user `tableColumns: { order, hidden }` on the plugin settings category (Contacts, Notes, Tasks, Requests, Teams, Matches, Garments inventory, Estimates, Invoices, Slots, Cups). Persist the **full** object via `updateSettings` (JSONB shallow merge). Normalize unknown/missing prefs to defaults; keep a required identity column always visible (`name` / `title` / `age_group` / `matchup` / `articleName` / `estimateNumber` / `invoiceNumber`). Settings UI: shared `TableColumnsSettingsSection` (HTML5 drag-and-drop + toggles) or plugin-local equivalent. Apply order/visibility in `*ListTable` only — cards view ignores `tableColumns`. Do not put column pickers on the list toolbar in this pattern. Shared helpers: `client/src/core/list/tableColumnsPref.ts`. Garments **list** person-matrix column settings (identity + Paid/custom checkboxes) are separate — see [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md) (Person rows).

### Panel / page titles

- List page title and primary Add action come from `MainLayout` / content header wiring in context (`getPanelTitle`, content view keys).
- Plugins with `contentFlush: true` own in-page padding and often render their own list header (title + count + Settings + Add).
- Detail panel title/subtitle come from context helpers consumed by `AppContent` → `createPanelTitles` (`PanelTitles.tsx`).
- The app shell has **no TopBar breadcrumbs**. When `getPanelTitle` returns a React node (`DetailHeaderMenus`), that node is for the DetailPanel title only — never inject action bars into shell chrome.

### Detail header menus (platform reference)

Shared primitive: `client/src/core/ui/DetailHeaderMenus.tsx`. Plugin wrappers (e.g. `ContactDetailHeaderMenus`, `TaskDetailHeaderMenus`) supply actions/export/extra menus + dialogs. Wire via `Provider.getPanelTitle` in view mode; `PanelTitles` prefers non-string React nodes **before** the mobile “blank title” early-return.

**Phone layout:** trigger row (`Actions` / `Export` / extras) scrolls horizontally when needed. When a menu is open, its action pills render **inline beside the active trigger** (horizontal scroll), not on a separate full-width row below — keeps one compact header band on narrow viewports. **Desktop (`md+`):** triggers wrap; open submenu pills sit on a **second row** below the triggers.

| Trigger     | Idle / open                                                                   | Expanded row                                                                                                        |
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
- [ ] Quick context header uses `QuickContextHeaderActions` (not ghost `h-8 w-8` icons)
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

- Form: `useUnsavedChanges` + dirty tracking.
- Global discard dialog is owned by `AppContent`; plugin must register dirty state correctly.
- Local form confirm (optional, garments-style) for cancel with pending edits also uses `variant="warning"`.

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

`information` / `activity` keys are optional — full views no longer render system Information or Activity log cards (Contacts canonical). Domain keys (e.g. `guides.information.*`) are separate.

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

- [ ] Desktop row click opens sticky panel; compact opens full view
- [ ] Same desktop row again (click or Space) closes the panel
- [ ] Space on a focused list row does **not** open full view on desktop
- [ ] Active row ring matches preview
- [ ] ExternalLink / footer opens full profile; Edit opens edit
- [ ] Close clears preview; bulk selection still works with panel open
- [ ] Closing full view restores preview when `markPendingAndOpen` was used
- [ ] No delete/duplicate controls in the panel

### Full view

- [ ] Layout columns match Contacts reference (identity left + main; actions in panel title header menus)
- [ ] Quick actions: blue Edit, red Delete (+ red hover), green Duplicate — via `DetailHeaderMenus` (§4)
- [ ] Contacts: Actions / Export / Time log live in DetailPanel title menus only (no shell breadcrumb chip)
- [ ] Contacts: Time log trigger hidden when there are zero entries; count badge when ≥1
- [ ] Delete opens danger confirm; confirm deletes and closes as designed
- [ ] Duplicate opens name dialog; after confirm: panel closes, green list row
- [ ] Green highlight survives list refresh; clears when opening another item
- [ ] **No** system Information card (ID/Created/Updated) in layout
- [ ] **No** `DetailActivityLog` in layout

### View / edit sync

- [ ] Edit uses same card order and tokens as view
- [ ] Inline Save (green) / Cancel; no window form globals
- [ ] Dirty navigate shows unsaved warning
- [ ] Cancel in edit returns to view (or closes create) per context rules

### List defaults

- [ ] Contacts-class header: Select/Clear + `BulkActionRoundBar` + `RoundExpandableSearch` in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS` (not `ListToolbar`)
- [ ] `selectionEnabled={selectionMode}` on table; bulk delete uses `BulkDeleteModal`
- [ ] Provider lists without bulk: search-only header (`AIProvidersList.tsx` pattern)
- [ ] Empty state Create; cards/table toggle per plugin
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
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `client/src/core/ui/QuickContextHeaderActions.tsx`                           | Shared quick context Open/Edit/Close + footer CTA                                                                            |
| `client/src/core/ui/dialogStyles.ts`                                         | Dialog header/body/footer layout tokens                                                                                      |
| `client/src/core/ui/DialogHeading.tsx`                                       | Shared dialog title component                                                                                                |
| `client/src/core/ui/DialogRoundButtons.tsx`                                  | Round dialog action buttons                                                                                                  |
| `client/src/components/ui/round-icon-label-button.tsx`                       | Base round pill button                                                                                                       |
| `client/src/plugins/contacts/components/ContactList.tsx`                     | Canonical list header: Select/Clear, BulkActionRoundBar, RoundExpandableSearch                                               |
| `client/src/plugins/contacts/components/ContactDetailHeaderMenus.tsx`        | Contacts view: Actions / Export / Time log in panel title                                                                    |
| `client/src/plugins/contacts/components/ContactView.tsx`                     | Canonical full view (2-col; no Information/Activity cards)                                                                   |
| `client/src/plugins/ai-providers/components/AIProvidersList.tsx`             | Provider list: search-only header (no Select)                                                                                |
| `client/src/core/ui/PanelTitles.tsx`                                         | `createPanelTitles`; view React nodes before mobile blank; create/edit/settings prefer plugin `getPanelTitle` when non-empty |
| `client/src/core/ui/MainLayout.tsx` / `SidebarBrand` / `MobileShellControls` | App shell without TopBar; brand in sidebar; floating phone/pad Menu + account                                                |
| `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx`      | Canonical quick context (header, facts, variants, footer)                                                                    |
| `client/src/plugins/garments/components/GarmentList.tsx`                     | Sticky aside + `useQuickContextPreview` + Contacts-class bulk header                                                         |
| `client/src/plugins/garments/components/GarmentView.tsx`                     | Full inventory detail; header menus; no Information/Activity                                                                 |
| `client/src/plugins/garments/components/GarmentForm.tsx`                     | Form chrome, variant delete confirm, unsaved warning                                                                         |
| `client/src/plugins/garments/context/GarmentProvider.tsx`                    | `usePluginDuplicate`, `getDeleteMessage`, panel open helpers                                                                 |
| `client/src/plugins/tasks/components/TaskQuickContextPanel.tsx`              | Rich quick context + link tiles                                                                                              |
| `client/src/plugins/matches/components/MatchQuickContextPanel.tsx`           | Sport entity quick context + contact/team link tiles                                                                         |
| `client/src/plugins/slots/components/SlotQuickContextPanel.tsx`              | Booking slot quick context                                                                                                   |
| `client/src/plugins/teams/components/TeamQuickContextPanel.tsx`              | Team quick context + responsibles link tiles                                                                                 |
| `client/src/plugins/slots/components/SlotView.tsx`                           | Detail header menus + duplicate pattern                                                                                      |
| `client/src/core/hooks/useQuickContextPreview.ts`                            | Desktop vs compact preview; same-row toggle                                                                                  |
| `client/src/core/keyboard/keyboardHandlers.ts`                               | List ArrowUp/Down + Space → row click (not `openForView`)                                                                    |
| `client/src/core/ui/SortableListTable.tsx`                                   | Shared table; `tabIndex={0}` + `data-list-item` when clickable                                                               |
| `client/src/core/ui/detailViewCardStyles.ts`                                 | Shared class tokens                                                                                                          |
| `client/src/core/ui/ConfirmDialog.tsx`                                       | Danger / warning confirms                                                                                                    |
| `client/src/core/ui/DuplicateDialog.tsx`                                     | Rename-on-duplicate dialog                                                                                                   |
| `client/src/core/ui/BulkDeleteModal.tsx`                                     | Multi-select delete                                                                                                          |
| `client/src/core/ui/DetailLayout.tsx`                                        | Multi-column detail shell                                                                                                    |

---

## Related docs

- [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md) — sections 1–12 (deep-link, duplicate, delete, form footer)
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — list shell §0.1, detail panels §3
- [`PLUGIN_RUNTIME_CONVENTIONS.md`](PLUGIN_RUNTIME_CONVENTIONS.md) — panelMode / contentView naming
- [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md) — operator notes for the garments reference plugin
