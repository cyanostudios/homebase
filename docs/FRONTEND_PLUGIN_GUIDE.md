# Frontend Plugin Development Guide

## Overview

Frontend plugins provide React contexts, UI components, and user interactions. Development time: **15-20 minutes** using templates.

**Template:** Copy `ContactContext.tsx` and contact components exactly.

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

### 1. TypeScript Types
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

### 2. API Layer
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

### 3. Plugin Context (CRITICAL)
**client/src/plugins/my-plugin/context/MyPluginContext.tsx:**
```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MyPluginItem, ValidationError } from '../types/my-plugin';
import { myPluginApi } from '../api/myPluginApi';
import { useApp } from '@/core/api/AppContext';

interface MyPluginContextType {
  // Panel State - CRITICAL: Naming must match App.tsx expectations
  isMyPluginPanelOpen: boolean;
  currentMyPluginItem: MyPluginItem | null;
  myPluginPanelMode: 'create' | 'edit' | 'view'; // CRITICAL: [plugin]PanelMode naming
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
  
  // Panel states
  const [isMyPluginPanelOpen, setIsMyPluginPanelOpen] = useState(false);
  const [currentMyPluginItem, setCurrentMyPluginItem] = useState<MyPluginItem | null>(null);
  const [myPluginPanelMode, setMyPluginPanelMode] = useState<'create' | 'edit' | 'view'>('create');
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
    setMyPluginPanelMode(item ? 'edit' : 'create');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openMyPluginForEdit = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setMyPluginPanelMode('edit');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const openMyPluginForView = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setMyPluginPanelMode('view');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    onCloseOtherPanels();
  };

  const closeMyPluginPanel = () => {
    setIsMyPluginPanelOpen(false);
    setCurrentMyPluginItem(null);
    setMyPluginPanelMode('create');
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
        setMyPluginPanelMode('view');
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
    myPluginPanelMode,
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

### 4. Plugin Hook
**client/src/plugins/my-plugin/hooks/useMyPlugin.ts:**
```typescript
import { useMyPluginContext } from '../context/MyPluginContext';

export function useMyPlugin() {
  return useMyPluginContext();
}
```

### 5. List Component
**client/src/plugins/my-plugin/components/MyPluginList.tsx:**
```typescript
import React, { useState, useEffect } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { Heading, Text } from '@/core/ui/Typography';
import { Button } from '@/core/ui/Button';
import { useMyPlugin } from '../hooks/useMyPlugin';

export const MyPluginList: React.FC = () => {
  const { 
    myPluginItems, 
    openMyPluginPanel, 
    openMyPluginForView 
  } = useMyPlugin();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const filteredItems = myPluginItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isMobileView) {
    // Mobile card layout
    return (
      <div className="p-4">
        {/* Header */}
        <div className="mb-6">
          <Heading level={1}>My Plugin Items</Heading>
          <Text variant="caption">Manage your plugin items</Text>
        </div>

        {/* Search and Add */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={() => openMyPluginPanel(null)}
            variant="primary"
            icon={Plus}
            className="w-full"
          >
            Add Item
          </Button>
        </div>

        {/* Items */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchTerm ? 'No items found matching your search.' : 'No items yet. Click "Add Item" to get started.'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-lg border hover:bg-gray-50 cursor-pointer"
                onClick={() => openMyPluginForView(item)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {item.content}
                    </p>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>My Plugin Items</Heading>
          <Text variant="caption">Manage your plugin items</Text>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <Button
            onClick={() => openMyPluginPanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Content
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                  {searchTerm ? 'No items found matching your search.' : 'No items yet. Click "Add Item" to get started.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr 
                  key={item.id} 
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset cursor-pointer`}
                  tabIndex={0}
                  data-list-item={JSON.stringify(item)}
                  data-plugin-name="my-plugins"
                  role="button"
                  aria-label={`Open item ${item.title}`}
                  onClick={() => openMyPluginForView(item)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-xs line-clamp-2">
                      {item.content.substring(0, 100)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### 6. Form Component
**client/src/plugins/my-plugin/components/MyPluginForm.tsx:**
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { useMyPlugin } from '../hooks/useMyPlugin';

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
  const { validationErrors, clearValidationErrors } = useMyPlugin();
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  // Load currentItem data when editing
  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title || '',
        content: currentItem.content || '',
      });
    } else {
      setFormData({
        title: '',
        content: '',
      });
    }
  }, [currentItem]);

  const handleSubmit = useCallback(async () => {
    const success = await onSave(formData);
    if (success && !currentItem) {
      setFormData({ title: '', content: '' });
    }
  }, [formData, onSave, currentItem]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  // CRITICAL: Global functions for UniversalPanel footer
  useEffect(() => {
    window.submitMyPluginForm = handleSubmit;
    window.cancelMyPluginForm = handleCancel;

    return () => {
      delete window.submitMyPluginForm;
      delete window.cancelMyPluginForm;
    };
  }, [handleSubmit, handleCancel]);

  // Listen for global form events
  useEffect(() => {
    const handleSubmitEvent = () => handleSubmit();
    const handleCancelEvent = () => handleCancel();

    window.addEventListener('submitMyPluginForm', handleSubmitEvent);
    window.addEventListener('cancelMyPluginForm', handleCancelEvent);

    return () => {
      window.removeEventListener('submitMyPluginForm', handleSubmitEvent);
      window.removeEventListener('cancelMyPluginForm', handleCancelEvent);
    };
  }, [handleSubmit, handleCancel]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    clearValidationErrors();
  };

  const getFieldError = (fieldName: string) => {
    return validationErrors.find(error => error.field === fieldName);
  };

  return (
    <div className="space-y-6">
      <Card padding="lg" className="shadow-none">
        <Heading level={3} className="mb-4 text-lg font-semibold text-gray-900">
          {currentItem ? 'Edit Item' : 'Create New Item'}
        </Heading>

        <div className="space-y-4">
          {/* Title Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('title') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('title') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
            )}
          </div>

          {/* Content Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              rows={6}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                getFieldError('content') ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {getFieldError('content') && (
              <p className="mt-1 text-sm text-red-600">{getFieldError('content')?.message}</p>
            )}
          </div>

          {/* General Errors */}
          {getFieldError('general') && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{getFieldError('general')?.message}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
```

### 7. View Component
**client/src/plugins/my-plugin/components/MyPluginView.tsx:**
```typescript
import React from 'react';
import { FileText } from 'lucide-react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';

interface MyPluginViewProps {
  item: any;
}

export const MyPluginView: React.FC<MyPluginViewProps> = ({ item }) => {
  if (!item) return null;

  return (
    <div className="space-y-4">
      {/* Content */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Content</Heading>
        <div className="text-sm text-gray-900 whitespace-pre-wrap">{item.content}</div>
      </Card>

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">{new Date(item.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">{new Date(item.updatedAt).toLocaleDateString()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
```

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

## Critical Implementation Details

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

## Common Issues

### Infinite Re-renders
**Cause:** Dependencies in useEffect  
**Fix:** Use empty dependency array for registration

### Panel Not Opening
**Cause:** Missing registration or wrong naming  
**Fix:** Verify `registerPanelCloseFunction` call

### Form Submission Not Working
**Cause:** Global functions not registered correctly  
**Fix:** Check plural naming and event listeners

### Keyboard Navigation Broken
**Cause:** Missing table row attributes  
**Fix:** Add all required `data-*` attributes

---

**Development Time:** 15-20 minutes using templates  
**Architecture:** Complete context isolation  
**Performance:** Plugin-specific re-renders only  

*Copy ContactContext.tsx structure exactly for guaranteed success.*