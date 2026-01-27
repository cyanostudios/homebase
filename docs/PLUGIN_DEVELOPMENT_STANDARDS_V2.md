# Plugin Development Standards

## Overview

This document defines MANDATORY naming conventions and patterns for all Homebase plugins. These standards enable the automated plugin system and ensure security enforcement through core services.

## Key Principles

- ✅ Core File Updates: ZERO (fully automated)
- 🎯 Success Rate: 100% when following these conventions exactly
- 🔒 Security: Enforced at every layer
- 📦 SDK: Use @homebase/core for stable interfaces

🔒 CRITICAL REQUIREMENTS

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
   - Run: node scripts/add-your-plugin-to-admin.js (create a script similar to other plugin scripts)

2. Context Interface (MANDATORY Properties)
   interface MyPluginContextType {
   // Panel State - EXACT naming required
   isMyPluginPanelOpen: boolean; // Plugin-specific (plural in name)
   currentMyPlugin: MyPlugin | null; // Plugin-specific (singular)
   panelMode: 'create' | 'edit' | 'view'; // GENERIC (same for all plugins)
   validationErrors: ValidationError[]; // Standard validation array

// Data State
myPlugins: MyPlugin[]; // Plugin data array (plural)

// CRUD Functions - EXACT naming required
openMyPluginPanel: (item: MyPlugin | null) => void;
openMyPluginForEdit: (item: MyPlugin) => void;
openMyPluginForView: (item: MyPlugin) => void;
closeMyPluginPanel: () => void;
saveMyPlugin: (data: any) => Promise<boolean>;
deleteMyPlugin: (id: string) => Promise<void>;
duplicateMyPlugin?: (item: MyPlugin) => Promise<void>; // Optional
clearValidationErrors: () => void;
} 3. Backend Integration with @homebase/core SDK
MANDATORY: All plugins MUST use @homebase/core SDK for infrastructure:
const { Logger, Database, Context } = require('@homebase/core');

// Get database instance for current request
const db = Database.get(req);
const userId = Context.getUserId(req);

// Use SDK interfaces
Logger.info('Operation completed', { userId });
const result = await db.query('SELECT \* FROM items', []);

NEVER:
// ❌ WRONG - Direct imports or ServiceManager
const ServiceManager = require('../../server/core/ServiceManager');
const db = require('../../server/database');
const fs = require('fs'); 4. Security Requirements
MANDATORY middleware on ALL routes:
router.get('/', requirePlugin('my-plugin'), controller.getItems);
router.post('/', requirePlugin('my-plugin'), csrfProtection, controller.create);
router.put('/:id', requirePlugin('my-plugin'), csrfProtection, controller.update);
router.delete('/:id', requirePlugin('my-plugin'), csrfProtection, controller.delete);
MANDATORY input validation:
const { body, param, validationResult } = require('express-validator');

router.post('/', [
requirePlugin('my-plugin'),
csrfProtection,
body('title').trim().notEmpty().isLength({ max: 255 }).escape(),
body('content').optional().trim().isLength({ max: 5000 }),
validateRequest
], controller.create);

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

// CRITICAL: Global functions for form submission
useEffect(() => {
window.submitMyPluginsForm = () => {
const event = new CustomEvent('submitMyPluginForm');
window.dispatchEvent(event);
};

    window.cancelMyPluginsForm = () => {
      const event = new CustomEvent('cancelMyPluginForm');
      window.dispatchEvent(event);
    };

    return () => {
      delete window.submitMyPluginsForm;
      delete window.cancelMyPluginsForm;
    };

}, []);

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
  className="hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer"
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

Global Functions (Frontend)

Submit: window.submitMyPluginsForm (plural!)
Cancel: window.cancelMyPluginsForm (plural!)

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

```

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
```

Frontend:
```typescript
// In context
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { bulkApi } from '@/core/api/bulkApi';

const {
  selectedIds,
  toggleSelection,
  selectAll,
  clearSelection,
  selectedCount,
  isSelected,
} = useBulkSelection();

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

## Success Criteria

Plugin is ready when:
- ✅ All naming conventions followed exactly
- ✅ Zero console errors or warnings
- ✅ All CRUD operations functional
- ✅ Bulk operations use core helpers (if implemented)
- ✅ Keyboard navigation works
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
- `CORE_SERVICES_ARCHITECTURE.md` - Service details
- `SECURITY_GUIDELINES.md` - Security requirements
- `BACKEND_PLUGIN_GUIDE_V2.md` - Backend implementation
- `FRONTEND_PLUGIN_GUIDE_V2.md` - Frontend implementation

```
