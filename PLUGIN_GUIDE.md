# Plugin Development Guide v5

## Overview

Homebase v5 plugins are production-ready, database-integrated modules that extend the core system with full authentication, cross-plugin references, and mobile-first design. This guide shows you how to build plugins following the established Notes plugin pattern.

## Plugin Philosophy (v5)

**Production-Ready Architecture:**
- Database-first design with PostgreSQL integration
- Authentication-protected API endpoints
- Cross-plugin @mention system for seamless integration
- Mobile-first responsive design
- CommonJS compatible for hosting

**Team Independence:**
- Each team owns their plugin following established patterns
- No conflicts with core or other plugins
- Clear API boundaries with authentication
- Shared UI/UX patterns across all plugins

## Plugin Structure (v5)

```
/plugins/[plugin-name]/
├── types/
│   └── [plugin-name].ts     # TypeScript interfaces + mention types
└── components/
    ├── [Name]List.tsx       # List view with mobile cards + sorting
    ├── [Name]Form.tsx       # Form with API integration + @mentions
    └── [Name]View.tsx       # View with cross-plugin references
```

**Server-side (in server/index.ts):**
```javascript
// API routes following established patterns
app.get('/api/[plugin-name]', requirePlugin('[plugin-name]'), async (req, res) => {
  // Get user's plugin items from database
});

app.post('/api/[plugin-name]', requirePlugin('[plugin-name]'), async (req, res) => {
  // Create new plugin item
});
```

## Creating a Plugin (v5 Production Pattern)

### Step 1: Use Notes Plugin as Template

**The Notes plugin is your perfect template** - it demonstrates all v5 patterns:
- Database integration with API endpoints
- Cross-plugin @mention system
- Authentication integration
- Mobile-first responsive design
- Production-ready error handling

```bash
# Create plugin directory
mkdir -p client/src/plugins/my-plugin/types
mkdir -p client/src/plugins/my-plugin/components

# Use notes as template (better than contacts for v5)
cp -r client/src/plugins/notes/components client/src/plugins/my-plugin/
cp -r client/src/plugins/notes/types client/src/plugins/my-plugin/
```

### Step 2: TypeScript Types (v5 Pattern)

**File:** `types/my-plugin.ts`

```typescript
// Follow Notes plugin interface pattern exactly
export interface MyPluginItem {
  id: string;
  title: string;
  content: string;
  // Add @mention support if your plugin should reference other plugins
  mentions?: MyPluginMention[];
  createdAt: Date;
  updatedAt: Date;
}

// If your plugin should support @mentions to other plugins
export interface MyPluginMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position: number;    // Character position in content
  length: number;      // Length of mention text
}

export interface MyPluginFormValues {
  title: string;
  content: string;
  mentions?: MyPluginMention[];
}
```

### Step 3: List Component (v5 Database Pattern)

**File:** `components/MyPluginList.tsx`

```typescript
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

export function MyPluginList() {
  const { 
    myPluginItems, // Your plugin items from database
    openMyPluginPanel, 
    openMyPluginForEdit, 
    openMyPluginForView, 
    deleteMyPluginItem 
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);

  // Mobile-first responsive design
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter and sort items (follow Notes pattern)
  const filteredAndSortedItems = myPluginItems
    .filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortBy === 'createdAt') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteMyPluginItem(itemToDelete.id);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  // Mobile card view (follow Notes pattern)
  if (isMobile) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">My Plugin</h1>
          <Button
            onClick={() => openMyPluginPanel(null)}
            variant="primary"
            icon={Plus}
          >
            Add
          </Button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredAndSortedItems.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={() => openMyPluginForView(item)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    onClick={() => openMyPluginForEdit(item)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => handleDeleteClick(item)}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {item.content.substring(0, 100)}...
              </p>
              <div className="mt-2 text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Item"
          message={`Are you sure you want to delete "${itemToDelete?.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          variant="danger"
        />
      </div>
    );
  }

  // Desktop table view (follow Notes pattern)
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Plugin</h1>
          <p className="text-gray-600">Manage your plugin items</p>
        </div>
        <Button
          onClick={() => openMyPluginPanel(null)}
          variant="primary"
          icon={Plus}
        >
          Add Item
        </Button>
      </div>

      {/* Search and Sort Controls */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split('-');
            setSortBy(field as 'title' | 'createdAt');
            setSortOrder(order as 'asc' | 'desc');
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="title-asc">Title A-Z</option>
          <option value="title-desc">Title Z-A</option>
        </select>
      </div>

      {/* Items Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Content
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {item.content.substring(0, 100)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={() => openMyPluginForView(item)}
                      >
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                        onClick={() => openMyPluginForEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteClick(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Item"
        message={`Are you sure you want to delete "${itemToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        variant="danger"
      />
    </div>
  );
}
```

### Step 4: Form Component (v5 API Pattern)

**File:** `components/MyPluginForm.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/core/api/AppContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { MentionTextarea } from '@/core/ui/MentionTextarea'; // If using @mentions

interface MyPluginFormProps {
  currentItem?: any;
  onSave: (data: any) => Promise<boolean>;
  onCancel: () => void;
}

export function MyPluginForm({ currentItem, onSave, onCancel }: MyPluginFormProps) {
  const { validationErrors, contacts } = useApp();
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
    title: '',
    content: '',
    mentions: [] as any[]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load currentItem data when editing
  useEffect(() => {
    if (currentItem) {
      setFormData({
        title: currentItem.title || '',
        content: currentItem.content || '',
        mentions: currentItem.mentions || []
      });
      markClean();
    } else {
      setFormData({
        title: '',
        content: '',
        mentions: []
      });
      markClean();
    }
  }, [currentItem, markClean]);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      mentions: []
    });
    markClean();
  }, [markClean]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onSave(formData);
      if (success) {
        markClean();
        if (!currentItem) {
          resetForm();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSave, markClean, currentItem, resetForm, isSubmitting]);

  const handleCancel = useCallback(() => {
    attemptAction(() => {
      onCancel();
    });
  }, [attemptAction, onCancel]);

  // Global functions for UniversalPanel footer
  useEffect(() => {
    window.submitMyPluginForm = handleSubmit;
    window.cancelMyPluginForm = handleCancel;
    
    return () => {
      delete window.submitMyPluginForm;
      delete window.cancelMyPluginForm;
    };
  }, [handleSubmit, handleCancel]);

  const handleDiscardChanges = () => {
    if (!currentItem) {
      resetForm();
      setTimeout(() => {
        confirmDiscard();
      }, 0);
    } else {
      confirmDiscard();
    }
  };

  const updateField = (field: string, value: any, mentions?: any[]) => {
    setFormData(prev => ({ 
      ...prev, 
      [field]: value,
      ...(mentions && { mentions })
    }));
    markDirty();
  };

  return (
    <div className="p-6 space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        
        {/* Title Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter item title"
            required
          />
          {validationErrors.some(error => error.field === 'title') && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.find(error => error.field === 'title')?.message}
            </p>
          )}
        </div>

        {/* Content Field with @mentions support */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <MentionTextarea
            value={formData.content}
            onChange={(content, mentions) => updateField('content', content, mentions)}
            placeholder="Enter content... Type @ to mention contacts"
            className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            contacts={contacts}
          />
          {validationErrors.some(error => error.field === 'content') && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.find(error => error.field === 'content')?.message}
            </p>
          )}
        </div>

        {/* Show mentioned contacts */}
        {formData.mentions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mentioned Contacts
            </label>
            <div className="space-y-2">
              {formData.mentions.map((mention, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md">
                  <span className="text-sm text-blue-800">
                    @{mention.contactName}
                  </span>
                  {mention.companyName && (
                    <span className="text-sm text-gray-600">
                      ({mention.companyName})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </form>

      {/* Unsaved Changes Warning */}
      <ConfirmDialog
        isOpen={showWarning}
        title="Unsaved Changes"
        message={currentItem 
          ? "You have unsaved changes. Do you want to discard your changes and return to view mode?" 
          : "You have unsaved changes. Do you want to discard your changes and close the form?"
        }
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        onConfirm={handleDiscardChanges}
        onCancel={cancelDiscard}
        variant="warning"
      />
    </div>
  );
}
```

### Step 5: View Component (v5 Cross-Plugin Pattern)

**File:** `components/MyPluginView.tsx`

```typescript
import React from 'react';
import { useApp } from '@/core/api/AppContext';
import { MentionContent } from '@/core/ui/MentionContent';
import { User, Calendar, MessageSquare } from 'lucide-react';

interface MyPluginViewProps {
  item: any;
}

export function MyPluginView({ item }: MyPluginViewProps) {
  const { getContactsForMyPlugin } = useApp();

  if (!item) return null;

  const mentionedContacts = getContactsForMyPlugin(item.id);

  return (
    <div className="p-6 space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{item.title}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
          {item.updatedAt !== item.createdAt && (
            <div className="flex items-center gap-1">
              <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content with clickable @mentions */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Content</h3>
        <div className="prose prose-sm max-w-none">
          <MentionContent 
            content={item.content} 
            mentions={item.mentions} 
          />
        </div>
      </div>

      {/* Cross-plugin references */}
      {mentionedContacts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <User className="h-5 w-5" />
            Mentioned Contacts
          </h3>
          <div className="space-y-3">
            {mentionedContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{contact.companyName}</div>
                  <div className="text-sm text-gray-600">
                    {contact.contactType === 'company' ? 'Company' : 'Private'} • {contact.contactNumber}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Navigate to contact (cross-plugin navigation)
                    // This will be handled by the UniversalPanel system
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Contact
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show reverse references (items that mention this item) */}
      {/* This would be implemented if other plugins can reference this plugin */}
      
    </div>
  );
}
```

## API Integration (v5 Database Pattern)

### Step 6: Add Database Schema

**In:** `scripts/setup-database.js`

```javascript
// Add your plugin table
await client.query(`
  CREATE TABLE IF NOT EXISTS my_plugin_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    mentions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add indexes
await client.query('CREATE INDEX IF NOT EXISTS idx_my_plugin_user_id ON my_plugin_items(user_id)');
```

### Step 7: Add API Endpoints

**In:** `server/index.ts`

```javascript
// My Plugin API routes
app.get('/api/my-plugin', requirePlugin('my-plugin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM my_plugin_items WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.user.id]
    );
    
    const items = result.rows.map(row => ({
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: row.mentions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json(items);
  } catch (error) {
    console.error('Get my plugin items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.post('/api/my-plugin', requirePlugin('my-plugin'), async (req, res) => {
  try {
    const { title, content, mentions } = req.body;
    
    const result = await pool.query(`
      INSERT INTO my_plugin_items (user_id, title, content, mentions)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      req.session.user.id,
      title,
      content,
      JSON.stringify(mentions || []),
    ]);
    
    const item = result.rows[0];
    res.json({
      id: item.id.toString(),
      title: item.title,
      content: item.content || '',
      mentions: item.mentions || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });
  } catch (error) {
    console.error('Create my plugin item error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.put('/api/my-plugin/:id', requirePlugin('my-plugin'), async (req, res) => {
  try {
    const itemId = req.params.id;
    const { title, content, mentions } = req.body;
    
    const result = await pool.query(`
      UPDATE my_plugin_items SET
        title = $1, content = $2, mentions = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [
      title,
      content,
      JSON.stringify(mentions || []),
      itemId,
      req.session.user.id,
    ]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const item = result.rows[0];
    res.json({
      id: item.id.toString(),
      title: item.title,
      content: item.content || '',
      mentions: item.mentions || [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    });
  } catch (error) {
    console.error('Update my plugin item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/my-plugin/:id', requirePlugin('my-plugin'), async (req, res) => {
  try {
    const itemId = req.params.id;
    
    const result = await pool.query(
      'DELETE FROM my_plugin_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [itemId, req.session.user.id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete my plugin item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});
```

## AppContext Integration (v5)

### Step 8: Add Plugin State to AppContext

**In:** `client/src/core/api/AppContext.tsx`

```typescript
// Add to AppContextType interface
interface AppContextType {
  // ... existing state
  
  // My Plugin State
  myPluginItems: MyPluginItem[];
  isMyPluginPanelOpen: boolean;
  currentMyPluginItem: MyPluginItem | null;
  myPluginPanelMode: 'create' | 'edit' | 'view';
  
  // My Plugin Actions
  openMyPluginPanel: (item: MyPluginItem | null) => void;
  openMyPluginForEdit: (item: MyPluginItem) => void;
  openMyPluginForView: (item: MyPluginItem) => void;
  closeMyPluginPanel: () => void;
  saveMyPluginItem: (itemData: any) => Promise<boolean>;
  deleteMyPluginItem: (id: string) => Promise<void>;
  
  // Cross-plugin references
  getContactsForMyPlugin: (itemId: string) => Contact[];
}

// Add to AppProvider component
export function AppProvider({ children }: { children: ReactNode }) {
  // ... existing state
  
  // My Plugin state
  const [myPluginItems, setMyPluginItems] = useState<MyPluginItem[]>([]);
  const [isMyPluginPanelOpen, setIsMyPluginPanelOpen] = useState(false);
  const [currentMyPluginItem, setCurrentMyPluginItem] = useState<MyPluginItem | null>(null);
  const [myPluginPanelMode, setMyPluginPanelMode] = useState<'create' | 'edit' | 'view'>('create');

  // Load my plugin items when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadMyPluginItems();
    }
  }, [isAuthenticated]);

  const loadMyPluginItems = async () => {
    try {
      const items = await api.getMyPluginItems();
      setMyPluginItems(items.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })));
    } catch (error) {
      console.error('Failed to load my plugin items:', error);
    }
  };

  // My Plugin actions
  const openMyPluginPanel = (item: MyPluginItem | null) => {
    setCurrentMyPluginItem(item);
    setMyPluginPanelMode(item ? 'edit' : 'create');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    // Close other panels
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const openMyPluginForEdit = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setMyPluginPanelMode('edit');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    // Close other panels
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const openMyPluginForView = (item: MyPluginItem) => {
    setCurrentMyPluginItem(item);
    setMyPluginPanelMode('view');
    setIsMyPluginPanelOpen(true);
    setValidationErrors([]);
    // Close other panels
    setIsContactPanelOpen(false);
    setIsNotePanelOpen(false);
  };

  const closeMyPluginPanel = () => {
    setIsMyPluginPanelOpen(false);
    setCurrentMyPluginItem(null);
    setMyPluginPanelMode('create');
    setValidationErrors([]);
  };

  const saveMyPluginItem = async (itemData: any): Promise<boolean> => {
    try {
      let savedItem: MyPluginItem;
      
      if (currentMyPluginItem) {
        // Update existing item
        savedItem = await api.updateMyPluginItem(currentMyPluginItem.id, itemData);
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
        setValidationErrors([]);
      } else {
        // Create new item
        savedItem = await api.createMyPluginItem(itemData);
        setMyPluginItems(prev => [...prev, {
          ...savedItem,
          createdAt: new Date(savedItem.createdAt),
          updatedAt: new Date(savedItem.updatedAt),
        }]);
        closeMyPluginPanel();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save my plugin item:', error);
      setValidationErrors([{ field: 'general', message: 'Failed to save item. Please try again.' }]);
      return false;
    }
  };

  const deleteMyPluginItem = async (id: string) => {
    try {
      await api.deleteMyPluginItem(id);
      setMyPluginItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete my plugin item:', error);
    }
  };

  // Cross-plugin reference functions
  const getContactsForMyPlugin = (itemId: string): Contact[] => {
    const item = myPluginItems.find(i => i.id === itemId);
    if (!item || !item.mentions) return [];
    
    return item.mentions.map(mention => 
      contacts.find(contact => contact.id === mention.contactId)
    ).filter(Boolean) as Contact[];
  };

  // Add API helper functions
  const api = {
    // ... existing API functions
    
    // My Plugin endpoints
    async getMyPluginItems() {
      return this.request('/my-plugin');
    },

    async createMyPluginItem(itemData: any) {
      return this.request('/my-plugin', {
        method: 'POST',
        body: JSON.stringify(itemData),
      });
    },

    async updateMyPluginItem(id: string, itemData: any) {
      return this.request(`/my-plugin/${id}`, {
        method: 'PUT',
        body: JSON.stringify(itemData),
      });
    },

    async deleteMyPluginItem(id: string) {
      return this.request(`/my-plugin/${id}`, { method: 'DELETE' });
    },
  };

  // Add to provider value
  return (
    <AppContext.Provider value={{
      // ... existing values
      
      // My Plugin state
      myPluginItems,
      isMyPluginPanelOpen,
      currentMyPluginItem,
      myPluginPanelMode,
      
      // My Plugin actions
      openMyPluginPanel,
      openMyPluginForEdit,
      openMyPluginForView,
      closeMyPluginPanel,
      saveMyPluginItem,
      deleteMyPluginItem,
      
      // Cross-plugin references
      getContactsForMyPlugin,
    }}>
      {children}
    </AppContext.Provider>
  );
}
```

## App.tsx Integration (v5)

### Step 9: Add Plugin to Main App

**In:** `client/src/App.tsx`

```typescript
import { MyPluginList } from '@/plugins/my-plugin/components/MyPluginList';
import { MyPluginForm } from '@/plugins/my-plugin/components/MyPluginForm';
import { MyPluginView } from '@/plugins/my-plugin/components/MyPluginView';

function AppContent() {
  const { 
    // ... existing state
    
    // My Plugin state
    isMyPluginPanelOpen,
    currentMyPluginItem,
    myPluginPanelMode,
    closeMyPluginPanel,
    saveMyPluginItem,
    openMyPluginForEdit,
    openMyPluginForView,
    deleteMyPluginItem,
  } = useApp();

  // Update panel detection logic
  const isAnyPanelOpen = isContactPanelOpen || isNotePanelOpen || isMyPluginPanelOpen;
  const isMyPlugin = isMyPluginPanelOpen;

  // Update panel mode logic
  const currentMode = isContact ? panelMode : 
                     isNote ? notePanelMode : 
                     isMyPlugin ? myPluginPanelMode : 'view';

  // Update delete handler
  const confirmDelete = async () => {
    if (isContact && currentContact) {
      await deleteContact(currentContact.id);
      closeContactPanel();
    } else if (isNote && currentNote) {
      await deleteNote(currentNote.id);
      closeNotePanel();
    } else if (isMyPlugin && currentMyPluginItem) {
      await deleteMyPluginItem(currentMyPluginItem.id);
      closeMyPluginPanel();
    }
    setShowDeleteConfirm(false);
  };

  // Update save handlers
  const handleSaveMyPlugin = async (data: any) => {
    console.log('Saving my plugin item:', data);
    return await saveMyPluginItem(data);
  };

  // Add to currentPage state (if using page navigation)
  const [currentPage, setCurrentPage] = useState<'contacts' | 'notes' | 'my-plugin'>('contacts');

  // Update main content rendering
  <div className="flex-1 overflow-auto">
    {currentPage === 'contacts' && <ContactList />}
    {currentPage === 'notes' && <NotesList />}
    {currentPage === 'my-plugin' && <MyPluginList />}
  </div>

  // Add to UniversalPanel content
  {isMyPlugin && (
    <>
      {currentMode === 'view' ? (
        <MyPluginView item={currentMyPluginItem} />
      ) : (
        <MyPluginForm
          currentItem={currentMyPluginItem}
          onSave={handleSaveMyPlugin}
          onCancel={closeMyPluginPanel}
        />
      )}
    </>
  )}
}
```

### Step 10: Add Plugin to Navigation

**In:** `client/src/core/ui/Sidebar.tsx` (or wherever navigation is handled)

```typescript
// Add to navigation items
const navigationItems = [
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'my-plugin', label: 'My Plugin', icon: YourIcon }, // Add your plugin
];
```

## Data Import Strategy (v5)

### Step 11: Plugin-Specific Import Strategy

**File:** `plugins/my-plugin/import/MyPluginImportStrategy.ts`

```typescript
interface ImportStrategy<T> {
  pluginName: string;
  supportedFormats: string[];
  validateData: (data: any[]) => ImportValidationResult;
  transformData: (data: any[]) => T[];
  importData: (data: T[]) => Promise<ImportResult>;
}

export class MyPluginImportStrategy implements ImportStrategy<MyPluginItem> {
  pluginName = 'my-plugin';
  supportedFormats = ['csv', 'xlsx', 'json'];

  validateData(data: any[]): ImportValidationResult {
    const errors: ImportError[] = [];
    
    data.forEach((row, index) => {
      if (!row.title || typeof row.title !== 'string') {
        errors.push({
          row: index + 1,
          field: 'title',
          message: 'Title is required and must be a string'
        });
      }
      
      if (!row.content || typeof row.content !== 'string') {
        errors.push({
          row: index + 1,
          field: 'content',
          message: 'Content is required and must be a string'
        });
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  transformData(data: any[]): MyPluginItem[] {
    return data.map(row => ({
      id: '', // Will be generated by database
      title: row.title.trim(),
      content: row.content.trim(),
      mentions: [], // @mentions will be parsed from content
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  }

  async importData(data: MyPluginItem[]): Promise<ImportResult> {
    const results: ImportResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const item of data) {
      try {
        // Use your plugin's API to create items
        await api.createMyPluginItem(item);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          item: item.title,
          error: error.message
        });
      }
    }

    return results;
  }
}
```

## Plugin Testing (v5)

### Step 12: Testing Your Plugin

**1. Authentication Testing:**
```bash
# Test plugin endpoint requires authentication
curl -X GET http://localhost:3002/api/my-plugin
# Should return 401 Unauthorized

# Test with valid session
curl -X GET http://localhost:3002/api/my-plugin -H "Cookie: connect.sid=valid_session"
# Should return plugin items
```

**2. Database Testing:**
```bash
# Test database operations
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:devpassword@localhost:5432/homebase_dev' });
pool.query('SELECT * FROM my_plugin_items').then(res => {
  console.log('My plugin items:', res.rows);
  pool.end();
});
"
```

**3. Cross-Plugin Testing:**
- Create items with @mentions to contacts
- Verify @mentions are clickable and navigate correctly
- Test bidirectional references work
- Verify mobile responsiveness

## Production Deployment (v5)

### Step 13: Plugin Deployment Checklist

**Before deploying your plugin:**
- ✅ Database schema added to setup-database.js
- ✅ API endpoints implemented with authentication
- ✅ All components follow mobile-first design
- ✅ Cross-plugin @mentions working (if applicable)
- ✅ Plugin access control configured
- ✅ Error handling comprehensive
- ✅ TypeScript types complete
- ✅ Import strategy defined (if needed)

**Deployment steps:**
1. **Add plugin to production database schema**
2. **Deploy API endpoints to production server**
3. **Enable plugin access for users in database**
4. **Test full functionality on production**
5. **Monitor performance and error logs**

## Best Practices (v5)

### Component Architecture
- **Follow Notes Plugin Exactly:** Use as template for all patterns
- **Database Integration:** All operations through API endpoints
- **Authentication:** All routes require authentication
- **Mobile-First:** Responsive design from start
- **Cross-Plugin References:** Use @mention system for connections

### Security
- **Authentication Required:** All plugin endpoints protected
- **User Data Isolation:** Plugin data scoped to authenticated user
- **Input Validation:** Server-side validation for all data
- **SQL Injection Prevention:** Parameterized queries only

### Performance
- **Efficient Queries:** Use indexes for common operations
- **Pagination:** For large datasets (follow Notes pattern)
- **Caching:** Consider caching for frequently accessed data
- **Mobile Optimization:** Minimize data transfer for mobile

### UX Consistency
- **UniversalPanel:** Use for all plugin forms and views
- **Button Standards:** Follow established button patterns
- **Loading States:** Provide feedback during operations
- **Error Handling:** User-friendly error messages
- **Confirmation Dialogs:** For destructive operations

## Troubleshooting (v5)

### Common Issues

**Authentication Errors:**
- Verify API endpoints include `requirePlugin('your-plugin')`
- Check plugin access granted in `user_plugin_access` table
- Ensure session cookies sent with requests

**Database Connection Issues:**
- Verify database schema created in setup-database.js
- Check PostgreSQL connection string
- Ensure database indexes created

**Cross-Plugin References Not Working:**
- Verify @mention components imported correctly
- Check mentions stored as proper JSON in database
- Ensure MentionContent component handling navigation

**Mobile Responsiveness Issues:**
- Test on actual mobile devices
- Use browser dev tools mobile simulation
- Check all components follow responsive patterns

### Debug Tips
- **Follow Notes Plugin Exactly:** Compare your implementation
- **Use Browser Dev Tools:** Check network requests and console errors
- **Test API Endpoints:** Use curl or Postman to verify API
- **Check Database:** Verify data stored correctly
- **Test Cross-References:** Ensure @mentions work end-to-end

## Future Plugin Ideas

With v5 patterns established, plugins can be built rapidly:

**Invoice Plugin (1 hour):**
- Invoice management with @mention to contacts and projects
- PDF generation for invoices
- Payment tracking integration

**Projects Plugin (1 hour):**
- Project management with @mention to contacts and invoices
- Milestone tracking
- Team assignment via @mentions

**Equipment Plugin (45 min):**
- Asset management with @mention to contacts
- Maintenance scheduling
- Location tracking

**Calendar Plugin (1 hour):**
- Event management with @mention to contacts
- Meeting scheduling
- Integration with project milestones

## Next Steps

After building your plugin following v5 patterns:

1. **Test Thoroughly** - All CRUD operations, cross-references, mobile
2. **Document Plugin** - Create README with plugin-specific details
3. **Code Review** - Ensure consistency with Notes plugin patterns
4. **Production Deploy** - Follow deployment checklist
5. **User Training** - Document features for end users
6. **Monitor Usage** - Track performance and user feedback

---

**Remember:** The Notes plugin is your perfect template for v5. Follow its patterns exactly for database integration, authentication, cross-plugin references, and mobile-first design. Every successful plugin should feel like a natural extension of the core system!