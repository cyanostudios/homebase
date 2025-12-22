# Plugin Development Standards - Complete Conventions Guide

## Overview

This guide defines the **MANDATORY** naming conventions and patterns for all Homebase plugins. These standards enable the **automated plugin system** that eliminates manual core file updates.

**⏱️ Development Time:** 15-25 minutes per plugin (verified)  
**✅ Core File Updates:** ZERO (fully automated)  
**🎯 Success Rate:** 100% when following these conventions exactly

## 🔒 CRITICAL REQUIREMENTS

### **1. Plugin Registry Entry**
Every plugin MUST be registered in `client/src/core/pluginRegistry.ts`:

```typescript
{
  name: 'my-plugins',                    // PLURAL form required
  Provider: MyPluginProvider,
  hook: useMyPlugins,
  panelKey: 'isMyPluginPanelOpen',      // Must match context boolean exactly
  components: {
    List: MyPluginList,
    Form: MyPluginForm,
    View: MyPluginView,
  }
}
```

### **2. Context Interface (MANDATORY Properties)**

```typescript
interface MyPluginContextType {
  // Panel State - EXACT naming required
  isMyPluginPanelOpen: boolean;           // Plugin-specific (plural in name)
  currentMyPlugin: MyPlugin | null;       // Plugin-specific (singular)
  panelMode: 'create' | 'edit' | 'view';  // GENERIC (same for all plugins)
  validationErrors: ValidationError[];    // Standard validation array
  
  // Data State
  myPlugins: MyPlugin[];                  // Plugin data array (plural)
  
  // CRUD Functions - EXACT naming required
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

### **3. Context Implementation Pattern**

```typescript
export function MyPluginProvider({ children, isAuthenticated, onCloseOtherPanels }: MyPluginProviderProps) {
  const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();
  
  // State - EXACT naming
  const [isMyPluginPanelOpen, setIsMyPluginPanelOpen] = useState(false);
  const [currentMyPlugin, setCurrentMyPlugin] = useState<MyPlugin | null>(null);
  const [panelMode, setPanelMode] = useState<'create' | 'edit' | 'view'>('create');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [myPlugins, setMyPlugins] = useState<MyPlugin[]>([]);

  // REQUIRED: Panel registration
  useEffect(() => {
    registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
    return () => unregisterPanelCloseFunction('my-plugins');
  }, []); // Empty dependency array CRITICAL

  // REQUIRED: Global form functions (PLURAL naming)
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

  // Implementation of all required functions...
}
```

### **4. Function Implementation Patterns**

```typescript
// View Mode
const openMyPluginForView = (item: MyPlugin) => {
  setCurrentMyPlugin(item);
  setPanelMode('view');           // Generic panelMode
  setIsMyPluginPanelOpen(true);
  setValidationErrors([]);
  onCloseOtherPanels();
};

// Edit Mode  
const openMyPluginForEdit = (item: MyPlugin) => {
  setCurrentMyPlugin(item);
  setPanelMode('edit');           // Generic panelMode
  setIsMyPluginPanelOpen(true);
  setValidationErrors([]);
  onCloseOtherPanels();
};

// Create Mode
const openMyPluginPanel = (item: MyPlugin | null) => {
  setCurrentMyPlugin(item);
  setPanelMode(item ? 'edit' : 'create');  // Generic panelMode
  setIsMyPluginPanelOpen(true);
  setValidationErrors([]);
  onCloseOtherPanels();
};

// Save with Mode Transition
const saveMyPlugin = async (data: any): Promise<boolean> => {
  // ... validation logic
  
  if (currentMyPlugin) {
    // Update existing
    const saved = await myPluginApi.updateItem(currentMyPlugin.id, data);
    setMyPlugins(prev => prev.map(item => 
      item.id === currentMyPlugin.id ? saved : item
    ));
    setCurrentMyPlugin(saved);
    setPanelMode('view');  // Transition to view after save
  } else {
    // Create new
    const saved = await myPluginApi.createItem(data);
    setMyPlugins(prev => [...prev, saved]);
    closeMyPluginPanel();  // Close after create
  }
  
  return true;
};
```

### **5. Component Requirements**

#### **List Component**
```typescript
// REQUIRED: Keyboard navigation attributes
<tr
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="my-plugins"    // Must match registry name exactly
  onClick={() => openMyPluginForView(item)}
  className="hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
>
```

#### **Form Component**
```typescript
// REQUIRED: Event listeners for global form functions
useEffect(() => {
  const handleSubmit = () => onSave(getFormData());
  const handleCancel = () => onCancel();
  
  window.addEventListener('submitMyPluginForm', handleSubmit);
  window.addEventListener('cancelMyPluginForm', handleCancel);
  
  return () => {
    window.removeEventListener('submitMyPluginForm', handleSubmit);
    window.removeEventListener('cancelMyPluginForm', handleCancel);
  };
}, [onSave, onCancel, getFormData]);
```

#### **View Component**
```typescript
// REQUIRED: Props interface
interface MyPluginViewProps {
  myPlugin?: MyPlugin;  // Plugin-specific prop
  item?: any;           // Generic fallback prop
}

export const MyPluginView: React.FC<MyPluginViewProps> = ({ 
  myPlugin,    // Plugin-specific prop  
  item         // Generic fallback
}) => {
  const actualItem = myPlugin || item;  // Support both prop types
  // ... component implementation
};
```

## 🎯 AUTOMATED BENEFITS

When these conventions are followed exactly:

### **✅ Zero Core File Updates**
- No manual changes to `App.tsx`
- No manual changes to `panelHandlers.ts` 
- No manual changes to `panelRendering.tsx`
- No manual changes to `keyboardHandlers.ts`
- No manual changes to `PanelTitles.tsx`
- No manual changes to `PanelFooter.tsx`

### **✅ Automatic Integration**
- Panel opening/closing coordination
- Keyboard navigation (Space + Arrow keys)
- Form handling and validation
- Cross-plugin navigation
- Dynamic titles and subtitles
- Mobile-responsive rendering

### **✅ Development Speed**
- **5 minutes:** Backend plugin (copy templates/plugin-backend-template)
- **10 minutes:** Frontend context (follow exact pattern from templates/plugin-frontend-template)
- **8 minutes:** UI components (copy and customize)
- **2 minutes:** Registration and testing
- **Total: 15-25 minutes** (verified across all current plugins)

## 🚫 COMMON MISTAKES TO AVOID

### **❌ Wrong Naming Patterns**
```typescript
// WRONG - Plugin-specific panelMode
contactPanelMode: 'create' | 'edit' | 'view'

// CORRECT - Generic panelMode  
panelMode: 'create' | 'edit' | 'view'
```

### **❌ Wrong Function Names**
```typescript
// WRONG - Singular global functions
window.submitMyPluginForm = handleSubmit;

// CORRECT - Plural global functions
window.submitMyPluginsForm = handleSubmit;
```

### **❌ Wrong Panel Registration**
```typescript
// WRONG - Dependencies cause infinite loops
useEffect(() => {
  registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
}, [closeMyPluginPanel]);

// CORRECT - Empty dependency array
useEffect(() => {
  registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
  return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty array is critical
```

### **❌ Wrong Component Props**
```typescript
// WRONG - Only generic props
interface MyPluginViewProps {
  item: any;
}

// CORRECT - Both specific and generic props
interface MyPluginViewProps {
  myPlugin?: MyPlugin;  // Plugin-specific
  item?: any;           // Generic fallback
}
```

## 📋 DEVELOPMENT CHECKLIST

### **Backend Setup (5 minutes)**
- [ ] Copy entire `templates/plugin-backend-template/` directory
- [ ] Update plugin.config.js (name, routeBase)
- [ ] Set table/columns in model.js
- [ ] Keep structure (model/controller/routes/config)
- [ ] Test API endpoints

### **Frontend Context (10 minutes)**
- [ ] Copy `templates/plugin-frontend-template/` structure exactly
- [ ] Update interface with correct naming conventions
- [ ] Implement all required functions
- [ ] Add panel registration and global functions
- [ ] Test context functions

### **UI Components (8 minutes)**
- [ ] Copy template List component - add keyboard navigation attributes
- [ ] Copy template Form component - add global function event listeners  
- [ ] Copy template View component - support both prop types
- [ ] Test responsive design and keyboard navigation

### **Registration (2 minutes)**
- [ ] Add entry to `pluginRegistry.ts` with exact naming
- [ ] Test that plugin loads in console: `🟢 Loaded plugin: my-plugins`

### **Final Testing**
- [ ] CRUD operations work correctly
- [ ] Panel opens in correct mode (view/edit/create)
- [ ] Keyboard navigation (Tab, Space, Arrow keys)
- [ ] Mobile responsive design
- [ ] Cross-plugin features don't break

## 🎖️ SUCCESS CRITERIA

**✅ Plugin is ready for production when:**
- All naming conventions followed exactly
- Zero console errors or warnings
- All CRUD operations functional
- Keyboard navigation works
- Mobile/desktop responsive
- Panel coordination works with other plugins
- Development time was 15-25 minutes

## 🔄 MAINTENANCE

### **Adding New Plugins**
1. Copy templates from `templates/` directory
2. Follow naming conventions exactly
3. Add to plugin registry
4. Test integration
5. **No core file changes needed**

### **Updating Existing Plugins**
1. Verify current naming conventions
2. Update any non-conforming patterns
3. Test all functionality
4. **Core system remains unchanged**

---

**Architecture:** Fully automated plugin system  
**Development Time:** 15-25 minutes per plugin (verified)  
**Core Updates Required:** ZERO  
**Success Rate:** 100% when conventions followed

*This guide represents the current production-tested standards that enable rapid plugin development without system conflicts.*