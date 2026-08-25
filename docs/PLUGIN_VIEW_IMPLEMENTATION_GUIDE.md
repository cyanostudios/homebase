# Plugin View Implementation Guide

**Status:** **Obligatorisk** vid ny plugin, list/view/form-implementation och design-alignment av befintliga CRUD-plugins. Läs hela guiden **innan** du skriver List / QuickContext / View / Form. Skippa inte sektioner.

**Purpose:** Complete checklist for implementing list quick-context, full detail view, view/edit layout sync, headers/buttons, and default confirm dialogs when building or aligning a plugin.

**Canonical references (copy, do not invent):**

| Area                    | Primary reference                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Quick context panel     | `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx`                                |
| List wiring             | `client/src/plugins/garments/components/GarmentList.tsx`                                               |
| Full detail (inventory) | `client/src/plugins/garments/components/GarmentView.tsx` (`InventoryDetailView`)                       |
| Quick actions / sidebar | `client/src/plugins/slots/components/SlotView.tsx`, `client/src/plugins/tasks/components/TaskView.tsx` |
| Shared tokens           | `client/src/core/ui/detailViewCardStyles.ts`                                                           |
| Preview hook            | `client/src/core/hooks/useQuickContextPreview.ts`                                                      |

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
  ├─ panelMode === 'view'  → *View.tsx   (DetailLayout + QuickActions)
  └─ panelMode === 'edit'|'create' → *Form.tsx  (same DetailLayout chrome)
```

Delete, Duplicate, Export, and Activity Log belong in the **full view**, not in the quick context panel.

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
│     initials avatar | title | ExternalLink? | Edit | X?
├── Body (px-4 py-4) — grows with content; list scrollport sticks the aside (`lg:sticky lg:top-4 self-start`)
│     updated timestamp
│     2×2 fact grid (uppercase labels)
│     domain list / inline editors
│     truncated description + read more
│     amber comment callout
└── Footer (list only): full-width primary “Open full profile”
```

### Header (exact pattern)

```tsx
<div className="flex items-center gap-3">
  <div
    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
    aria-hidden
  >
    {initials}
  </div>
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h3>
  </div>
  {!isFullView && onOpenFullProfile ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={ExternalLink}
      className="h-8 w-8 shrink-0 p-0"
      onClick={onOpenFullProfile}
      aria-label={t('myPlugin.quickContext.openFullProfile')}
    />
  ) : null}
  <Button
    type="button"
    variant="ghost"
    size="sm"
    icon={Edit}
    className="h-8 w-8 shrink-0 p-0"
    onClick={onEdit}
    aria-label={t('common.edit')}
  />
  {!isFullView && onClose ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={X}
      className="h-8 w-8 shrink-0 p-0"
      onClick={onClose}
      aria-label={t('common.close')}
    />
  ) : null}
</div>
```

Icon-only header buttons always use `h-8 w-8 shrink-0 p-0`.

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

```tsx
<div className="border-t border-border/50 px-4 py-3">
  <Button
    type="button"
    variant="primary"
    size="sm"
    className="h-9 w-full text-xs"
    onClick={onOpenFullProfile}
  >
    {t('myPlugin.quickContext.openFullProfile')}
  </Button>
</div>
```

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

| Helper                           | Behavior                                                              |
| -------------------------------- | --------------------------------------------------------------------- |
| `activateRow(item, openForView)` | Desktop → set preview; compact (`max-width: 1023px`) → open full view |
| `markPendingAndOpen(item, open)` | Remember id so closing full view restores the sticky preview          |
| `showQuickContext`               | `true` when preview is set and viewport is not compact                |

### Wiring in `*List.tsx`

Keep `ListToolbar` **full width above** the split. Do **not** nest the toolbar inside `min-w-0 flex-1` (that shrinks search/bulk when the panel opens). Canonical pattern: Requests / Tasks / Teams / Matches.

```tsx
<div className="flex flex-col gap-0 md:gap-3">
  <ListToolbar /* search + bulk — full page width */ />

  <div className="flex items-start gap-4">
    {showQuickContext && previewItem ? (
      <aside className="w-[min(100%,36rem)] shrink-0 self-start lg:sticky lg:top-4">
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
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {/* table or card grid only; pass activeId = previewItem?.id */}
    </div>
  </div>
</div>
```

### Active row highlight

Pass `active*Id={previewItem?.id ?? null}` into `*ListItem` / `*ListTable` so the selected row shows an active ring while the quick context is open. Keep bulk selection available while the panel is open.

### Checklist — Quick Context

- [ ] Component lives at `plugins/<name>/components/*QuickContextPanel.tsx`
- [ ] Props include `item`, `onEdit`, optional `onClose` / `onOpenFullProfile`, `variant?: 'list' | 'full'`
- [ ] Uses `DETAIL_VIEW_CARD_CLASS` on the outer `Card`
- [ ] Header icon buttons are `h-8 w-8 shrink-0 p-0`
- [ ] Footer CTA only when `variant !== 'full'`
- [ ] No Delete / Duplicate / Export in the panel
- [ ] List uses `useQuickContextPreview` + sticky `<aside className="w-[min(100%,36rem)] …">`
- [ ] Active row id synced to preview
- [ ] i18n keys for openFullProfile / readMore / showLess in **en** and **sv**

---

## 2. Full Detail View (`*View.tsx`)

### Shell

Full view renders inside core `DetailPanel` (wired by `AppContent` + `pluginRegistry`). The view body uses `DetailLayout`:

```tsx
<DetailLayout
  leftSidebar={/* identity + properties + description */}
  sidebar={/* QuickActions → Export? → relations → Information → Activity */}
>
  {/* optional main column: primary domain content (e.g. variants) */}
</DetailLayout>
```

| Prop              | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| `leftSidebar`     | Identity header + details/properties cards            |
| `children` (main) | Primary working content when a third column is needed |
| `sidebar`         | Actions, metadata, activity                           |

Desktop columns share the same top edge (`items-start`); sticky preview belongs on the **list** quick-context aside, not on `DetailLayout` columns. On phone, column 3 (`sidebar` / `rightSidebar`) stacks last via `order-*`.

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

### Sidebar order (strict)

1. **QuickActionsCard** — Edit, Delete, Duplicate (+ plugin-specific actions)
2. **ExportOptionsCard** — only if the plugin supports export
3. **Related entities** — mentions, assignees, links (`QuickContextLinkTile` when applicable)
4. **Information** — System ID / Created / Updated (`DETAIL_INFO_ROW_CLASS`, collapsible OK)
5. **DetailActivityLog** — required for CRUD plugins logged via `activityLogMiddleware` (`limit={30}`, `showClearButton`, `refreshKey` from `updatedAt`/id)

Sidebar spacing: `space-y-4` (slots/garments) or `space-y-6` (tasks) — stay consistent within the plugin.

### Information card

```tsx
<Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
  <DetailSection
    title={t('myPlugin.information')}
    icon={Info}
    subtleTitle
    className="p-4"
    collapsible
  >
    <div>
      <div className={DETAIL_INFO_ROW_CLASS}>
        <span className="text-slate-500 dark:text-slate-400">ID</span>
        <span className="font-mono font-semibold text-foreground">
          {formatDisplayNumber('my-plugin', item.id)}
        </span>
      </div>
      {/* Created / Updated with t('common.created') / t('common.updated') */}
    </div>
  </DetailSection>
</Card>
```

### Checklist — Full View

- [ ] Uses `DetailLayout` with correct column roles
- [ ] All content cards use `DETAIL_VIEW_CARD_CLASS`
- [ ] Sidebar order matches the list above
- [ ] QuickActions is a separate function component (or clear card block), not ad-hoc full-width buttons
- [ ] Information uses `DETAIL_INFO_ROW_CLASS` + mono values
- [ ] Activity log present when the plugin’s API uses activity middleware
- [ ] Delete / Duplicate dialogs live in the view (see §5)

---

## 3. View / Edit layout sync (`*Form.tsx`)

**Rule:** Create/edit chrome must match view chrome so switching modes does not jump layout.

### Shared rules

| Rule                                 | Detail                                                                                                                                                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same `DetailLayout`                  | Same column structure as view (main + optional sidebar)                                                                                                                                                                                                                                          |
| Same card tokens                     | `DETAIL_VIEW_CARD_CLASS` per section                                                                                                                                                                                                                                                             |
| Same section titles/icons/order      | Details, variants, description, etc.                                                                                                                                                                                                                                                             |
| No bleed shell                       | No `md:-mx-6`, no extra outer padding — content sits in DetailPanel (`px-2 sm:px-3` phone / `px-6` pad/desktop)                                                                                                                                                                                  |
| No `PANEL_MAX_WIDTH` on form main    | Avoid constraining create/edit differently from view                                                                                                                                                                                                                                             |
| No nested max-h scroll in form cards | Phone/desktop: form cards grow with content (same as view); page scroll only — do not use `max-h-[calc(100vh-…)]` + inner `overflow-y-auto` on identity cards                                                                                                                                    |
| Edit sidebar                         | Prefer Contacts-class pattern: **2 columns** (`leftSidebar` content + main properties); **no** Information/Activity in edit (those stay in full view). Older “Information card only” row is superseded for Contacts / Tasks / Notes / Requests / Invoices — keep tokens/Save-Cancel rules below. |
| Create                               | Same chrome as edit when the plugin uses 2-column edit (e.g. Contacts, Invoices); otherwise single column OK                                                                                                                                                                                     |
| Field grids on phone                 | Prefer `grid-cols-1 … sm:grid-cols-2` / `md:grid-cols-2` so edit matches view stacking                                                                                                                                                                                                           |

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
- [ ] Edit mode has no QuickActions; Information/Activity stay in full view (Contacts-class 2-col edit) unless a plugin documents an exception
- [ ] Create mode has no sidebar / full width
- [ ] Unsaved-changes warning on navigate away when dirty

---

## 4. Headers and buttons

### Panel / page titles

- List page title and primary Add action come from `MainLayout` / content header wiring in context (`getPanelTitle`, content view keys).
- Plugins with `contentFlush: true` own in-page padding and often render their own list header (title + count + Settings + Add).
- Detail panel title/subtitle come from context helpers consumed by `AppContent`.

### Quick actions — icon colors (strict)

| Action       | Icon CSS                               | Button / hover                                                 |
| ------------ | -------------------------------------- | -------------------------------------------------------------- |
| Edit         | `text-blue-600 dark:text-blue-400`     | `DETAIL_QUICK_ACTION_ROW_CLASS` / `hover:bg-muted`             |
| Delete       | `text-red-600 dark:text-red-400`       | `h-9 … hover:bg-red-50 dark:hover:bg-red-950/30` (red text OK) |
| Duplicate    | `text-green-600 dark:text-green-400`   | `DETAIL_QUICK_ACTION_ROW_CLASS`                                |
| Send message | `text-violet-600 dark:text-violet-400` | muted hover                                                    |
| Send email   | `text-red-600 dark:text-red-400`       | muted hover                                                    |

All quick-action buttons:

- `variant="ghost"` `size="sm"`
- Prefer `DETAIL_QUICK_ACTION_ROW_CLASS` (`h-9 justify-start rounded-md px-3 text-xs …`)
- **Never** full-width filled primary buttons inside Quick actions

### List toolbar buttons

```tsx
<Button variant="secondary" size="sm" icon={Settings} className="h-9 text-xs px-3">
  {t('common.settings')}
</Button>
```

Use `icon` prop + label for Settings / primary toolbar actions — not icon-only.

### Bulk selection actions

Neutral bulk actions: hover `bg-primary/10` + `text-primary`.  
Clear selection and Delete: red underline / red hover language matching garments/tasks lists.

### Checklist — Buttons

- [ ] Quick action icon colors match the table
- [ ] Delete has red hover background
- [ ] No `variant="default"` full-width rows in Quick actions
- [ ] List toolbar secondary buttons are `h-9 text-xs px-3`
- [ ] Quick context header controls are icon-only `h-8 w-8`

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

- QuickActions Delete → `setShowDeleteConfirm(true)` only (never delete immediately).
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

Opened from list toolbar bulk Delete — not from the detail sidebar.

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

### Checklist — Dialogs

- [ ] Item delete: `ConfirmDialog` + `variant="danger"` + `getDeleteMessage`
- [ ] Duplicate: `DuplicateDialog` + order `closePanel` → highlight → close dialog
- [ ] List green highlight after duplicate
- [ ] Unsaved changes: warning variant / nav guard
- [ ] Bulk delete: `BulkDeleteModal` from list selection
- [ ] Nested row delete: local danger confirm
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
  "information": "…",
  "activity": "…",
  "deleteConfirmThis": "…",
  "deleteConfirmNamed": "…"
}
```

### Quick context

```json
"myPlugin": {
  "quickContext": {
    "openFullProfile": "…",
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
- [ ] Active row ring matches preview
- [ ] ExternalLink / footer opens full profile; Edit opens edit
- [ ] Close clears preview; bulk selection still works with panel open
- [ ] Closing full view restores preview when `markPendingAndOpen` was used
- [ ] No delete/duplicate controls in the panel

### Full view

- [ ] Layout columns match reference (identity left, actions right)
- [ ] Quick actions: blue Edit, red Delete (+ red hover), green Duplicate
- [ ] Delete opens danger confirm; confirm deletes and closes as designed
- [ ] Duplicate opens name dialog; after confirm: panel closes, green list row
- [ ] Green highlight survives list refresh; clears when opening another item
- [ ] Information shows ID / Created / Updated
- [ ] Activity log present when required

### View / edit sync

- [ ] Edit uses same card order and tokens as view
- [ ] Inline Save (green) / Cancel; no window form globals
- [ ] Dirty navigate shows unsaved warning
- [ ] Cancel in edit returns to view (or closes create) per context rules

### List defaults

- [ ] `ListToolbar` + cards/table toggle + empty state Create
- [ ] Bulk delete uses `BulkDeleteModal`
- [ ] Toolbar buttons `h-9 text-xs px-3`

### Quality gates

- [ ] `npm run lint` clean on touched files
- [ ] Relevant unit/integration tests updated and green
- [ ] Docs updated if behavior standards changed (`CHANGELOG.md` when shipping)

---

## What must not exist

| Anti-pattern                                       | Replace with                                            |
| -------------------------------------------------- | ------------------------------------------------------- |
| Delete/Duplicate inside QuickContextPanel          | Full view QuickActions only                             |
| `onDuplicate={() => executeDuplicate(item, '')}`   | Open `DuplicateDialog` first                            |
| `setRecentlyDuplicatedId` before `closePanel()`    | closePanel → highlight → close dialog                   |
| `window.submitXxxForm` in `*Form.tsx`              | Inline Save/Cancel (§3)                                 |
| Form bleed `md:-mx-6` / mismatched padding vs view | Shared DetailPanel padding + `DETAIL_VIEW_CARD_CLASS`   |
| Full-width filled buttons in Quick actions         | Ghost rows + colored icons                              |
| Deep-link on `[items]` only                        | Pathname-based sync                                     |
| Invented confirm modals for delete/duplicate/bulk  | `ConfirmDialog` / `DuplicateDialog` / `BulkDeleteModal` |

---

## Reference file map

| File                                                                    | Shows                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `client/src/plugins/garments/components/InventoryQuickContextPanel.tsx` | Canonical quick context (header, facts, variants, footer)    |
| `client/src/plugins/garments/components/GarmentList.tsx`                | Sticky aside + `useQuickContextPreview` + bulk delete        |
| `client/src/plugins/garments/components/GarmentView.tsx`                | Full inventory detail, QuickActions, Confirm + Duplicate     |
| `client/src/plugins/garments/components/GarmentForm.tsx`                | Form chrome, variant delete confirm, unsaved warning         |
| `client/src/plugins/garments/context/GarmentProvider.tsx`               | `usePluginDuplicate`, `getDeleteMessage`, panel open helpers |
| `client/src/plugins/tasks/components/TaskQuickContextPanel.tsx`         | Rich quick context + link tiles                              |
| `client/src/plugins/matches/components/MatchQuickContextPanel.tsx`      | Sport entity quick context + contact/team link tiles         |
| `client/src/plugins/slots/components/SlotQuickContextPanel.tsx`         | Booking slot quick context                                   |
| `client/src/plugins/teams/components/TeamQuickContextPanel.tsx`         | Team quick context + responsibles link tiles                 |
| `client/src/plugins/slots/components/SlotView.tsx`                      | Sidebar QuickActions + duplicate pattern                     |
| `client/src/core/hooks/useQuickContextPreview.ts`                       | Desktop vs compact preview behavior                          |
| `client/src/core/ui/detailViewCardStyles.ts`                            | Shared class tokens                                          |
| `client/src/core/ui/ConfirmDialog.tsx`                                  | Danger / warning confirms                                    |
| `client/src/core/ui/DuplicateDialog.tsx`                                | Rename-on-duplicate dialog                                   |
| `client/src/core/ui/BulkDeleteModal.tsx`                                | Multi-select delete                                          |
| `client/src/core/ui/DetailLayout.tsx`                                   | Multi-column detail shell                                    |

---

## Related docs

- [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md) — sections 1–12 (deep-link, duplicate, delete, form footer)
- [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) — list shell §0.1, detail panels §3
- [`PLUGIN_RUNTIME_CONVENTIONS.md`](PLUGIN_RUNTIME_CONVENTIONS.md) — panelMode / contentView naming
- [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md) — operator notes for the garments reference plugin
