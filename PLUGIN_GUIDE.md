# Plugin Development Guide

## Overview

Homebase plugins are self-contained modules that extend the core system without modifying it. This guide shows you how to build plugins that integrate seamlessly with the v3 core architecture.

## Plugin Philosophy

**Simple & Direct Approach:**
- Follow established v3 patterns (UniversalPanel, ConfirmDialog, useUnsavedChanges)
- Copy-and-modify from contacts system
- Direct integration with core components
- File-based configuration over dynamic loading

**Team Independence:**
- Each team owns their plugin
- No conflicts with core or other plugins
- Clear boundaries and responsibilities
- Use established v3 UX patterns

## Plugin Structure (v3)

```
/plugins/[plugin-name]/
├── components/           # React components following v3 patterns
│   ├── [Name]List.tsx   # Table view with consistent action buttons
│   ├── [Name]Form.tsx   # Form using UniversalPanel + useUnsavedChanges
│   └── [Name]Panel.tsx  # Optional wrapper component
├── api/                 # API endpoints (future - after DB integration)
│   └── [plugin-name].ts
├── schema/              # Database schema (future - after DB integration)
│   └── [plugin-name].ts
├── types/               # TypeScript interfaces
│   └── [plugin-name].ts
└── README.md            # Plugin documentation
```

## Creating a Plugin (v3 Patterns)

### Step 1: Copy from Contacts Template

```bash
# Create plugin directory
mkdir -p client/src/plugins/my-plugin/components
mkdir -p client/src/plugins/my-plugin/types

# Use contacts as template
cp -r client/src/plugins/contacts/components client/src/plugins/my-plugin/
```

### Step 2: TypeScript Types

**File:** `types/my-plugin.ts`

```typescript
// Follow v3 contact interface pattern
export interface MyPluginItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Add other business fields
}

export interface MyPluginFormValues {
  name: string;
  description?: string;
  isActive: boolean;
  // Add other form fields following contacts pattern
}
```

### Step 3: List Component (v3 Pattern)

**File:** `components/MyPluginList.tsx`

```typescript
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Heading, Text } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

export const MyPluginList: React.FC = () => {
  const { items, openItemPanel, openItemForEdit, openItemForView, deleteItem } = useApp();
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    itemId: string;
    itemName: string;
  }>({
    isOpen: false,
    itemId: '',
    itemName: ''
  });

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      itemId: id,
      itemName: name
    });
  };

  const confirmDelete = () => {
    deleteItem(deleteConfirm.itemId);
    setDeleteConfirm({
      isOpen: false,
      itemId: '',
      itemName: ''
    });
  };

  const cancelDelete = () => {
    setDeleteConfirm({
      isOpen: false,
      itemId: '',
      itemName: ''
    });
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Heading level={1}>My Plugin Items</Heading>
          <Text variant="caption">Manage your plugin items</Text>
        </div>
        <Button
          onClick={() => openItemPanel(null)}
          variant="primary"
          icon={Plus}
        >
          Add Item
        </Button>
      </div>

      <Card>
        <table className="w-full">
          {/* Follow contacts table structure */}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      icon={Eye}
                      onClick={() => openItemForView(item)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      icon={Edit}
                      onClick={() => openItemForEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      icon={Trash2}
                      onClick={() => handleDelete(item.id, item.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Delete Confirmation Dialog - v3 pattern */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Item"
        message={`Are you sure you want to delete "${deleteConfirm.itemName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
};
```

### Step 4: Form Component (v3 Pattern)

**File:** `components/MyPluginForm.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/core/ui/Button';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { useApp } from '@/core/api/AppContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface MyPluginFormProps {
  currentItem?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export const MyPluginForm: React.FC<MyPluginFormProps> = ({ 
  currentItem, 
  onSave, 
  onCancel, 
  isSubmitting = false 
}) => {
  const { validationErrors } = useApp();
  const { 
    isDirty, 
    showWarning, 
    markDirty, 
    markClean, 
    attemptAction, 
    confirmDiscard, 
    cancelDiscard 
  } = useUnsavedChanges();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

  // Load currentItem data when editing - v3 pattern
  useEffect(() => {
    if (currentItem) {
      setFormData({
        name: currentItem.name || '',
        description: currentItem.description || '',
        isActive: currentItem.isActive ?? true
      });
      markClean();
    } else {
      setFormData({
        name: '',
        description: '',
        isActive: true
      });
      markClean();
    }
  }, [currentItem, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      isActive: true
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(() => {
    const success = onSave(formData);
    if (success) {
      markClean();
    }
  }, [formData, onSave, markClean]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Expose functions to parent - v3 pattern
  useEffect(() => {
    window.submitItemForm = handleSubmit;
    window.cancelItemForm = handleCancel;
    
    return () => {
      delete window.submitItemForm;
      delete window.cancelItemForm;
    };
  }, [handleSubmit, handleCancel]);

  const confirmDiscard = () => {
    if (!currentItem) {
      resetForm();
      setTimeout(() => {
        if (pendingActionRef.current) {
          pendingActionRef.current();
          pendingActionRef.current = null;
        }
        setShowWarning(false);
      }, 0);
    } else {
      if (pendingActionRef.current) {
        pendingActionRef.current();
        pendingActionRef.current = null;
      }
      setShowWarning(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
  };

  return (
    <div className="p-6 space-y-4">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Basic Information */}
        <Card padding="md">
          <Heading level={3} className="mb-3">Item Information</Heading>
          
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-1.5 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              />
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </Card>
      </form>
      
      {/* Unsaved Changes Warning Dialog - v3 pattern */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentItem 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
};
```

## Integration with Core (v3)

### 1. Add to AppContext

**In:** `core/api/AppContext.tsx`

```typescript
// Add plugin state to AppContext
interface AppContextType {
  // ... existing contact state
  
  // Plugin state
  myPluginItems: MyPluginItem[];
  isMyPluginPanelOpen: boolean;
  currentMyPluginItem: MyPluginItem | null;
  
  // Plugin actions
  openMyPluginPanel: (item: MyPluginItem | null) => void;
  // ... other plugin actions
}
```

### 2. Add Navigation Route

**In:** Main App routing

```typescript
import { MyPluginList } from '@/plugins/my-plugin/components/MyPluginList';

// Add route following v3 patterns
<Route path="/my-plugin" element={<MyPluginList />} />
```

### 3. Add UniversalPanel Integration

**In:** App.tsx

```typescript
// Add plugin panel following contacts pattern
{isMyPluginPanelOpen && (
  <UniversalPanel
    title={currentMyPluginItem ? "Edit Item" : "Add Item"}
    onClose={() => { 
      if (window.cancelMyPluginForm) window.cancelMyPluginForm(); 
      else closeMyPluginPanel(); 
    }}
    footer={
      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => { 
            if (window.cancelMyPluginForm) window.cancelMyPluginForm(); 
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => { 
            if (window.submitMyPluginForm) window.submitMyPluginForm(); 
          }}
          disabled={hasBlockingErrors}
        >
          {currentMyPluginItem ? "Update Item" : "Save Item"}
        </Button>
      </div>
    }
  >
    <MyPluginForm
      currentItem={currentMyPluginItem}
      onSave={saveMyPluginItem}
      onCancel={closeMyPluginPanel}
    />
  </UniversalPanel>
)}
```

## Best Practices (v3)

### Component Architecture
- **Follow v3 Patterns:** Use UniversalPanel, ConfirmDialog, useUnsavedChanges
- **useCallback Optimization:** Stabilize function references to prevent loops
- **Global Window Functions:** For cross-component communication
- **TypeScript Interfaces:** Complete type safety for all components

### UI Consistency
- **Button Standards:** Primary/secondary/danger variants with Lucide icons
- **Form Styling:** Follow ContactForm input and layout patterns
- **Table Design:** Consistent with ContactList table structure
- **Error Handling:** Use established validation and error display patterns

### State Management
- **React Context:** For global plugin state (follow AppContext pattern)
- **useUnsavedChanges:** For form state management and user protection
- **Local useState:** For component-specific UI state
- **Validation:** Follow contacts validation framework

### File Organization
- **Plugin Isolation:** Keep all plugin files in `/plugins/[name]/` directory
- **Component Naming:** Follow `[PluginName][ComponentType].tsx` pattern
- **Import Paths:** Use `@/` aliases for core components
- **Export Patterns:** Follow established v3 export conventions

## Development Workflow (v3)

### 1. Plan Your Plugin
- Identify business entities and relationships
- Design form fields following contacts complexity
- Plan validation requirements
- Sketch UI components using v3 patterns

### 2. Build Components First (No DB Yet)
- Start with mock data in AppContext
- Create List component following ContactList pattern
- Build Form component with useUnsavedChanges
- Integrate with UniversalPanel and ConfirmDialog

### 3. Test UI Thoroughly
- Test all CRUD operations with mock data
- Verify unsaved changes protection works
- Check confirmation dialogs function properly
- Ensure responsive design and accessibility

### 4. Future: Database Integration
- After core DB layer is implemented
- Add schema definitions with plugin table prefixes
- Create API endpoints following RESTful patterns
- Replace mock data with real database operations

## Example: Future Invoice Plugin

The first plugin will be `invoices`, refactored from core after DB integration:

```
/plugins/invoices/
├── components/
│   ├── InvoiceList.tsx      # Following ContactList pattern
│   ├── InvoiceForm.tsx      # Using useUnsavedChanges + UniversalPanel
│   └── InvoicePanel.tsx     # Optional wrapper
├── types/
│   └── invoices.ts          # TypeScript interfaces
└── README.md                # Plugin documentation

# Future after DB integration:
├── api/
│   └── invoices.ts          # API endpoints
└── schema/
    └── invoices.ts          # Database schema
```

## Common Patterns (v3)

### Form State Management
```typescript
// Always use useUnsavedChanges hook
const { 
  isDirty, 
  showWarning, 
  markDirty, 
  markClean, 
  attemptAction, 
  confirmDiscard, 
  cancelDiscard 
} = useUnsavedChanges();

// Stabilize handlers with useCallback
const handleSubmit = useCallback(() => {
  // submission logic
}, [dependencies]);
```

### Confirmation Dialogs
```typescript
// Use ConfirmDialog for all dangerous actions
<ConfirmDialog
  isOpen={showConfirm}
  title="Delete Item"
  message="Are you sure you want to delete this item?"
  confirmText="Delete"
  cancelText="Cancel"
  onConfirm={confirmAction}
  onCancel={cancelAction}
  variant="danger"
/>
```

### Global Function Pattern
```typescript
// Expose functions to parent components
useEffect(() => {
  window.submitPluginForm = handleSubmit;
  window.cancelPluginForm = handleCancel;
  
  return () => {
    delete window.submitPluginForm;
    delete window.cancelPluginForm;
  };
}, [handleSubmit, handleCancel]);
```

## Testing Your Plugin (v3)

### 1. Component Integration
- Test with mock data in AppContext
- Verify all v3 patterns work correctly
- Check unsaved changes protection
- Test confirmation dialogs

### 2. UI Consistency
- Compare styling with contacts components
- Verify responsive design
- Check accessibility features
- Test error states and validation

### 3. User Experience
- Test complete user flows (create, edit, delete)
- Verify form reset functionality works
- Check all edge cases and error scenarios
- Ensure consistent behavior with core features

## Troubleshooting (v3)

### Common Issues

**Infinite loops in useEffect:**
- Use useCallback to stabilize function references
- Check dependency arrays in useEffect
- Follow established v3 patterns

**Form not resetting properly:**
- Ensure resetForm function is properly defined
- Check setTimeout usage for async operations
- Verify markClean is called after reset

**Global functions not working:**
- Check window function attachment/cleanup
- Verify function names match across components
- Ensure useEffect dependencies are correct

### Debug Tips
- Follow exact patterns from ContactForm and ContactList
- Use browser dev tools to check React component state
- Console.log function calls to verify execution flow
- Test each component in isolation before integration

## Next Steps

After building your plugin following v3 patterns:

1. **Test Thoroughly** - All CRUD operations, edge cases
2. **Document Patterns** - Update plugin README with v3 specifics
3. **Get Team Review** - Ensure consistency with established standards
4. **Prepare for DB** - Plan schema and API integration for future phase

---

**Remember:** Follow established v3 patterns exactly, focus on user experience, and maintain consistency with the contacts system!