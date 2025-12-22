# Database Tenant Management Plugin - Implementation Handover

## 📋 Overview

**Plugin Name:** `db-tenants` (Database Tenant Management)  
**Purpose:** Allow superuser to manage tenant plugin access through admin interface  
**Status:** Ready for implementation  
**Estimated Time:** 15-25 minutes using existing templates

**Why "db-tenants"?**
- Avoids confusion with future "tenants" concept (billing, organizations, etc.)
- Clearly indicates this manages database-level tenant configuration
- Aligns with technical architecture (Railway users → Neon tenant databases)

---

## 🎯 Requirements Summary

### What Superuser Needs to Do:
1. **View all tenants** - List of all users with their current plugin access
2. **Select a tenant** - Click to see detailed view
3. **Manage plugin access** - Checkbox interface to enable/disable plugins
4. **Save changes** - Update `user_plugin_access` table in Railway PostgreSQL
5. **See results immediately** - Tenant's next login reflects new plugin access

### Core Functionality:
- ✅ List all database tenants (users)
- ✅ View individual tenant details
- ✅ Enable/disable plugins per tenant via checkboxes
- ✅ Access restricted to superuser only
- ⏳ Future: Role management, usage statistics, Neon DB management

---

## 🏗️ Architecture Design

### Plugin Structure

```
plugins/db-tenants/
├── plugin.config.js       # Plugin metadata + routing
├── model.js              # Railway PostgreSQL queries (NOT tenant Neon DBs)
├── controller.js         # Business logic for tenant management
├── routes.js            # Express routes for admin operations
└── index.js             # Plugin initialization

client/src/plugins/db-tenants/
├── types/db-tenants.ts           # TypeScript interfaces
├── context/DbTenantsContext.tsx  # Plugin state management
├── hooks/useDbTenants.ts         # Plugin hook
├── api/dbTenantsApi.ts          # API calls to /api/db-tenants
└── components/
    ├── DbTenantsList.tsx         # List all tenants (responsive)
    ├── DbTenantsView.tsx         # View tenant + plugin checkboxes
    └── (no Form needed)          # Creation via signup endpoint
```

### Database Design

**CRITICAL: This plugin uses Railway PostgreSQL ONLY**
- ❌ NOT tenant Neon databases
- ✅ Railway PostgreSQL central tables: `users`, `user_plugin_access`
- ✅ Read/write central auth data only

**Tables Used:**
```sql
-- Railway PostgreSQL
users (
  id INT PRIMARY KEY,
  email VARCHAR(255),
  role VARCHAR(50),
  created_at TIMESTAMP
)

user_plugin_access (
  user_id INT,
  plugin_name VARCHAR(255),
  enabled BOOLEAN,
  PRIMARY KEY (user_id, plugin_name)
)

tenants (
  user_id INT PRIMARY KEY,
  neon_project_id TEXT,
  neon_database_name TEXT,
  neon_connection_string TEXT
)
```

---

## 🔧 Backend Implementation

### Plugin Config
**File:** `plugins/db-tenants/plugin.config.js`

```javascript
module.exports = {
  name: 'db-tenants',
  routeBase: '/api/db-tenants',
  requiredRole: 'superuser',  // CRITICAL: Only superuser access
  description: 'Database tenant and plugin access management',
};
```

### Model Layer
**File:** `plugins/db-tenants/model.js`

**CRITICAL PATTERN:**
```javascript
class DbTenantsModel {
  constructor(pool) {
    this.pool = pool;  // Railway pool ONLY - no tenant routing needed
  }
  
  // NO getPool(req) method - always use Railway pool
  // This plugin manages CENTRAL data, not tenant-specific data
}
```

**Required Methods:**

```javascript
// Get all tenants with plugin counts
async getAllTenants() {
  const query = `
    SELECT 
      u.id,
      u.email,
      u.role,
      u.created_at,
      COUNT(upa.plugin_name) as plugin_count,
      t.neon_project_id,
      t.neon_database_name
    FROM users u
    LEFT JOIN user_plugin_access upa ON u.id = upa.user_id AND upa.enabled = true
    LEFT JOIN tenants t ON u.id = t.user_id
    GROUP BY u.id, u.email, u.role, u.created_at, t.neon_project_id, t.neon_database_name
    ORDER BY u.created_at DESC
  `;
  
  const result = await this.pool.query(query);
  return result.rows;
}

// Get single tenant with detailed plugin access
async getTenantById(tenantId) {
  // Get tenant user info
  const userQuery = `
    SELECT u.id, u.email, u.role, u.created_at,
           t.neon_project_id, t.neon_database_name
    FROM users u
    LEFT JOIN tenants t ON u.id = t.user_id
    WHERE u.id = $1
  `;
  
  const userResult = await this.pool.query(userQuery, [tenantId]);
  if (userResult.rows.length === 0) {
    throw new Error('Tenant not found');
  }
  
  // Get current plugin access
  const pluginsQuery = `
    SELECT plugin_name, enabled
    FROM user_plugin_access
    WHERE user_id = $1
  `;
  
  const pluginsResult = await this.pool.query(pluginsQuery, [tenantId]);
  
  return {
    ...userResult.rows[0],
    plugins: pluginsResult.rows
  };
}

// Update tenant plugin access
async updateTenantPlugins(tenantId, pluginNames) {
  const client = await this.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Remove all existing access
    await client.query(
      'DELETE FROM user_plugin_access WHERE user_id = $1',
      [tenantId]
    );
    
    // Insert new access
    if (pluginNames.length > 0) {
      const values = pluginNames.map((name, i) => 
        `($1, $${i + 2}, true)`
      ).join(', ');
      
      await client.query(
        `INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ${values}`,
        [tenantId, ...pluginNames]
      );
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Controller Layer
**File:** `plugins/db-tenants/controller.js`

**CRITICAL PATTERN:**
```javascript
class DbTenantsController {
  constructor(model) {
    this.model = model;
  }
  
  // NO getUserId(req) method - works with any user_id from request params
  // NO req parameter to model calls - Railway pool is used directly
}
```

**Required Methods:**

```javascript
async getAllTenants(req, res) {
  try {
    const tenants = await this.model.getAllTenants();
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
}

async getTenant(req, res) {
  try {
    const { id } = req.params;
    const tenant = await this.model.getTenantById(id);
    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    if (error.message === 'Tenant not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
}

async updateTenantPlugins(req, res) {
  try {
    const { id } = req.params;
    const { plugins } = req.body;
    
    if (!Array.isArray(plugins)) {
      return res.status(400).json({ error: 'Plugins must be an array' });
    }
    
    await this.model.updateTenantPlugins(id, plugins);
    
    // Return updated tenant data
    const updatedTenant = await this.model.getTenantById(id);
    res.json(updatedTenant);
  } catch (error) {
    console.error('Error updating tenant plugins:', error);
    res.status(500).json({ error: 'Failed to update tenant plugins' });
  }
}
```

### Routes
**File:** `plugins/db-tenants/routes.js`

```javascript
const express = require('express');

function createDbTenantsRoutes(controller, requirePlugin) {
  const router = express.Router();

  // All routes require superuser via plugin access
  router.get('/', requirePlugin('db-tenants'), (req, res) => 
    controller.getAllTenants(req, res));
  
  router.get('/:id', requirePlugin('db-tenants'), (req, res) => 
    controller.getTenant(req, res));
  
  router.put('/:id/plugins', requirePlugin('db-tenants'), (req, res) => 
    controller.updateTenantPlugins(req, res));

  return router;
}

module.exports = createDbTenantsRoutes;
```

---

## 💻 Frontend Implementation

### TypeScript Types
**File:** `client/src/plugins/db-tenants/types/db-tenants.ts`

```typescript
export interface DbTenant {
  id: number;
  email: string;
  role: string;
  created_at: Date;
  plugin_count: number;
  neon_project_id: string | null;
  neon_database_name: string | null;
  plugins?: DbTenantPlugin[];
}

export interface DbTenantPlugin {
  plugin_name: string;
  enabled: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}
```

### API Layer
**File:** `client/src/plugins/db-tenants/api/dbTenantsApi.ts`

```typescript
class DbTenantsApi {
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`/api/db-tenants${endpoint}`, {
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

  async getAllTenants() {
    return this.request('');
  }

  async getTenant(id: number) {
    return this.request(`/${id}`);
  }

  async updateTenantPlugins(id: number, plugins: string[]) {
    return this.request(`/${id}/plugins`, {
      method: 'PUT',
      body: JSON.stringify({ plugins }),
    });
  }
}

export const dbTenantsApi = new DbTenantsApi();
```

### Context
**File:** `client/src/plugins/db-tenants/context/DbTenantsContext.tsx`

**CRITICAL DIFFERENCES from standard plugin context:**

```typescript
// NO panelMode needed - only List and View, no Form/Edit
// NO currentDbTenant state - view shows data directly from API
// Simplified state management

interface DbTenantsContextType {
  // Panel State
  isDbTenantsPanelOpen: boolean;
  selectedTenant: DbTenant | null;
  validationErrors: ValidationError[];
  
  // Data State
  dbTenants: DbTenant[];
  availablePlugins: string[];  // NEW: List of all possible plugins
  
  // Actions
  openDbTenantPanel: (tenant: DbTenant) => void;
  closeDbTenantPanel: () => void;
  updateTenantPlugins: (tenantId: number, plugins: string[]) => Promise<boolean>;
  clearValidationErrors: () => void;
}
```

**Available Plugins Logic:**
```typescript
// Get all available plugins from PLUGIN_REGISTRY
const availablePlugins = PLUGIN_REGISTRY.map(plugin => plugin.name);
```

### List Component
**File:** `client/src/plugins/db-tenants/components/DbTenantsList.tsx`

Standard responsive list showing:
- Email (clickable)
- Role badge
- Plugin count
- Neon project ID
- Created date

### View Component
**File:** `client/src/plugins/db-tenants/components/DbTenantsView.tsx`

**Key Features:**

```typescript
// Tenant Info Section
<Card>
  <h3>Tenant Information</h3>
  <div>Email: {tenant.email}</div>
  <div>Role: {tenant.role}</div>
  <div>Created: {formatDate(tenant.created_at)}</div>
  <div>Neon Project: {tenant.neon_project_id}</div>
</Card>

// Plugin Access Section
<Card>
  <h3>Plugin Access</h3>
  <div className="space-y-2">
    {availablePlugins.map(pluginName => (
      <label key={pluginName} className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={selectedPlugins.includes(pluginName)}
          onChange={() => handlePluginToggle(pluginName)}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium">{formatPluginName(pluginName)}</span>
      </label>
    ))}
  </div>
  
  <Button onClick={handleSave}>Save Changes</Button>
</Card>
```

---

## 🔐 Access Control

### Superuser Only Access

**Backend Protection:**
```javascript
// In plugin.config.js
requiredRole: 'superuser'

// In routes.js
requirePlugin('db-tenants')  // Checks user_plugin_access table
```

**Frontend Protection:**
```typescript
// Plugin only appears in sidebar if:
// 1. User role is 'superuser'
// 2. User has 'db-tenants' in plugins array
// 3. Plugin is registered in PLUGIN_REGISTRY with navigation
```

**Grant Superuser Access:**
```sql
-- In Railway PostgreSQL
INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
VALUES (1, 'db-tenants', true);  -- user_id 1 = first superuser
```

---

## 📝 Plugin Registry Integration

**File:** `client/src/core/pluginRegistry.ts`

```typescript
import { Shield } from 'lucide-react';  // Admin icon
import { DbTenantsProvider } from '@/plugins/db-tenants/context/DbTenantsContext';
import { useDbTenants } from '@/plugins/db-tenants/hooks/useDbTenants';
import { DbTenantsList } from '@/plugins/db-tenants/components/DbTenantsList';
import { DbTenantsView } from '@/plugins/db-tenants/components/DbTenantsView';

// Add to PLUGIN_REGISTRY array:
{
  name: 'db-tenants',
  Provider: DbTenantsProvider,
  hook: useDbTenants,
  panelKey: 'isDbTenantsPanelOpen',
  components: {
    List: DbTenantsList,
    Form: DbTenantsList,  // Not used, but required by system
    View: DbTenantsView,
  },
  navigation: {
    label: 'DB Tenants',
    icon: Shield,
    category: 'Account',
    order: 2,
  }
}
```

---

## 🧪 Testing Strategy

### Backend Testing
```bash
# Get all tenants
curl http://localhost:3002/api/db-tenants \
  --cookie cookies.txt

# Get specific tenant
curl http://localhost:3002/api/db-tenants/10 \
  --cookie cookies.txt

# Update tenant plugins
curl -X PUT http://localhost:3002/api/db-tenants/10/plugins \
  -H "Content-Type: application/json" \
  -d '{"plugins": ["contacts", "notes", "tasks"]}' \
  --cookie cookies.txt
```

### Frontend Testing
1. Login as superuser
2. Navigate to "DB Tenants" in sidebar
3. List should show all users
4. Click on a tenant
5. View shows tenant info + plugin checkboxes
6. Check/uncheck plugins
7. Click "Save Changes"
8. Verify success message
9. Logout and login as that tenant
10. Verify new plugins appear in sidebar

### Database Verification
```sql
-- Check tenant's plugin access
SELECT * FROM user_plugin_access WHERE user_id = 10;

-- Expected after update:
-- user_id | plugin_name | enabled
-- 10      | contacts    | true
-- 10      | notes       | true
-- 10      | tasks       | true
```

---

## 🚀 Implementation Checklist

### Backend (5 minutes)
- [ ] Create `plugins/db-tenants/` directory
- [ ] Create `plugin.config.js` with superuser requirement
- [ ] Create `model.js` with Railway pool queries
- [ ] Create `controller.js` with CRUD operations
- [ ] Create `routes.js` with PUT endpoint for plugin updates
- [ ] Create `index.js` for plugin initialization

### Frontend (15 minutes)
- [ ] Create `client/src/plugins/db-tenants/` directory
- [ ] Create TypeScript types
- [ ] Create API layer
- [ ] Create Context with simplified state (no panelMode)
- [ ] Create DbTenantsList component (responsive)
- [ ] Create DbTenantsView component with checkboxes
- [ ] Create hook `useDbTenants.ts`

### Integration (5 minutes)
- [ ] Add to `pluginRegistry.ts` with Shield icon
- [ ] Grant superuser access via SQL
- [ ] Test backend endpoints with curl
- [ ] Test frontend workflow
- [ ] Verify plugin changes reflect in tenant's sidebar

---

## ⚠️ Critical Implementation Notes

### 1. Railway Pool ONLY
```javascript
// ❌ WRONG - Do not use tenant routing pattern
class DbTenantsModel {
  getPool(req) {
    return req.tenantPool || this.defaultPool;
  }
}

// ✅ CORRECT - Always use Railway pool
class DbTenantsModel {
  constructor(pool) {
    this.pool = pool;  // Railway pool for central data
  }
}
```

### 2. No Form Component Needed
- Tenant creation handled by signup endpoint
- Only List and View components required
- No edit mode or panelMode state

### 3. Plugin Names Must Match Registry
```typescript
// Available plugins come from PLUGIN_REGISTRY
const availablePlugins = PLUGIN_REGISTRY.map(p => p.name);

// Ensure checkbox values match exactly:
// 'contacts', 'notes', 'tasks', 'estimates', 'invoices', 'files'
```

### 4. Transactional Plugin Updates
```javascript
// Use BEGIN/COMMIT for atomic updates
// DELETE all, then INSERT new - prevents partial states
```

---

## 🔮 Future Enhancements

### Phase 2: Role Management
```typescript
// Add role dropdown in view
<select value={tenant.role} onChange={handleRoleChange}>
  <option value="user">User</option>
  <option value="admin">Admin</option>
  <option value="superuser">Superuser</option>
</select>
```

### Phase 3: Tenant Statistics
```typescript
// Show usage metrics
interface TenantStats {
  total_contacts: number;
  total_notes: number;
  storage_used: number;
  last_login: Date;
}
```

### Phase 4: Neon Database Management
```typescript
// Add buttons for:
- View database details
- Trigger manual migration
- Delete tenant database (with confirmation)
```

---

## 📚 Reference Implementation

**Use these as templates:**
- Backend: `plugins/contacts/` (but without tenant routing)
- Frontend: `client/src/plugins/contacts/` (simplified - no Form)
- List: ContactList component pattern
- View: ContactView component pattern (add checkboxes)

**Key Difference:**
This plugin manages CENTRAL data (Railway PostgreSQL), not tenant-specific data (Neon databases).

---

## ✅ Success Criteria

Plugin is ready when:
- ✅ Superuser can see all tenants in list
- ✅ Clicking tenant opens view with current plugin access
- ✅ Checkboxes correctly reflect enabled plugins
- ✅ Saving updates `user_plugin_access` table
- ✅ Tenant's next login shows updated sidebar
- ✅ Backend returns proper errors for invalid data
- ✅ Frontend shows loading states and success/error messages
- ✅ Mobile responsive design works

---

## 🎯 Final Notes

**Development Time:** 15-25 minutes (verified pattern)  
**Complexity:** Medium (simpler than standard plugins - no Form)  
**Database:** Railway PostgreSQL ONLY (critical!)  
**Access:** Superuser only via `user_plugin_access`  
**Testing:** Backend with curl, frontend with superuser login  

**This plugin is the foundation for all future tenant administration features.**

---

**Document Created:** 2025-12-02  
**For:** Next AI agent/chat session  
**Status:** Ready for immediate implementation  
**Estimated Completion:** 25 minutes from start to deployment