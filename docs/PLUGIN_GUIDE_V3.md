# Plugin Development Guide v3 - Full-Stack Modular Architecture

## Overview

Homebase v6+ plugins are production-ready, full-stack modules with complete separation of frontend and backend concerns. This guide demonstrates the complete modular architecture we successfully implemented, combining frontend plugin patterns with backend plugin modularity.

## Plugin Philosophy (v3 - Full-Stack Modular)

**Complete Modular Architecture:**
- **Frontend plugins:** Self-contained React components with TypeScript
- **Backend plugins:** Modular server components with automatic loading
- **Database-first design:** PostgreSQL/MySQL integration with native queries
- **Authentication integration:** Complete session management and access control
- **Cross-plugin references:** @mention system connecting different plugins
- **Dynamic loading:** Plugin-loader system for automatic registration
- **Team independence:** Frontend and backend teams can work in parallel
- **Production ready:** CommonJS compatible with hosting environments

## Architecture Overview (v3)

### Frontend Structure (Client-side)
```
client/src/plugins/[plugin-name]/
├── types/
│   └── [plugin-name].ts     # TypeScript interfaces + mention types
└── components/
    ├── [Name]List.tsx       # List view with mobile cards + sorting
    ├── [Name]Form.tsx       # Form with API integration + @mentions
    └── [Name]View.tsx       # View with cross-plugin references
```

### Backend Structure (Server-side) - NEW v3
```
plugins/[plugin-name]/
├── plugin.config.js         # Plugin metadata and configuration
├── model.js                 # Database operations and data transformation
├── controller.js            # Request handling and business logic
├── routes.js                # Express route definitions
└── index.js                 # Plugin initialization and export
```

### Core Infrastructure (v3)
```
├── plugin-loader.js         # Dynamic plugin loading system
├── server/index.ts          # Main server (187 lines vs 486 lines before)
├── client/src/core/         # Shared frontend components
└── scripts/                 # Database setup and utilities
```

## Backend Plugin Architecture (v3 - NEW)

### 1. Plugin Configuration

**File:** `plugins/[plugin-name]/plugin.config.js`

```javascript
module.exports = {
  name: 'plugin-name',
  routeBase: '/api/plugin-name',
  requiredRole: 'user',
  description: 'Plugin description for admin dashboard',
};
```

### 2. Database Model Layer

**File:** `plugins/[plugin-name]/model.js`

```javascript
class PluginModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT * FROM plugin_table WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(this.transformRow);
  }

  async create(userId, data) {
    const result = await this.pool.query(`
      INSERT INTO plugin_table (user_id, title, content, mentions)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [userId, data.title, data.content, JSON.stringify(data.mentions || [])]);
    
    return this.transformRow(result.rows[0]);
  }

  async update(userId, itemId, data) {
    const result = await this.pool.query(`
      UPDATE plugin_table SET
        title = $1, content = $2, mentions = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5 RETURNING *
    `, [data.title, data.content, JSON.stringify(data.mentions || []), itemId, userId]);
    
    if (!result.rows.length) {
      throw new Error('Item not found');
    }
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, itemId) {
    const result = await this.pool.query(
      'DELETE FROM plugin_table WHERE id = $1 AND user_id = $2 RETURNING id',
      [itemId, userId]
    );
    
    if (!result.rows.length) {
      throw new Error('Item not found');
    }
    return { id: itemId };
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: row.mentions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = PluginModel;
```

### 3. Controller Layer

**File:** `plugins/[plugin-name]/controller.js`

```javascript
class PluginController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const items = await this.model.getAll(req.session.user.id);
      res.json(items);
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  async create(req, res) {
    try {
      const item = await this.model.create(req.session.user.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Create item error:', error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }

  async update(req, res) {
    try {
      const item = await this.model.update(
        req.session.user.id,
        req.params.id,
        req.body
      );
      res.json(item);
    } catch (error) {
      console.error('Update item error:', error);
      if (error.message === 'Item not found') {
        res.status(404).json({ error: 'Item not found' });
      } else {
        res.status(500).json({ error: 'Failed to update item' });
      }
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req.session.user.id, req.params.id);
      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      if (error.message === 'Item not found') {
        res.status(404).json({ error: 'Item not found' });
      } else {
        res.status(500).json({ error: 'Failed to delete item' });
      }
    }
  }
}

module.exports = PluginController;
```

### 4. Routes Definition

**File:** `plugins/[plugin-name]/routes.js`

```javascript
const express = require('express');
const router = express.Router();

function createPluginRoutes(controller, requirePlugin) {
  // GET /api/plugin-name
  router.get('/', requirePlugin('plugin-name'), (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/plugin-name
  router.post('/', requirePlugin('plugin-name'), (req, res) => {
    controller.create(req, res);
  });

  // PUT /api/plugin-name/:id
  router.put('/:id', requirePlugin('plugin-name'), (req, res) => {
    controller.update(req, res);
  });

  // DELETE /api/plugin-name/:id
  router.delete('/:id', requirePlugin('plugin-name'), (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createPluginRoutes;
```

### 5. Plugin Initialization

**File:** `plugins/[plugin-name]/index.js`

```javascript
const PluginModel = require('./model');
const PluginController = require('./controller');
const createPluginRoutes = require('./routes');
const config = require('./plugin.config');

function initializePlugin(pool, requirePlugin) {
  const model = new PluginModel(pool);
  const controller = new PluginController(model);
  const router = createPluginRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializePlugin;
```

## Plugin Loader System (v3 - NEW)

**File:** `plugin-loader.js`

```javascript
const fs = require('fs');
const path = require('path');

class PluginLoader {
  constructor(pool, requirePlugin) {
    this.pool = pool;
    this.requirePlugin = requirePlugin;
    this.loadedPlugins = new Map();
  }

  loadPlugins(app) {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
      console.log('📁 No plugins directory found, skipping plugin loading');
      return;
    }

    const pluginDirs = fs.readdirSync(pluginsDir).filter(dir => {
      const pluginPath = path.join(pluginsDir, dir);
      return fs.statSync(pluginPath).isDirectory();
    });

    console.log(`🔌 Loading ${pluginDirs.length} plugins...`);

    pluginDirs.forEach((pluginName) => {
      try {
        this.loadPlugin(app, pluginName);
      } catch (error) {
        console.error(`❌ Failed to load plugin '${pluginName}':`, error.message);
      }
    });

    console.log(`✅ Successfully loaded ${this.loadedPlugins.size} plugins`);
  }

  loadPlugin(app, pluginName) {
    const pluginPath = path.join(__dirname, 'plugins', pluginName);
    
    // Check if plugin has required files
    const requiredFiles = ['index.js', 'plugin.config.js'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(pluginPath, file))) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // Load plugin
    const initializePlugin = require(pluginPath);
    const plugin = initializePlugin(this.pool, this.requirePlugin);
    
    if (!plugin.config || !plugin.router) {
      throw new Error('Plugin must export config and router');
    }

    // Register routes
    app.use(plugin.config.routeBase, plugin.router);
    
    // Store loaded plugin
    this.loadedPlugins.set(pluginName, plugin);
    
    console.log(`🟢 Loaded plugin: ${plugin.config.name} (${plugin.config.routeBase})`);
  }

  getPlugin(name) {
    return this.loadedPlugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.loadedPlugins.values()).map(plugin => plugin.config);
  }

  isPluginLoaded(name) {
    return this.loadedPlugins.has(name);
  }
}

module.exports = PluginLoader;
```

## Modular Server Architecture (v3 - NEW)

**File:** `server/index.ts` (Reduced from 486 to 187 lines - 61% reduction)

```javascript
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const PluginLoader = require('../plugin-loader');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3001',
  credentials: true,
}));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'sessions',
  }),
  secret: process.env.SESSION_SECRET || 'homebase-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlugin(pluginName) {
  return async (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Superuser has access to all plugins
    if (req.session.user.role === 'superuser') {
      return next();
    }
    
    // Check plugin access
    const result = await pool.query(
      'SELECT enabled FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
      [req.session.user.id, pluginName]
    );
    
    if (!result.rows.length || !result.rows[0].enabled) {
      return res.status(403).json({ error: `Access denied to ${pluginName} plugin` });
    }
    
    next();
  };
}

// Initialize plugin system
const pluginLoader = new PluginLoader(pool, requirePlugin);

// Health check
app.get('/api/health', (req, res) => {
  const loadedPlugins = pluginLoader.getAllPlugins();
  res.json({ 
    status: 'ok',
    database: 'connected',
    environment: process.env.NODE_ENV,
    plugins: loadedPlugins.map(p => ({ name: p.name, route: p.routeBase }))
  });
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Get user's plugin access
    const pluginAccess = await pool.query(
      'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
      [user.id]
    );
    
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: pluginAccess.rows.map(row => row.plugin_name),
    };
    
    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: req.session.user.plugins,
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Load all plugins
pluginLoader.loadPlugins(app);

// Plugin info endpoint
app.get('/api/plugins', requireAuth, (req, res) => {
  const plugins = pluginLoader.getAllPlugins();
  res.json(plugins);
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Homebase server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔌 Plugin system: Enabled`);
});

module.exports = app;
```

## Frontend Plugin Architecture (v3 - Maintained from v2)

### Frontend Plugin Structure

```typescript
// client/src/plugins/[plugin-name]/types/[plugin-name].ts
export interface PluginItem {
  id: string;
  title: string;
  content: string;
  mentions?: PluginMention[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginMention {
  contactId: string;
  contactName: string;
  companyName?: string;
  position: number;
  length: number;
}

export interface PluginFormValues {
  title: string;
  content: string;
  mentions?: PluginMention[];
}
```

### List Component Pattern

```typescript
// client/src/plugins/[plugin-name]/components/PluginList.tsx
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Search } from 'lucide-react';
import { useApp } from '@/core/api/AppContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';

export function PluginList() {
  const { 
    pluginItems,
    openPluginPanel,
    openPluginForEdit,
    openPluginForView,
    deletePluginItem 
  } = useApp();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Mobile-first responsive design
  const [isMobile, setIsMobile] = useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter and sort logic
  const filteredAndSortedItems = pluginItems
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

  // Mobile card view for responsive design
  if (isMobile) {
    return (
      <div className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Plugin Items</h1>
          <Button
            onClick={() => openPluginPanel(null)}
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
                    onClick={() => openPluginForView(item)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Edit}
                    onClick={() => openPluginForEdit(item)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => deletePluginItem(item.id)}
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
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Plugin Items</h1>
          <p className="text-gray-600">Manage your plugin data</p>
        </div>
        <Button
          onClick={() => openPluginPanel(null)}
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
                        onClick={() => openPluginForView(item)}
                      >
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                        onClick={() => openPluginForEdit(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => deletePluginItem(item.id)}
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
    </div>
  );
}
```

## Creating a New Plugin (v3 - Complete Workflow)

### Step 1: Backend Plugin Setup

**Terminal 3:** Create plugin directory structure:

```bash
mkdir -p plugins/my-plugin
touch plugins/my-plugin/plugin.config.js
touch plugins/my-plugin/model.js
touch plugins/my-plugin/controller.js
touch plugins/my-plugin/routes.js
touch plugins/my-plugin/index.js
```

### Step 2: Database Schema

Add to `scripts/setup-database.js`:

```sql
-- Add your plugin table
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

-- Add indexes for performance
await client.query('CREATE INDEX IF NOT EXISTS idx_my_plugin_user_id ON my_plugin_items(user_id)');
```

### Step 3: Plugin Access Control

```sql
-- Grant plugin access to users
INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
SELECT id, 'my-plugin', true FROM users WHERE role = 'superuser';
```

### Step 4: Backend Plugin Files

Copy and modify the plugin templates from the backend architecture section above, replacing 'plugin-name' with 'my-plugin' and updating table names and fields as needed.

### Step 5: Frontend Plugin Setup

**Terminal 3:** Create frontend plugin structure:

```bash
mkdir -p client/src/plugins/my-plugin/types
mkdir -p client/src/plugins/my-plugin/components
touch client/src/plugins/my-plugin/types/my-plugin.ts
touch client/src/plugins/my-plugin/components/MyPluginList.tsx
touch client/src/plugins/my-plugin/components/MyPluginForm.tsx
touch client/src/plugins/my-plugin/components/MyPluginView.tsx
```

### Step 6: AppContext Integration

Add plugin state and actions to `client/src/core/api/AppContext.tsx`:

```typescript
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
}
```

### Step 7: Test the Plugin

**Terminal 2:** Restart backend server:

```bash
npm run dev
```

You should see:
```
🔌 Loading 3 plugins...
🟢 Loaded plugin: contacts (/api/contacts)
🟢 Loaded plugin: notes (/api/notes)
🟢 Loaded plugin: my-plugin (/api/my-plugin)
✅ Successfully loaded 3 plugins
```

**Terminal 3:** Test API endpoints:

```bash
# Test health endpoint (should show new plugin)
curl http://localhost:3002/api/health

# Test authentication
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@homebase.se","password":"admin123"}' \
  -c cookies.txt

# Test new plugin endpoint
curl http://localhost:3002/api/my-plugin -b cookies.txt
```

## Production Examples (v3 - Real Implementation)

### Contacts Plugin (Production Ready)

**Backend Implementation:**

```javascript
// plugins/contacts/plugin.config.js
module.exports = {
  name: 'contacts',
  routeBase: '/api/contacts',
  requiredRole: 'user',
  description: 'Contact management plugin with full CRUD operations',
};

// plugins/contacts/model.js
class ContactModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT * FROM contacts WHERE user_id = $1 ORDER BY contact_number',
      [userId]
    );
    
    return result.rows.map(this.transformRow);
  }

  async create(userId, contactData) {
    const result = await this.pool.query(`
      INSERT INTO contacts (
        user_id, contact_number, contact_type, company_name, company_type,
        organization_number, vat_number, personal_number, contact_persons, addresses,
        email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `, [
      userId,
      contactData.contactNumber,
      contactData.contactType,
      contactData.companyName,
      contactData.companyType,
      contactData.organizationNumber,
      contactData.vatNumber,
      contactData.personalNumber,
      JSON.stringify(contactData.contactPersons || []),
      JSON.stringify(contactData.addresses || []),
      contactData.email,
      contactData.phone,
      contactData.phone2,
      contactData.website,
      contactData.taxRate,
      contactData.paymentTerms,
      contactData.currency,
      contactData.fTax,
      contactData.notes,
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      contactNumber: row.contact_number,
      contactType: row.contact_type,
      companyName: row.company_name,
      companyType: row.company_type || '',
      organizationNumber: row.organization_number || '',
      vatNumber: row.vat_number || '',
      personalNumber: row.personal_number || '',
      contactPersons: row.contact_persons || [],
      addresses: row.addresses || [],
      email: row.email || '',
      phone: row.phone || '',
      phone2: row.phone2 || '',
      website: row.website || '',
      taxRate: row.tax_rate || '',
      paymentTerms: row.payment_terms || '',
      currency: row.currency || '',
      fTax: row.f_tax || '',
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = ContactModel;
```

### Notes Plugin (Production Ready with @mentions)

**Backend Implementation:**

```javascript
// plugins/notes/plugin.config.js
module.exports = {
  name: 'notes',
  routeBase: '/api/notes',
  requiredRole: 'user',
  description: 'Notes management plugin with @mentions and cross-plugin references',
};

// plugins/notes/model.js
class NoteModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(this.transformRow);
  }

  async create(userId, noteData) {
    const { title, content, mentions } = noteData;
    
    const result = await this.pool.query(`
      INSERT INTO notes (user_id, title, content, mentions)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      userId,
      title,
      content,
      JSON.stringify(mentions || []),
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: row.mentions || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = NoteModel;
```

## Development Workflow (v3)

### Local Development Setup

**Terminal 1:** Frontend development server:
```bash
npx vite --config vite.config.ts
```

**Terminal 2:** Backend with plugin system:
```bash
npm run dev
```

**Terminal 3:** Commands and testing:
```bash
# Test plugin loading
curl http://localhost:3002/api/health

# Test specific plugins
curl http://localhost:3002/api/plugins -b cookies.txt
```

### Plugin Development Cycle

1. **Create Backend Plugin** (5-10 minutes)
   - Add database schema
   - Create plugin files using templates
   - Test API endpoints

2. **Create Frontend Plugin** (15-20 minutes)
   - Create TypeScript interfaces
   - Build List, Form, View components
   - Integrate with AppContext

3. **Test Integration** (5 minutes)
   - Verify backend plugin loads
   - Test frontend CRUD operations
   - Verify cross-plugin @mentions work

### Production Deployment

**Migration Strategy:**
1. **Backup current server:** `cp server/index.ts server/index-old.ts`
2. **Deploy modular server:** Uses new plugin-loader system
3. **Test all functionality:** Verify no regression in features
4. **Monitor plugin loading:** Check server logs for plugin status

## Benefits of v3 Architecture

### Code Organization
- **Main server reduced:** 486 lines → 187 lines (61% reduction)
- **Modular plugins:** Each plugin self-contained
- **Clear separation:** Frontend/backend plugin boundaries
- **Team independence:** Multiple teams can work in parallel

### Scalability
- **Dynamic loading:** Plugins auto-discovered and loaded
- **Per-customer plugins:** Easy to enable/disable plugins per installation
- **Performance:** Only load needed plugins
- **Maintenance:** Debug/update individual plugins without affecting others

### Development Speed
- **Plugin templates:** Rapid development using established patterns
- **Consistent APIs:** All plugins follow same CRUD patterns
- **Cross-references:** Built-in @mention system for plugin connections
- **Testing:** Isolated testing of individual plugins

### Production Ready
- **Authentication:** Complete session management and access control
- **Security:** Plugin-level permissions and validation
- **Error handling:** Graceful failures and comprehensive logging
- **Database optimization:** Proper indexing and query performance

## Migration Guide (v2 → v3)

### For Existing Plugins

1. **Extract routes from server/index.ts**
2. **Create plugin directory structure**
3. **Split code into model/controller/routes**
4. **Test plugin loads correctly**
5. **Verify frontend integration intact**

### For New Plugins

1. **Use provided templates**
2. **Follow contacts/notes patterns exactly**
3. **Implement all CRUD operations**
4. **Add proper error handling**
5. **Test with authentication**

## Troubleshooting (v3)

### Plugin Loading Issues

**Plugin not loading:**
```bash
# Check plugin directory structure
ls -la plugins/my-plugin/

# Check required files exist
ls -la plugins/my-plugin/index.js plugins/my-plugin/plugin.config.js

# Check server logs for specific error
npm run dev
```

**Authentication errors:**
```bash
# Test plugin access permissions
SELECT * FROM user_plugin_access WHERE plugin_name = 'my-plugin';

# Grant access if needed
INSERT INTO user_plugin_access (user_id, plugin_name, enabled) 
VALUES (1, 'my-plugin', true);
```

### Database Issues

**Model errors:**
- Verify table exists in database
- Check column names match transformRow method
- Ensure proper JSON handling for arrays/objects

**Connection issues:**
- Verify DATABASE_URL environment variable
- Check PostgreSQL service running
- Test database connectivity

### API Testing

**Quick plugin test:**
```bash
# Test plugin endpoints individually
curl http://localhost:3002/api/health
curl http://localhost:3002/api/my-plugin -b cookies.txt
curl -X POST http://localhost:3002/api/my-plugin \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content"}' \
  -b cookies.txt
```

## Future Enhancements (v3+)

### Plugin Marketplace
- Plugin discovery system
- Version management
- Dependency handling
- Community plugins

### Advanced Features
- Plugin-to-plugin APIs
- Shared plugin components
- Plugin configuration UI
- Analytics and monitoring

### Enterprise Features
- Multi-tenant plugin support
- Advanced permissions
- Plugin sandboxing
- Performance monitoring

## Conclusion

Plugin Guide v3 represents a complete full-stack modular architecture that successfully combines:

- **Backend modularity** with dynamic plugin loading
- **Frontend component patterns** with responsive design
- **Database integration** with proper abstractions
- **Authentication and security** with fine-grained permissions
- **Cross-plugin references** with @mention system
- **Production readiness** with comprehensive error handling

This architecture enables rapid development of new business features while maintaining code quality, security, and scalability. The 61% reduction in main server code demonstrates the effectiveness of the modular approach.

**Key Achievement:** Transformed a monolithic 486-line server into a modular system with automatic plugin discovery, maintaining 100% functionality while dramatically improving maintainability and development speed.

---

*Last Updated: July 19, 2025 - v3 Full-Stack Modular Architecture*
*Successfully implemented and tested in production environment*