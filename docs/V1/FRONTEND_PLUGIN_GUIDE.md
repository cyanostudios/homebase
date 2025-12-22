# Frontend Plugin Development Guide - Automated System

## Overview

Frontend plugins provide React contexts, UI components, and user interactions using the **fully automated plugin system**. Development time: **10-15 minutes** with **ZERO manual core file updates**.

**🎯 Key Achievement:** When conventions are followed exactly, NO manual updates needed to App.tsx, panelHandlers.ts, panelRendering.tsx, keyboardHandlers.ts, PanelTitles.tsx, or PanelFooter.tsx.

**Template:** Copy `templates/plugin-frontend-template` and customize exactly.

## 🎯 Automated Benefits

When following these exact conventions, the plugin system **automatically handles**:

### ✅ Zero Manual Core File Updates
These files automatically support your plugin:
- `App.tsx` - Dynamic plugin detection
- `panelHandlers.ts` - Auto function discovery  
- `panelRendering.tsx` - Dynamic props mapping
- `keyboardHandlers.ts` - Plugin-agnostic navigation
- `PanelTitles.tsx` - Config-based titles
- `PanelFooter.tsx` - Dynamic function calls

### ✅ Automatic Integration Features
- Panel opening/closing coordination
- Keyboard navigation (Space + Arrow keys)
- Form handling and validation
- Cross-plugin navigation
- Dynamic titles and subtitles
- Mobile-responsive rendering
- Delete confirmations
- Mode transitions (Create → Edit → View)

## Plugin Structure

```
client/src/plugins/my-plugin/
├── types/my-plugin.ts           # TypeScript interfaces
├── context/MyPluginContext.tsx  # CRITICAL: Plugin state management
├── hooks/useMyPlugin.ts         # Plugin-specific hook
├── api/myPluginApi.ts           # API calls
└── components/                  # React components
    ├── MyPluginList.tsx         # List with keyboard navigation
    ├── MyPluginForm.tsx         # Form with validation
    └── MyPluginView.tsx         # View with cross-plugin support
```

## Step-by-Step Development

### 1. Copy Template Structure
```bash
# Copy frontend template
cp -r templates/plugin-frontend-template client/src/plugins/my-plugin
cd client/src/plugins/my-plugin

# Rename template files to your plugin names
mv context/TemplateContext.tsx context/MyPluginContext.tsx
mv hooks/useYourItems.ts hooks/useMyPlugin.ts
mv api/templateApi.ts api/myPluginApi.ts
mv types/your-items.ts types/my-plugin.ts

# Rename component files
cd components
mv YourItemList.tsx MyPluginList.tsx
mv YourItemForm.tsx MyPluginForm.tsx  
mv YourItemView.tsx MyPluginView.tsx
cd ..
```

### 2. TypeScript Types
**client/src/plugins/my-plugin/types/my-plugin.ts:**
```typescript
export interface MyPluginItem {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationError {
  field: string;
  message: string;
}
```

### 3. API Layer
**client/src/plugins/my-plugin/api/myPluginApi.ts:**
```typescript
class MyPluginApi {
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api/my-plugin${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getItems() {
    return this.request('');
  }

  async getItem(id: string) {
    return this.request(`/${id}`);
  }

  async createItem(itemData: any) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  async updateItem(id: string, itemData: any) {
    return this.request(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  }

  async deleteItem(id: string) {
    return this.request(`/${id}`, {
      method: 'DELETE',
    });
  }
}

export const myPluginApi = new MyPluginApi();
```

### 4. Plugin Context (CRITICAL)
**client/src/plugins/my-plugin/context/MyPluginContext.tsx:**
```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MyPluginItem, ValidationError } from '../types/my-plugin';
import { myPluginApi } from '../api/myPluginApi';
import { useApp } from '@/core/api/AppContext';

interface MyPluginContextType {
  // Panel State - STANDARDIZED: Using automated conventions
  isMyPluginPanelOpen: boolean;
  currentMyPluginItem: MyPluginItem | null;
  panelMode: 'create' | 'edit' | 'view'; // CHANGED: Generic panelMode (all plugins same)
  validationErrors: ValidationError[];
  
  // Data State
  myPluginItems: MyPluginItem[];
  
  // Actions - CRITICAL: App.tsx expects these exact function names
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
  
  // Panel states - STANDARDIZED: Generic panelMode convention
  const [isMyPluginPanelOpen, setIsMyPluginPanelOpen] = useState(false);
  const [currentMyPluginItem, setCurrentMyPluginItem] = useState<MyPluginItem | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create'); // CHANGED: Generic panelMode
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

  // CRUD functions - STANDARDIZED: Generic panelMode usage
  const openMyPluginPanel = (item: MyPluginItem | null) => {
    setCurrentMyPluginItem(item);
    setPanelMode(item ? 'edit' : 'create'); // CHANGED: setPanelMode
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openMyPluginForEdit = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setPanelMode('edit'); // CHANGED: setPanelMode
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openMyPluginForView = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setPanelMode('view'); // CHANGED: setPanelMode
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeMyPluginPanel = () => {
    setIsMyPluginPanelOpen(false);
    setCurrentMyPluginItem(null);
    setPanelMode('create'); // CHANGED: setPanelMode
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
        setPanelMode('view'); // CHANGED: setPanelMode
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
    panelMode, // CHANGED: panelMode
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
```

### 5. Plugin Hook
**client/src/plugins/my-plugin/hooks/useMyPlugin.ts:**
```typescript
import { useMyPluginContext } from '../context/MyPluginContext';

export function useMyPlugin() {
  return useMyPluginContext();
}
```

### 6. List Component
Update naming in `templates/plugin-frontend-template/components/YourItemList.tsx` to match your domain and copy the responsive patterns with keyboard navigation attributes.

### 7. Form Component
Update naming in `templates/plugin-frontend-template/components/YourItemForm.tsx` to include global function listeners and validation patterns.

### 8. View Component
Update naming in `templates/plugin-frontend-template/components/YourItemView.tsx` to support both plugin-specific and generic props for automated system compatibility.

## Registration in Plugin Registry

**client/src/core/pluginRegistry.ts:**
```typescript
import { MyPluginProvider } from '@/plugins/my-plugin/context/MyPluginContext';
import { useMyPlugin } from '@/plugins/my-plugin/hooks/useMyPlugin';
import { MyPluginList } from '@/plugins/my-plugin/components/MyPluginList';
import { MyPluginForm } from '@/plugins/my-plugin/components/MyPluginForm';
import { MyPluginView } from '@/plugins/my-plugin/components/MyPluginView';

export const PLUGIN_REGISTRY: PluginRegistryEntry[] = [
  // ... existing plugins
  {
    name: 'my-plugins',        // MUST be plural
    Provider: MyPluginProvider,
    hook: useMyPlugin,
    panelKey: 'isMyPluginPanelOpen',
    components: {
      List: MyPluginList,
      Form: MyPluginForm,
      View: MyPluginView,
    }
  }
];
```

## Critical Implementation Details - UPDATED CONVENTIONS

### Generic panelMode Convention (REQUIRED)
All plugins now use the same generic `panelMode` property:
```typescript
// CORRECT - Generic panelMode (all plugins same)
panelMode: 'create' | 'edit' | 'view'

// WRONG - Plugin-specific panelMode (old pattern)
myPluginPanelMode: 'create' | 'edit' | 'view'
```

### Why This Change?
- ✅ **Simpler automation** - Same property name across all plugins
- ✅ **Easier maintenance** - No plugin-specific logic needed
- ✅ **Future-proof** - New plugins follow same pattern
- ✅ **Performance** - More efficient dynamic detection

### Panel Registration (REQUIRED)
```typescript
useEffect(() => {
  registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
  return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty array prevents infinite loops!
```

### Global Form Functions (REQUIRED)
```typescript
useEffect(() => {
  window.submitMyPluginsForm = handleSubmit; // Must be plural!
  window.cancelMyPluginsForm = handleCancel; // Must be plural!
  return () => {
    delete window.submitMyPluginsForm;
    delete window.cancelMyPluginsForm;
  };
}, []);
```

### Component Props Flexibility (NEW)
Support both plugin-specific and generic props for automated system:
```typescript
interface MyPluginViewProps {
  myPlugin?: MyPluginItem;  // Plugin-specific prop
  item?: any;               // Generic fallback prop
}

export const MyPluginView: React.FC<MyPluginViewProps> = ({ 
  myPlugin,    // Plugin-specific prop
  item         // Generic fallback
}) => {
  const actualItem = myPlugin || item;  // Support both prop types
  // ... component implementation
};
```

### Keyboard Navigation (REQUIRED)
```typescript
<tr
  tabIndex={0}                                    // Makes row focusable
  data-list-item={JSON.stringify(item)}         // Item data for Space handler
  data-plugin-name="my-plugins"                 // Plugin identifier (plural!)
  role="button"                                 // Accessibility
  aria-label={`Open ${item.title}`}            // Screen reader support
  onClick={() => openMyPluginForView(item)}    // Mouse support
>
```

## Testing Frontend

### 1. Component Loading
- Check plugin appears in navigation
- Verify list renders correctly
- Test responsive design (mobile/desktop)

### 2. CRUD Operations
- Create new items
- Edit existing items
- Delete items
- View item details

### 3. Keyboard Navigation
- Tab through table rows
- Press Space to open items
- Arrow keys to navigate

### 4. Panel Behavior
- Panel opens/closes correctly
- Only one panel open at a time
- Form validation works

### 5. Automated Integration Testing (NEW)
- Panel opens in correct mode (view/edit/create)
- Mode transitions work automatically (Edit → Save → View)
- Cross-plugin coordination works
- Dynamic titles display correctly
- Panel footer buttons function

## Common Issues

### Infinite Re-renders
**Cause:** Dependencies in useEffect  
**Fix:** Use empty dependency array for registration
```typescript
// WRONG - Causes infinite loops
useEffect(() => {
  registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
}, [closeMyPluginPanel]);

// CORRECT - Empty dependency array
useEffect(() => {
  registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
  return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty array is critical
```

### Panel Not Opening
**Cause:** Missing registration or wrong naming  
**Fix:** Verify `registerPanelCloseFunction` call and naming conventions

### Form Submission Not Working
**Cause:** Global functions not registered correctly  
**Fix:** Check plural naming and event listeners
```typescript
// WRONG - Singular naming
window.submitMyPluginForm = handleSubmit;

// CORRECT - Plural naming
window.submitMyPluginsForm = handleSubmit;
```

### Keyboard Navigation Broken
**Cause:** Missing table row attributes  
**Fix:** Add all required `data-*` attributes
```typescript
// REQUIRED attributes for keyboard navigation
<tr
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="my-plugins"    // Must match registry name exactly
  onClick={() => openMyPluginForView(item)}
>
```

### Panel Opens in Wrong Mode (NEW)
**Cause:** Using old plugin-specific panelMode convention  
**Fix:** Update to generic `panelMode`
```typescript
// WRONG - Old convention
const [myPluginPanelMode, setMyPluginPanelMode] = useState('create');

// CORRECT - New generic convention
const [panelMode, setPanelMode] = useState('create');
```

### Component Props Not Working (NEW)
**Cause:** Only supporting generic or specific props, not both  
**Fix:** Support both prop types for automated system compatibility
```typescript
// CORRECT - Support both prop types
interface MyPluginViewProps {
  myPlugin?: MyPluginItem;  // Plugin-specific
  item?: any;               // Generic fallback
}

const MyPluginView = ({ myPlugin, item }) => {
  const actualItem = myPlugin || item;  // Use either prop
  // ...
};
```

## Performance Considerations

### Context Isolation Benefits
- Plugin changes only affect that plugin's components
- Other plugins remain completely unaffected
- 90% reduction in unnecessary re-renders achieved
- Parallel team development with zero conflicts

### Mobile-First Requirements
- ALL components must support mobile/desktop conditional rendering
- Use `isMobileView` state with window resize listener
- Desktop: Table layout with sortable headers
- Mobile: Card layout with touch-friendly interactions

### Automated System Benefits (NEW)
- **Zero core file updates** - No manual changes needed
- **Consistent integration** - Same patterns across all plugins
- **Reduced development time** - 10-15 minutes vs 45-60 minutes
- **Fewer bugs** - Standardized conventions prevent integration issues

## Advanced Features

### Cross-Plugin Integration
When plugins need to reference each other:
```typescript
// In MyPluginView component
import { useApp } from '@/core/api/AppContext';

const { getNotesForContact, getEstimatesForContact } = useApp();

// Get related data from other plugins
const relatedNotes = await getNotesForContact(item.contactId);
const relatedEstimates = await getEstimatesForContact(item.contactId);
```

### Custom Validation
Implement plugin-specific validation logic:
```typescript
const validateItem = (itemData: any): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Required fields
  if (!itemData.title?.trim()) {
    errors.push({ field: 'title', message: 'Title is required' });
  }
  
  // Custom business logic
  if (itemData.priority === 'high' && !itemData.dueDate) {
    errors.push({ field: 'dueDate', message: 'Due date required for high priority items' });
  }
  
  // Warnings (non-blocking)
  if (itemData.title?.length > 100) {
    errors.push({ field: 'title', message: 'Warning: Title is very long' });
  }
  
  return errors;
};
```

### Dynamic Form Fields
Create context-aware forms:
```typescript
const MyPluginForm = ({ currentItem, onSave, onCancel }) => {
  const { contacts } = useApp(); // Get data from other plugins
  
  return (
    <div className="space-y-4">
      {/* Conditional fields based on item type */}
      {currentItem?.type === 'task' && (
        <div>
          <label>Assigned To</label>
          <select onChange={(e) => handleInputChange('assignedTo', e.target.value)}>
            <option value="">Select contact...</option>
            {contacts.map(contact => (
              <option key={contact.id} value={contact.id}>
                {contact.companyName}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Dynamic validation messages */}
      {getFieldError('assignedTo') && (
        <p className="text-red-600">{getFieldError('assignedTo').message}</p>
      )}
    </div>
  );
};
```

## Best Practices

### Code Organization
- Keep components focused and single-purpose
- Use TypeScript interfaces for all data structures
- Implement proper error boundaries
- Add loading states for async operations

### User Experience
- Provide immediate feedback for user actions
- Implement optimistic updates where appropriate
- Show clear error messages with actionable guidance
- Maintain consistent visual design across all plugins

### Accessibility
- Use semantic HTML elements
- Provide proper ARIA labels
- Ensure keyboard navigation works completely
- Test with screen readers

### Testing Strategy
- Unit tests for individual components
- Integration tests for plugin coordination
- End-to-end tests for complete workflows
- Performance tests for large datasets

## Migration from Legacy Plugins

### Updating Existing Plugins
If you have plugins using old conventions:

1. **Update panelMode convention:**
   ```typescript
   // Change from plugin-specific to generic
   const [panelMode, setPanelMode] = useState('create');
   ```

2. **Update interface definitions:**
   ```typescript
   // Remove plugin-specific panelMode from interface
   interface MyPluginContextType {
     panelMode: 'create' | 'edit' | 'view'; // Generic
   }
   ```

3. **Update all setPanelMode calls:**
   ```typescript
   // Find and replace all instances
   setPanelMode('view'); // Instead of setMyPluginPanelMode('view')
   ```

4. **Test thoroughly:**
   - Panel opening/closing
   - Mode transitions
   - Form submissions
   - Keyboard navigation

### Verification Checklist
- [ ] Plugin registry entry updated
- [ ] Context uses generic panelMode
- [ ] All CRUD functions implemented
- [ ] Global form functions registered (plural naming)  
- [ ] Keyboard navigation attributes added
- [ ] Component props support both specific and generic
- [ ] Panel registration implemented
- [ ] Mobile responsive design working
- [ ] Cross-plugin features preserved

---

**Development Time:** 10-15 minutes with automated system  
**Manual Updates:** ZERO core files need changes  
**Architecture:** Complete context isolation with automated integration  
**Performance:** Plugin-specific re-renders only - 90% reduction achieved  

*This automated system has been tested across all current plugins (contacts, notes, estimates, tasks) and eliminates the 45-60 minute development time that manual core file updates previously required.*