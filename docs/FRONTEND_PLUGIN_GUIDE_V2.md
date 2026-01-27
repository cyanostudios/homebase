# Frontend Plugin Development Guide

## Overview

Frontend plugins provide React contexts, UI components, and user interactions using the fully automated plugin system with security best practices.

## Key Features

- CSRF token handling for all mutations
- Standardized error handling
- Security-focused validation
- @homebase/core SDK integration
- Dark mode support
- Keyboard navigation

---

## Plugin Structure

```
client/src/plugins/my-plugin/
├── types/my-plugin.ts           # TypeScript interfaces
├── context/MyPluginContext.tsx  # Plugin state management
├── hooks/useMyPlugin.ts         # Plugin-specific hook
├── api/myPluginApi.ts           # API calls with CSRF
└── components/                  # React components
    ├── MyPluginList.tsx         # List with keyboard navigation
    ├── MyPluginForm.tsx         # Form with validation
    └── MyPluginView.tsx         # View with cross-plugin support

TypeScript Types
client/src/plugins/my-plugin/types/my-plugin.ts:
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

API Layer with CSRF
client/src/plugins/my-plugin/api/myPluginApi.ts:
class MyPluginApi {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;

    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    // Add CSRF token for mutations
    if (options.method && ['POST', 'PUT', 'DELETE'].includes(options.method)) {
      headers['X-CSRF-Token'] = await this.getCsrfToken();
    }

    const response = await fetch(`/api/my-plugin${endpoint}`, {
      headers,
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
Key Security Features:

✅ CSRF token fetched once and reused
✅ CSRF token included in all mutations
✅ Credentials included for session cookies
✅ Standardized error handling


Plugin Context
See PLUGIN_DEVELOPMENT_STANDARDS_V2.md for complete context template.
Key Security Additions:

Error handling with user-friendly messages
Loading states during operations
Optimistic updates with rollback on failure


List Component
client/src/plugins/my-plugin/components/MyPluginList.tsx:
import React, { useState, useEffect } from 'react';
import { useMyPlugin } from '../hooks/useMyPlugin';

export const MyPluginList: React.FC = () => {
  const { myPluginItems, openMyPluginForView, openMyPluginPanel } = useMyPlugin();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const filteredItems = myPluginItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isMobileView) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>

        <button
          onClick={() => openMyPluginPanel(null)}
          className="w-full mb-4 px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Add Item
        </button>

        <div className="space-y-3">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => openMyPluginForView(item)}
              className="bg-white p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
            >
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">My Plugin</h1>
        <button
          onClick={() => openMyPluginPanel(null)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add Item
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      <table className="min-w-full bg-white border border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-6 py-12 text-center text-gray-400">
                {searchTerm ? 'No items found.' : 'No items yet. Click "Add Item" to get started.'}
              </td>
            </tr>
          ) : (
            filteredItems.map(item => (
              <tr
                key={item.id}
                tabIndex={0}
                data-list-item={JSON.stringify(item)}
                data-plugin-name="my-plugins"
                role="button"
                aria-label={`Open ${item.title}`}
                onClick={() => openMyPluginForView(item)}
                className="hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{item.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
Key Features:

✅ Responsive (mobile/desktop)
✅ Keyboard navigation attributes
✅ Search functionality
✅ Empty states
✅ Bulk selection support (using core hooks)

Bulk Operations
For bulk delete and other bulk operations, use core hooks and components:

client/src/plugins/my-plugin/components/MyPluginList.tsx:
import { useBulkSelection } from '@/core/hooks/useBulkSelection';
import { BulkActionBar } from '@/core/ui/BulkActionBar';
import { BulkDeleteModal } from '@/core/ui/BulkDeleteModal';
import { bulkApi } from '@/core/api/bulkApi';
import { Trash2 } from 'lucide-react';

export const MyPluginList: React.FC = () => {
  const { items, deleteItems } = useMyPlugin();
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    selectedCount,
    isSelected,
  } = useBulkSelection();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      await bulkApi.bulkDelete('my-plugin', selectedIds);
      // Update local state
      setItems((prev) => prev.filter((item) => !selectedIds.includes(String(item.id))));
      clearSelection();
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Bulk Action Bar */}
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

      {/* List with checkboxes */}
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={visibleIds.every((id) => isSelected(id))}
                onChange={() => {
                  if (visibleIds.every((id) => isSelected(id))) {
                    const remaining = selectedIds.filter((id) => !visibleIds.includes(id));
                    selectAll(remaining);
                  } else {
                    selectAll([...selectedIds, ...visibleIds]);
                  }
                }}
              />
            </th>
            {/* ... other columns */}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={isSelected(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              {/* ... other cells */}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleBulkDelete}
        itemCount={selectedCount}
        itemLabel="items"
        isLoading={deleting}
      />
    </div>
  );
};


Form Component
client/src/plugins/my-plugin/components/MyPluginForm.tsx:
import React, { useState, useEffect } from 'react';
import { useMyPlugin } from '../hooks/useMyPlugin';

interface MyPluginFormProps {
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export const MyPluginForm: React.FC<MyPluginFormProps> = ({ onSave, onCancel }) => {
  const { currentMyPluginItem, validationErrors, clearValidationErrors } = useMyPlugin();

  const [formData, setFormData] = useState({
    title: currentMyPluginItem?.title || '',
    content: currentMyPluginItem?.content || '',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentMyPluginItem) {
      setFormData({
        title: currentMyPluginItem.title,
        content: currentMyPluginItem.content,
      });
    }
  }, [currentMyPluginItem]);

  // Global form function listeners
  useEffect(() => {
    const handleSubmit = async () => {
      await handleSave();
    };

    const handleCancel = () => {
      onCancel();
    };

    window.addEventListener('submitMyPluginForm', handleSubmit);
    window.addEventListener('cancelMyPluginForm', handleCancel);

    return () => {
      window.removeEventListener('submitMyPluginForm', handleSubmit);
      window.removeEventListener('cancelMyPluginForm', handleCancel);
    };
  }, [formData]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    clearValidationErrors();

    try {
      const success = await onSave(formData);
      if (!success) {
        setIsSaving(false);
      }
    } catch (error) {
      setIsSaving(false);
      console.error('Save failed:', error);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getFieldError = (field: string) => {
    return validationErrors.find(error => error.field === field);
  };

  const hasBlockingErrors = validationErrors.some(
    error => !error.message.includes('Warning')
  );

  return (
    <div className="space-y-4">
      {hasBlockingErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
              <ul className="mt-2 text-sm text-red-700">
                {validationErrors
                  .filter(error => !error.message.includes('Warning'))
                  .map((error, index) => (
                    <li key={index}>• {error.message}</li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getFieldError('title') ? 'border-red-500' : 'border-gray-300'
            }`}
            required
            disabled={isSaving}
          />
          {getFieldError('title') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('title')?.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Content
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => updateField('content', e.target.value)}
            rows={5}
            className={`w-full px-3 py-1.5 text-base border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              getFieldError('content') ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isSaving}
          />
          {getFieldError('content') && (
            <p className="mt-1 text-sm text-red-600">{getFieldError('content')?.message}</p>
          )}
        </div>
      </form>
    </div>
  );
};
Key Features:

✅ Global form function listeners
✅ Validation error display
✅ Loading states
✅ Field-level error highlighting
✅ Disabled state during save


View Component
client/src/plugins/my-plugin/components/MyPluginView.tsx:
import React from 'react';
import { MyPluginItem } from '../types/my-plugin';

interface MyPluginViewProps {
  myPlugin?: MyPluginItem;
  item?: any;
}

export const MyPluginView: React.FC<MyPluginViewProps> = ({ myPlugin, item }) => {
  const actualItem = myPlugin || item;

  if (!actualItem) {
    return <div className="p-4 text-gray-500">No item selected</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Details</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Title</div>
            <div className="text-sm text-gray-900">{actualItem.title}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Content</div>
            <div className="text-sm text-gray-900 whitespace-pre-wrap">
              {actualItem.content || 'No content'}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Metadata</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Created</div>
            <div className="text-sm text-gray-900">
              {new Date(actualItem.createdAt).toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Updated</div>
            <div className="text-sm text-gray-900">
              {new Date(actualItem.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
Key Features:

✅ Supports both prop types (plugin-specific and generic)
✅ Consistent card structure
✅ Metadata display
✅ Null handling


Security Best Practices
Input Sanitization
For user-generated content:
import DOMPurify from 'dompurify';

// Sanitize before rendering
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(item.content)
}} />
Error Handling
User-friendly error messages:
try {
  await myPluginApi.createItem(data);
} catch (error) {
  // Don't expose technical details
  setValidationErrors([{
    field: 'general',
    message: 'Failed to save. Please try again.'
  }]);

  // Log technical details for debugging
  console.error('API error:', error);
}
Loading States
Prevent double submissions:
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  if (isSaving) return; // Prevent double click

  setIsSaving(true);
  try {
    await onSave(formData);
  } finally {
    setIsSaving(false);
  }
};

Testing
Component Tests
import { render, screen, fireEvent } from '@testing-library/react';
import { MyPluginForm } from './MyPluginForm';

describe('MyPluginForm', () => {
  it('should display validation errors', async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    const onCancel = jest.fn();

    render(<MyPluginForm onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
  });
});

Migration from V1
Add CSRF Token Handling
// OLD - No CSRF
fetch('/api/my-plugin', {
  method: 'POST',
  body: JSON.stringify(data)
});

// NEW - With CSRF
const csrfToken = await getCsrfToken();
fetch('/api/my-plugin', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
Update Error Handling
// OLD - Generic error
catch (error) {
  console.error(error);
}

// NEW - User-friendly errors
catch (error) {
  setValidationErrors([{
    field: 'general',
    message: 'Failed to save. Please try again.'
  }]);
  console.error('Save failed:', error);
}

Plugin Registration & Sidebar Visibility

After implementing your plugin, you must register it to make it visible in the sidebar:

1. Register in pluginRegistry.ts
   // client/src/core/pluginRegistry.ts
   {
     name: 'my-plugins',
     Provider: MyPluginProvider,
     hook: useMyPlugins,
     panelKey: 'isMyPluginPanelOpen',
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

2. Plugin discovery (AUTOMATED)
   // server/core/config/constants.js
   ✅ AUTOMATED: Plugins are automatically discovered from the filesystem.
   - Only directories containing plugin.config.js are included
   - Plugins are validated and sorted automatically
   - Some plugins (read-only, experimental) are excluded from DEFAULT_USER_PLUGINS
   No manual update required.

3. Grant access to superadmin
   The superadmin (admin@homebase.se) needs the plugin added to their user_plugin_access.

   Option A: Use a script (recommended)
   // Create scripts/add-my-plugin-to-admin.js (similar to other plugin scripts)
   // Run: node scripts/add-my-plugin-to-admin.js

   Option B: Manual SQL
   INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
   VALUES (
     (SELECT id FROM users WHERE email = 'admin@homebase.se'),
     'my-plugins',
     true
   )
   ON CONFLICT (user_id, plugin_name) DO UPDATE SET enabled = true;

4. Verify sidebar visibility
   - Log in as a user with the plugin enabled
   - The plugin should appear in the sidebar under the specified category
   - Clicking it should open the plugin's list view

⚠️ Important Notes:
- Plugins only appear in sidebar for users who have them enabled in user_plugin_access
- New users get plugins from DEFAULT_USER_PLUGINS in constants.js
- Superadmin must have plugins manually added (they don't get defaults automatically)

Conclusion
Frontend plugins now:

✅ Handle CSRF tokens automatically
✅ Display user-friendly errors
✅ Prevent double submissions
✅ Sanitize user input
✅ Support keyboard navigation
✅ Responsive mobile/desktop
✅ Visible in sidebar after registration
✅ Accessible to superadmin after granting permissions

Result: Secure, accessible, user-friendly frontend code.

See Also:

PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Naming conventions
SECURITY_GUIDELINES.md - Security requirements
BACKEND_PLUGIN_GUIDE_V2.md - Backend integration
STYLE_GUIDE.md - UI/UX standards
```
