# Plugin Development Guide

## Overview

Homebase plugins are self-contained modules that extend the core system without modifying it. This guide shows you how to build plugins that integrate seamlessly with the core architecture.

## Plugin Philosophy

**Simple & Direct Approach:**
- No complex interfaces or registration systems
- Copy-and-modify from existing patterns
- Direct integration with core components
- File-based configuration over dynamic loading

**Team Independence:**
- Each team owns their plugin
- No conflicts with core or other plugins
- Clear boundaries and responsibilities

## Plugin Structure

```
/plugins/[plugin-name]/
├── components/           # React components
│   ├── [Name]List.tsx
│   ├── [Name]Details.tsx
│   ├── [Name]Form.tsx
│   └── [Name]Panel.tsx
├── api/                 # API endpoints
│   └── [plugin-name].ts
├── schema/              # Database schema
│   └── [plugin-name].ts
├── types/               # TypeScript types
│   └── [plugin-name].ts
└── README.md            # Plugin documentation
```

## Creating a Plugin

### Step 1: Copy Template Structure

```bash
# Create plugin directory
mkdir plugins/my-plugin
cd plugins/my-plugin

# Create standard directories
mkdir components api schema types
```

### Step 2: Database Schema

**File:** `schema/my-plugin.ts`

```typescript
import { pgTable, serial, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

// Use plugin prefix for table names
export const myItems = pgTable('my_plugin_items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  data: jsonb('data'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export type MyItem = typeof myItems.$inferSelect;
export type NewMyItem = typeof myItems.$inferInsert;
```

### Step 3: TypeScript Types

**File:** `types/my-plugin.ts`

```typescript
export interface MyPluginFormValues {
  name: string;
  description?: string;
  isActive: boolean;
  // Add other form fields
}

export interface MyPluginConfig {
  apiEndpoint: string;
  maxItems: number;
  // Plugin-specific configuration
}
```

### Step 4: API Endpoints

**File:** `api/my-plugin.ts`

```typescript
import express from 'express';
import { db } from '../../core/database/connection';
import { myItems } from '../schema/my-plugin';

const router = express.Router();

// GET /api/my-plugin-items
router.get('/', async (req, res) => {
  try {
    const items = await db.select().from(myItems);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

// POST /api/my-plugin-items
router.post('/', async (req, res) => {
  try {
    const newItem = await db.insert(myItems).values(req.body).returning();
    res.json(newItem[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create item' });
  }
});

// PUT /api/my-plugin-items/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await db
      .update(myItems)
      .set(req.body)
      .where(eq(myItems.id, parseInt(req.params.id)))
      .returning();
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update item' });
  }
});

export default router;
```

### Step 5: React Components

**Follow the 4-component pattern from contacts:**

**File:** `components/MyPluginList.tsx`

```typescript
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type { MyItem } from "../types/my-plugin";

export function MyPluginList() {
  const [filter, setFilter] = useState('');
  
  const { data: items, isLoading } = useQuery<MyItem[]>({
    queryKey: ['/api/my-plugin-items'],
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  const handleAdd = () => {
    // Open create panel
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Input
          placeholder="Filter items..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-md"
        />
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>
      
      <div className="space-y-2">
        {filteredItems.map(item => (
          <div key={item.id} className="p-4 border rounded-lg">
            <h3 className="font-medium">{item.name}</h3>
            {item.description && (
              <p className="text-sm text-gray-600">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Integration with Core

### 1. Add Schema to Core

**In:** `shared/schema.ts`

```typescript
// Add to existing exports
export * from '../plugins/my-plugin/schema/my-plugin';
```

### 2. Register API Routes

**In:** `server/index.ts`

```typescript
import myPluginRoutes from '../plugins/my-plugin/api/my-plugin';

// Add to existing routes
app.use('/api/my-plugin-items', myPluginRoutes);
```

### 3. Add Navigation

**In:** Navigation component

```typescript
// Add to navigation items
{
  name: 'My Plugin',
  href: '/my-plugin',
  icon: MyPluginIcon,
}
```

### 4. Add Route

**In:** Main router

```typescript
import { MyPluginList } from '../plugins/my-plugin/components/MyPluginList';

// Add route
<Route path="/my-plugin" element={<MyPluginList />} />
```

## Best Practices

### Database
- **Table Prefixes:** Always use `[plugin-name]_` prefix for tables
- **No Foreign Keys to Core:** Keep plugin data isolated
- **JSON Fields:** Use `jsonb` for flexible plugin-specific data

### API Design
- **RESTful Endpoints:** Follow `/api/[plugin-name]-[resource]` pattern
- **Error Handling:** Consistent error responses
- **Validation:** Validate all inputs

### Component Architecture
- **4-Component Pattern:** List, Details, Form, Panel
- **State Management:** Use React Query for server state
- **UI Consistency:** Use core UI components

### File Organization
- **Clear Naming:** Use plugin name in all file names
- **Single Responsibility:** One concern per file
- **Export Patterns:** Follow core export conventions

## Development Workflow

### 1. Plan Your Plugin
- Define data structure
- Sketch UI components
- Plan API endpoints

### 2. Build Database First
- Create schema file
- Add to core schema exports
- Run database migrations

### 3. Build API Layer
- Create API endpoints
- Register routes in core
- Test with Postman/curl

### 4. Build UI Components
- Start with List component
- Add Details and Form
- Integrate with core layout

### 5. Test Integration
- Test all CRUD operations
- Verify UI consistency
- Check error handling

## Example: Invoice Plugin

The first plugin will be `invoices`, refactored from core. Use it as reference:

```
/plugins/invoices/
├── components/
│   ├── InvoiceList.tsx
│   ├── InvoiceDetails.tsx
│   ├── InvoiceForm.tsx
│   └── InvoicePanel.tsx
├── api/
│   └── invoices.ts
├── schema/
│   └── invoices.ts
├── types/
│   └── invoices.ts
└── README.md
```

## Common Patterns

### State Management
```typescript
// Use React Query for server state
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/my-plugin-items'],
});

// Use useState for local UI state
const [filter, setFilter] = useState('');
const [selectedItem, setSelectedItem] = useState(null);
```

### Error Handling
```typescript
// API layer
try {
  const result = await db.insert(table).values(data);
  res.json(result);
} catch (error) {
  console.error('Plugin error:', error);
  res.status(500).json({ message: 'Operation failed' });
}

// Component layer
if (error) {
  return <div className="text-red-500">Error: {error.message}</div>;
}
```

### Form Handling
```typescript
// Use react-hook-form with zod validation
const form = useForm<MyPluginFormValues>({
  resolver: zodResolver(myPluginSchema),
});

const onSubmit = async (data: MyPluginFormValues) => {
  try {
    await apiRequest('POST', '/api/my-plugin-items', data);
    // Handle success
  } catch (error) {
    // Handle error
  }
};
```

## Testing Your Plugin

### 1. Database Operations
```bash
# Check tables created
npx drizzle-kit studio

# Verify data structure
```

### 2. API Endpoints
```bash
# Test with curl
curl -X GET http://localhost:3001/api/my-plugin-items
curl -X POST http://localhost:3001/api/my-plugin-items \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item"}'
```

### 3. UI Components
- Test all CRUD operations
- Verify responsive design
- Check error states

## Troubleshooting

### Common Issues

**Plugin not loading:**
- Check file paths and imports
- Verify routes are registered
- Check console for errors

**Database errors:**
- Ensure schema is exported
- Check table prefixes
- Verify column names

**API not working:**
- Check route registration
- Verify HTTP methods
- Test with curl first

### Debug Tips
- Use `console.log` liberally during development
- Check browser dev tools Network tab
- Use Drizzle Studio for database inspection

## Next Steps

After building your plugin:

1. **Document it** - Update plugin README
2. **Test thoroughly** - All CRUD operations
3. **Get feedback** - Have team review
4. **Iterate** - Improve based on usage

---

**Remember:** Keep it simple, follow existing patterns, and focus on solving real business problems!