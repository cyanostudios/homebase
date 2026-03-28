# Plugin Development Standards

## Overview

This document defines MANDATORY naming conventions and patterns for all Homebase plugins. These standards enable the automated plugin system and ensure security enforcement through core services.

## Key Principles

- ✅ Core File Updates: ZERO (fully automated)
- 🎯 Success Rate: 100% when following these conventions exactly
- 🔒 Security: Enforced at every layer
- 📦 SDK: Use @homebase/core for stable interfaces
- ⚠️ **Platform stability first:** Do not break navigation, panels, or core flows (see `LESSONS_LEARNED.md`).
- 🧩 **Golden template first:** New plugins must start from `templates/plugin-frontend-template` and `templates/plugin-backend-template`.

## Plugin Contract v2 (official)

- Panel modes are standardized: `'create' | 'edit' | 'view' | 'settings'`.
- **Create/edit:** The `*Form` component owns **inline Save/Cancel** buttons. `PanelFooter` does not render form actions for those modes.
- **Settings:** Only `*SettingsForm` registers `window.submit<Plugins>Form` / `window.cancel<Plugins>Form` for `PanelFooter` integration (settings mode).
- Each plugin must expose `Form` in `components` inside `client/src/core/pluginRegistry.ts`.
- Detail view must follow shared shell patterns:
  - `DetailLayout` main + sidebar
  - `DetailSection` for grouped content
  - `ConfirmDialog` for destructive actions

See `NEW_PLUGIN_INTEGRATION_CHECKLIST.md` for the exact integration flow.

🔒 CRITICAL REQUIREMENTS

0. **Do not break the platform.** Navigation, panel behaviour, and basic CRUD must keep working. Prefer reading code and fixing root cause over guesswork.

1. Plugin Registry Entry
   Every plugin MUST be registered in client/src/core/pluginRegistry.ts:
   {
   name: 'my-plugins', // PLURAL form required
   Provider: MyPluginProvider,
   hook: useMyPlugins,
   panelKey: 'isMyPluginPanelOpen', // Must match context boolean exactly
   components: {
   List: MyPluginList,
   Form: MyPluginForm,
   View: MyPluginView,
   },
   navigation: { // REQUIRED for sidebar visibility
   category: 'Main', // or 'Business', 'Tools', etc.
   label: 'My Plugins',
   icon: MyIcon, // Import from lucide-react
   order: 1, // Order within category
   }
   }

   ⚠️ IMPORTANT: After registering a plugin:
   - The plugin will automatically appear in the sidebar for users who have it enabled
   - ✅ AUTOMATED: Plugin name is automatically added to server/core/config/constants.js via filesystem discovery
     - Only directories with plugin.config.js are included (validated)
     - Plugins are sorted alphabetically for consistency
     - Some plugins (read-only, experimental) are excluded from DEFAULT_USER_PLUGINS
   - Superadmin (admin@homebase.se) needs the plugin added to their user_plugin_access

- Skapa/kör ett litet script under `scripts/` som lägger till raden i `user_plugin_access` (följ mönstret från andra scripts i repot)

## 2. Context Interface (mandatory properties)

```ts
interface MyPluginContextType {
  // Panel State - exact naming required
  isMyPluginPanelOpen: boolean; // Plugin-specific (plural in name)
  currentMyPlugin: MyPlugin | null; // Plugin-specific (singular)
  panelMode: 'create' | 'edit' | 'view' | 'settings'; // Generic; add 'settings' if plugin has a settings screen
  validationErrors: ValidationError[]; // Standard validation array

  // Data State
  myPlugins: MyPlugin[]; // Plugin data array (plural)

  // CRUD Functions - exact naming required
  openMyPluginPanel: (item: MyPlugin | null) => void;
  openMyPluginForEdit: (item: MyPlugin) => void;
  openMyPluginForView: (item: MyPlugin) => void;
  closeMyPluginPanel: () => void;
  saveMyPlugin: (data: any) => Promise<boolean>;
  deleteMyPlugin: (id: string) => Promise<void>;
  duplicateMyPlugin?: (item: MyPlugin) => Promise<void>; // Optional
  clearValidationErrors: () => void;
}
```

## 3. Backend integration with `@homebase/core` SDK

MANDATORY: Plugins ska använda `@homebase/core` SDK för infrastruktur (DB, logger, context).

```js
const { Logger, Database, Context } = require('@homebase/core');

const db = Database.get(req);
const userId = Context.getUserId(req);

Logger.info('Operation completed', { userId });
const result = await db.query('SELECT * FROM items', []);
```

NEVER:

```js
// ❌ WRONG - Direct imports or ServiceManager
const ServiceManager = require('../../server/core/ServiceManager');
const db = require('../../server/database');
const fs = require('fs');
```

## 4. Security requirements

MANDATORY middleware på alla routes:

```js
router.get('/', requirePlugin('my-plugin'), controller.getItems);
router.post('/', requirePlugin('my-plugin'), csrfProtection, controller.create);
router.put('/:id', requirePlugin('my-plugin'), csrfProtection, controller.update);
router.delete('/:id', requirePlugin('my-plugin'), csrfProtection, controller.delete);
```

MANDATORY input validation:

```js
const { body } = require('express-validator');

router.post(
  '/',
  [
    requirePlugin('my-plugin'),
    csrfProtection,
    body('title').trim().notEmpty().isLength({ max: 255 }).escape(),
    body('content').optional().trim().isLength({ max: 5000 }),
    validateRequest,
  ],
  controller.create,
);
```

## 5. Frontend: Mentions and export (best practice)

- **Mentions:** Use the core components `MentionTextarea` and `MentionContent` from `@/core/ui/` for any @-mention of contacts. Do not duplicate mention input or display logic in plugin components. See [MENTIONS_AND_CROSS_PLUGIN_UI.md](MENTIONS_AND_CROSS_PLUGIN_UI.md).
- **Export:** Implement export via `exportFormats` and `onExportItem` in the plugin context, plus an export config (e.g. `myPluginExportConfig`) used by list and detail actions. Keep export actions in list/detail consistent with other plugins (icon + label, same sizes). If the plugin exports from detail actions, prefer `exportItems(...)` + a plugin export config (see existing plugins like Notes/Tasks/Contacts).

### Export pattern (canonical)

När en plugin stödjer export (single-item och/eller bulk) ska vi använda samma wiring som Notes/Tasks/Contacts:

1. **Export config (per plugin)**: en fil som beskriver format, filename och hur data serialiseras.
   - Exempel: `client/src/plugins/notes/utils/noteExportConfig.ts`
2. **Context** exponerar:
   - `exportFormats: ExportFormat[]` (t.ex. `['txt', 'csv', 'pdf']`)
   - `onExportItem: (format, item) => Promise<void>`
3. **List view** använder samma config för bulk export (valda items) via `exportItems(...)`.
4. **Detail actions (header/footer)** renderar export-formatknappar utifrån `exportFormats` och anropar `onExportItem(format, currentItem)`.

**Varför:** Ger konsekvent UX (samma knappar, samma formatnamn) och gör export lätt att återanvända mellan list och detail.

## 6. List and toolbar UI (mandatory for consistency)

Use the same UI components and styling as other plugins so list views and toolbars look and behave the same across the app.

- **Toolbar:** Use `ContentToolbar` from `@/core/ui/ContentToolbar` in the list component. Set it via `setHeaderTrailing` from `useContentLayout()` inside a `useEffect`, and return a cleanup that calls `setHeaderTrailing(null)`.
- **Toolbar buttons:** Use the shared `Button` from `@/components/ui/button` with:
  - `variant="secondary"` for secondary actions (e.g. Settings, Grid, List, Import).
  - `size="sm"`.
  - `className="h-9 text-xs px-3"` for consistent height and label size.
  - `icon={IconComponent}` for the icon (e.g. `Settings`, `Grid3x3`, `List` from `lucide-react`), and put the label as children (e.g. `Settings`, `Grid`, `List`).
- **List layout:** Use `Card` from `@/components/ui/card` for the list container with plugin semantic class (e.g. `plugin-my-plugins`). Use `Table` / `TableHead` / `TableBody` / `TableRow` / `TableCell` for list view and `DetailCard` or `Card` for grid view. See [UI_AND_UX_STANDARDS_V3.md](UI_AND_UX_STANDARDS_V3.md) for checkbox column width (`w-12`), row hover, and card padding.
- **Settings button:** If the plugin has a settings screen, add a **Settings** button in the toolbar with the same style as other toolbar buttons (secondary, sm, icon + label "Settings"), e.g. `icon={Settings}` and children `Settings`. Do not use an icon-only button; keep it consistent with Files, Contacts, and Mail.

## 7. Plugin settings page (when the plugin has a settings screen)

If the plugin exposes a settings screen (e.g. cloud storage, SMTP, preferences), implement the following so the panel opens, shows settings content, and Close/Save work correctly.

- **Context:** Extend `panelMode` to include `'settings'` (e.g. `'create' | 'edit' | 'view' | 'settings'`). Expose `openMyPluginSettings` (or `openMyPluginPanel` with a dedicated entry point) that sets `panelMode` to `'settings'` and opens the panel. Expose `closeMyPluginPanel` so the panel can be closed from shared panel actions (header/footer).
- **List toolbar:** Add a Settings button in the list toolbar that calls the open-settings function (same button style as in section 6).
- **Form component:** When `panelMode === 'settings'`, render the settings UI (e.g. a dedicated `MyPluginSettingsForm`) and pass `onCancel` so the panel can be closed. The `*SettingsForm` must register `window.submitMyPluginsForm` / `window.cancelMyPluginsForm` so that `PanelFooter`'s Save/Cancel buttons work in settings mode.
- **Create/Edit forms:** Do **NOT** register window globals for form submission. Add inline Save/Cancel buttons at the bottom of the `*Form.tsx` (see `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12). `PanelFooter` returns `null` for create/edit/view modes — the form is self-contained.
- **Panel actions in settings mode:** `PanelFooter` renders Close + Save buttons only for `currentPlugin.name === 'settings'` or `currentMode === 'settings'`. It calls `handleSaveClick`/`handleCancelClick` from `panelHandlers.ts` which dispatch window globals registered by `*SettingsForm`.
- **Settings content:** Use `DetailSection` from `@/core/ui/DetailSection` for the settings form layout and group related fields under clear section titles.

## 8. Refactoring Existing Plugins (mandatory contract)

When modernizing an existing plugin to align with `slots` / `notes`, treat it as a full contract change, not a cosmetic tweak.

### Functional contract

- **End-to-end scope required:** If a field/feature changes semantics (example: single assignee -> multiple assignees), you MUST update:
  - DB migration
  - backend model + route validation
  - API request/response mapping
  - frontend types
  - context/state (including quick-edit or draft logic)
  - list/search/header badges/export
  - view + form components
- **Backward compatibility:** Keep legacy fields during migration windows (example: preserve `assigned_to` while introducing `assigned_to_ids`) and normalize consistently in backend + API.
- **No partial rollout:** Do not ship only form/view updates without list/search/export/context parity.

### Layout & style contract

- **Properties placement:** If reference plugin places properties below content in the first detail column, match the same structure in both view and edit.
- **Sidebar role:** Sidebar is for quick actions/export/info/metadata; avoid duplicating primary content/properties there unless reference does so.
- **Relations UI parity:** Contact/assignee selectors should reuse the same interaction model as reference (popover search, suggestion rows, selected rows, remove action).
- **Typography parity for properties:** Use consistent token levels (`text-sm` labels, `h-9` controls, `text-xs` control text) where reference uses them.

### Verification gate before merge

- Run lint on changed files.
- Verify panel open/close + edit/create + quick-edit flows.
- Verify list search and export reflect updated data semantics.
- Update docs (`UI_AND_UX_STANDARDS_V3.md`, `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`, `LESSONS_LEARNED.md`, `CHANGELOG.md`) in the same PR when behavior/layout standards changed.

Context Implementation Pattern
Frontend Context (Complete Template)
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MyPluginItem, ValidationError } from '../types/my-plugin';
import { myPluginApi } from '../api/myPluginApi';
import { useApp } from '@/core/api/AppContext';

interface MyPluginContextType {
// Panel State - STANDARDIZED
isMyPluginPanelOpen: boolean;
currentMyPluginItem: MyPluginItem | null;
panelMode: 'create' | 'edit' | 'view'; // GENERIC
validationErrors: ValidationError[];

// Data State
myPluginItems: MyPluginItem[];

// Actions
openMyPluginPanel: (item: MyPluginItem | null) => void;
openMyPluginForEdit: (item: MyPluginItem) => void;
openMyPluginForView: (item: MyPluginItem) => void;
closeMyPluginPanel: () => void;
saveMyPlugin: (data: any) => Promise<boolean>;
deleteMyPlugin: (id: string) => Promise<void>;
clearValidationErrors: () => void;
}

const MyPluginContext = createContext<MyPluginContextType | undefined>(undefined);

interface MyPluginProviderProps {
children: ReactNode;
isAuthenticated: boolean;
onCloseOtherPanels: () => void;
}

export function MyPluginProvider({ children, isAuthenticated, onCloseOtherPanels }: MyPluginProviderProps) {
// CRITICAL: Get panel registration functions from AppContext
const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

// Panel states - STANDARDIZED
const [isMyPluginPanelOpen, setIsMyPluginPanelOpen] = useState(false);
const [currentMyPluginItem, setCurrentMyPluginItem] = useState<MyPluginItem | null>(null);
const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

// Data state
const [myPluginItems, setMyPluginItems] = useState<MyPluginItem[]>([]);

// Load data when authenticated
useEffect(() => {
if (isAuthenticated) {
loadItems();
} else {
setMyPluginItems([]);
}
}, [isAuthenticated]);

// CRITICAL: Register/unregister panel close function
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty dependency array is critical!

// NOTE: window globals are ONLY used by *SettingsForm components (settings mode).
// Create/Edit *Form.tsx must NOT register window globals — use inline Save/Cancel buttons instead.
// See PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md §12 for the canonical inline button pattern.

const loadItems = async () => {
try {
const itemsData = await myPluginApi.getItems();

      const transformedItems = itemsData.map((item: any) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));

      setMyPluginItems(transformedItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    }

};

// Validation
const validateItem = (itemData: any): ValidationError[] => {
const errors: ValidationError[] = [];

    if (!itemData.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Title is required'
      });
    }

    if (!itemData.content?.trim()) {
      errors.push({
        field: 'content',
        message: 'Content is required'
      });
    }

    return errors;

};

// CRUD functions
const openMyPluginPanel = (item: MyPluginItem | null) => {
setCurrentMyPluginItem(item);
setPanelMode(item ? 'edit' : 'create');
setIsMyPluginPanelOpen(true);
setValidationErrors([]);
onCloseOtherPanels();
};

const openMyPluginForEdit = (item: MyPluginItem) => {
setCurrentMyPluginItem(item);
setPanelMode('edit');
setIsMyPluginPanelOpen(true);
setValidationErrors([]);
onCloseOtherPanels();
};

const openMyPluginForView = (item: MyPluginItem) => {
setCurrentMyPluginItem(item);
setPanelMode('view');
setIsMyPluginPanelOpen(true);
setValidationErrors([]);
onCloseOtherPanels();
};

const closeMyPluginPanel = () => {
setIsMyPluginPanelOpen(false);
setCurrentMyPluginItem(null);
setPanelMode('create');
setValidationErrors([]);
};

const clearValidationErrors = () => {
setValidationErrors([]);
};

const saveMyPlugin = async (itemData: any): Promise<boolean> => {
const errors = validateItem(itemData);
setValidationErrors(errors);

    const blockingErrors = errors.filter(error => !error.message.includes('Warning'));
    if (blockingErrors.length > 0) {
      return false;
    }

    try {
      let savedItem: MyPluginItem;

      if (currentMyPluginItem) {
        savedItem = await myPluginApi.updateItem(currentMyPluginItem.id, itemData);
        setMyPluginItems(prev => prev.map(item =>
          item.id === currentMyPluginItem.id ? {
            ...savedItem,
            createdAt: new Date(savedItem.createdAt),
            updatedAt: new Date(savedItem.updatedAt),
          } : item
        ));
        setCurrentMyPluginItem({
          ...savedItem,
          createdAt: new Date(savedItem.createdAt),
          updatedAt: new Date(savedItem.updatedAt),
        });
        setPanelMode('view');
      } else {
        savedItem = await myPluginApi.createItem(itemData);
        setMyPluginItems(prev => [...prev, {
          ...savedItem,
          createdAt: new Date(savedItem.createdAt),
          updatedAt: new Date(savedItem.updatedAt),
        }]);
        closeMyPluginPanel();
      }

      setValidationErrors([]);
      return true;
    } catch (error) {
      console.error('Failed to save item:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save item. Please try again.' }]);
      return false;
    }

};

const deleteMyPlugin = async (id: string) => {
try {
await myPluginApi.deleteItem(id);
setMyPluginItems(prev => prev.filter(item => item.id !== id));
} catch (error) {
console.error('Failed to delete item:', error);
}
};

const value: MyPluginContextType = {
// Panel State
isMyPluginPanelOpen,
currentMyPluginItem,
panelMode,
validationErrors,

    // Data State
    myPluginItems,

    // Actions
    openMyPluginPanel,
    openMyPluginForEdit,
    openMyPluginForView,
    closeMyPluginPanel,
    saveMyPlugin,
    deleteMyPlugin,
    clearValidationErrors,

};

return (
<MyPluginContext.Provider value={value}>
{children}
</MyPluginContext.Provider>
);
}

export function useMyPluginContext() {
const context = useContext(MyPluginContext);
if (context === undefined) {
throw new Error('useMyPluginContext must be used within a MyPluginProvider');
}
return context;
}

Backend Model Pattern
Using Core Services:
const ServiceManager = require('../../server/core/ServiceManager');
const database = ServiceManager.get('database');
const logger = ServiceManager.get('logger');
const { AppError } = require('../../server/core/errors');

class MyPluginModel {
async createItem(itemData) {
try {
// Validation
this.validate(itemData);

      // Insert (tenant isolation automatic)
      const result = await database.insert('my_plugin_items', {
        title: itemData.title,
        content: itemData.content,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Audit log
      logger.info('Item created', { itemId: result.id });

      return this.getItemById(result.id);

    } catch (error) {
      logger.error('Create failed', error, { itemData });
      throw new AppError('Failed to create item', 500, 'CREATE_FAILED');
    }

}

async getItemsByUser() {
// Tenant isolation automatic - no userId parameter needed
return await database.query(
'SELECT \* FROM my_plugin_items ORDER BY created_at DESC',
[]
);
}

async getItemById(itemId) {
const results = await database.query(
'SELECT \* FROM my_plugin_items WHERE id = ?',
[itemId]
);

    if (results.length === 0) {
      throw new AppError('Item not found', 404, 'NOT_FOUND');
    }

    return results[0];

}

async updateItem(itemId, itemData) {
await this.getItemById(itemId); // Verify exists
this.validate(itemData);

    await database.update('my_plugin_items', itemId, {
      title: itemData.title,
      content: itemData.content,
      updated_at: new Date()
    });

    logger.info('Item updated', { itemId });
    return this.getItemById(itemId);

}

async deleteItem(itemId) {
await this.getItemById(itemId); // Verify exists
await database.delete('my_plugin_items', itemId);
logger.info('Item deleted', { itemId });
}

validate(itemData) {
if (!itemData.title?.trim()) {
throw new AppError('Title is required', 400, 'VALIDATION_ERROR');
}
}
}

module.exports = new MyPluginModel();

Required Table Attributes for Keyboard Navigation
All list components must support keyboard navigation:

<tr 
  className="plugin-my-plugins hover:bg-plugin-subtle focus:bg-plugin-subtle focus:outline-none focus:ring-2 focus:ring-plugin-subtle focus:ring-inset cursor-pointer"
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="my-plugins"    // Must match registry name exactly
  role="button"
  aria-label={`Open ${item.title}`}
  onClick={() => openMyPluginForView(item)}
>

Naming Convention Summary
Plugin Names

Registry: my-plugins (plural)
Routes: /api/my-plugins
Database table: my_plugin_items

Context Properties

Panel open: isMyPluginPanelOpen (plural)
Current item: currentMyPluginItem (singular)
Panel mode: panelMode (generic - same for all plugins)
Data array: myPluginItems (plural)

Functions

Open: openMyPluginPanel
Edit: openMyPluginForEdit
View: openMyPluginForView
Close: closeMyPluginPanel
Save: saveMyPlugin
Delete: deleteMyPlugin

Global Functions (Frontend) — ONLY for \*SettingsForm (settings mode)

// Only SettingsForm components register these globals:
Submit: window.submitMyPluginsForm (plural!) — registered by MyPluginSettingsForm only
Cancel: window.cancelMyPluginsForm (plural!) — registered by MyPluginSettingsForm only

// Create/Edit \*Form.tsx must NOT register window globals.
// Use inline Save/Cancel buttons instead (see PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md §12).
Security Checklist
Backend Routes

All routes use requirePlugin('my-plugin')
POST/PUT/DELETE use csrfProtection
Input validation with express-validator
Rate limiting on create/email operations
Ownership verification on UPDATE/DELETE

Backend Model

Use ServiceManager for all infrastructure
Use logger instead of console.log
Throw standardized AppError
No manual tenant filtering (automatic)
Audit log sensitive operations

Frontend

CSRF token included in mutations
Input sanitization before display
Error handling for all API calls
Loading states during operations

Component Props Pattern
Support both plugin-specific and generic props:
interface MyPluginViewProps {
myPlugin?: MyPlugin; // Plugin-specific prop
item?: any; // Generic fallback prop
}

export const MyPluginView: React.FC<MyPluginViewProps> = ({
myPlugin,
item
}) => {
const actualItem = myPlugin || item; // Support both prop types
// ... component implementation
};

Testing Requirements
Backend Tests
const MockDatabaseAdapter = require('../../server/core/services/database/adapters/MockAdapter');

describe('My Plugin Model', () => {
beforeEach(() => {
ServiceManager.override('database', new MockDatabaseAdapter());
});

it('should create item', async () => {
const item = await model.createItem({ title: 'Test', content: 'Content' });
expect(item).toHaveProperty('id');
});
});
Frontend Tests
describe('My Plugin Context', () => {
it('should open panel in create mode', () => {
const { result } = renderHook(() => useMyPlugin());
act(() => result.current.openMyPluginPanel(null));
expect(result.current.panelMode).toBe('create');
});
});

Common Mistakes to Avoid
❌ Wrong Naming Patterns
// WRONG - Plugin-specific panelMode
myPluginPanelMode: 'create' | 'edit' | 'view'

// CORRECT - Generic panelMode  
panelMode: 'create' | 'edit' | 'view'
❌ Wrong Function Names
// WRONG - Singular global functions
window.submitMyPluginForm = handleSubmit;

// CORRECT - Plural global functions
window.submitMyPluginsForm = handleSubmit;
❌ Wrong Panel Registration
// WRONG - Dependencies cause infinite loops
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
}, [closeMyPluginPanel]);

// CORRECT - Empty dependency array
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty array is critical
❌ Direct Infrastructure Access
// WRONG
const db = require('../../server/database');
const results = await db.query('SELECT \* FROM items WHERE user_id = ?', [userId]);

// CORRECT
const database = ServiceManager.get('database');
const results = await database.query('SELECT \* FROM items', []);
// Tenant filtering automatic

````

---

Bulk Operations
For bulk operations (delete, update, etc.), use core helpers:

Backend:
```javascript
// In model.js
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

async bulkDelete(req, idsTextArray) {
  // Use core helper for generic bulk delete logic
  return await BulkOperationsHelper.bulkDelete(req, MyPluginModel.TABLE, idsTextArray);
}
````

Frontend:

```typescript
// In context
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { bulkApi } from '@/core/api/bulkApi';

const { selectedIds, toggleSelection, selectAll, clearSelection, selectedCount, isSelected } =
  useBulkSelection();

const deleteItems = async (ids: string[]) => {
  await bulkApi.bulkDelete('my-plugin', ids);
  // Update state...
};
```

```typescript
// In list component
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';

<BulkActionBar
  selectedCount={selectedCount}
  onClearSelection={clearSelection}
  actions={[
    {
      label: 'Delete…',
      icon: Trash2,
      onClick: () => setShowDeleteModal(true),
      variant: 'destructive',
    },
  ]}
/>

<BulkDeleteModal
  isOpen={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleBulkDelete}
  itemCount={selectedCount}
  itemLabel="items"
  isLoading={deleting}
/>
```

## 9. Detail View Patterns (bindande kontrakt)

När ett plugin har en detail-vy (`*View.tsx`) **måste** det följa dessa mönster. Avvikelser är inte tillåtna.

### 9.1 QuickActionsCard

- Är en separat namngiven `function`-komponent (t.ex. `function MyPluginQuickActionsCard(...)`), inte inline JSX.
- Ska innehålla Edit (blå ikon), Delete (röd ikon + röd hover) och, om `getDuplicateConfig(item)` returnerar värde, Duplicate (grön ikon).
- Delete-knappen: `className="... hover:bg-red-50 dark:hover:bg-red-950/30"`.
- Duplicate-knappen anropar `onDuplicate()` vilket öppnar `DuplicateDialog` – **aldrig** `executeDuplicate` direkt.
- Extra actions renderas från `detailFooterActions`-array med `getActionIconColorClass`.

### 9.2 ExportOptionsCard

- Är en separat namngiven `function`-komponent (t.ex. `function MyPluginExportOptionsCard(...)`).
- Returnerar `null` om `exportFormats` är tom.
- Ikonen är alltid `Download`.
- Formatnamn hämtas från i18n (`common.exportTxt`, `common.exportCsv`, `common.exportPdf`).

### 9.3 DuplicateDialog

Full implementationsguide finns i `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` avsnitt 4.

Kortfattat:

- Context exponerar: `getDuplicateConfig(item)`, `executeDuplicate(item, newName)`, `recentlyDuplicated*Id`, `setRecentlyDuplicated*Id`.
- View destrukturerar `setRecentlyDuplicated*Id` (lätt att missa → `ReferenceError`).
- `onConfirm`-ordning: `closePanel()` → `setRecentlyDuplicated*Id(highlightId)` → `setShowDuplicateDialog(false)`.
- Deep-link-effekt i context: beror på `[location.pathname, items]`, inte `[items]` ensam.

### 9.4 Ta bort gammal kod

- **`didOpenFromUrlRef`-mönster:** Ta bort när pathname-baserad effekt implementeras.
- **`alreadyViewingSame`-check i `openXForView`:** Ta bort – nollsätt alltid `recentlyDuplicated*Id`.
- **`executeDuplicate(item, '')` direkt från knapp:** Ta bort – ersätt med `setShowDuplicateDialog(true)`.

Inga workarounds, inga "backward compat"-block som inte längre behövs.

## Success Criteria

Plugin is ready when:

- ✅ All naming conventions followed exactly
- ✅ Zero console errors or warnings
- ✅ All CRUD operations functional
- ✅ Bulk operations use core helpers (if implemented)
- ✅ Panel coordination works with other plugins
- ✅ Keyboard navigation works
- ✅ Semantic colors implemented (use `.plugin-[name]`, `.bg-plugin-subtle`, etc.)
- ✅ Mobile/desktop responsive
- ✅ Panel coordination works with other plugins
- ✅ Security middleware on all routes
- ✅ Input validation implemented
- ✅ Core services used (no direct infrastructure)
- ✅ Tests passing

---

## Conclusion

Following these standards enables:

- **Automated integration** - Zero manual core updates
- **Security enforcement** - Built-in through middleware and adapters
- **Consistent architecture** - Same patterns across all plugins
- **Easy maintenance** - Predictable structure
- **Fast development** - Clear conventions eliminate guesswork

**When conventions are followed exactly, plugins integrate automatically with zero core file changes.**

---

**See Also:**

- `UI_AND_UX_STANDARDS_V3.md` - List/toolbar UI, buttons, settings panel
- `CORE_SERVICES_ARCHITECTURE.md` - Service details
- `SECURITY_GUIDELINES.md` - Security requirements
- `LESSONS_LEARNED.md` - Common mistakes and anti-patterns
- `MENTIONS_AND_CROSS_PLUGIN_UI.md` - Mention system & cross-plugin navigation

```

```
