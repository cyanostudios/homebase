# Backend Plugin Development Guide

## Overview

Backend plugins provide database operations, API routes, and business logic. Development time: **5 minutes** using templates.

**Template:** Copy entire `templates/plugin-backend-template/` directory and customize.

## Plugin Structure

```
plugins/my-plugin/
├── plugin.config.js    # Plugin metadata and routing
├── model.js           # Database operations
├── controller.js      # Business logic
├── routes.js          # Express routes
└── index.js          # Plugin initialization
```

## Step-by-Step Development

### 1. Create Plugin Structure
```bash
# Copy backend template
cp -r templates/plugin-backend-template plugins/my-plugin
cd plugins/my-plugin
```

### 2. Plugin Configuration
**plugins/my-plugin/plugin.config.js:**
```javascript
module.exports = {
  name: 'my-plugin',
  routeBase: '/api/my-plugin',
  requiredRole: 'user',
  description: 'My plugin description',
};
```

### 3. Database Model
**plugins/my-plugin/model.js:**
```javascript
const db = require('../../server/database');

class MyPluginModel {
  // Create item
  async createItem(userId, itemData) {
    const query = `
      INSERT INTO my_plugin_items (user_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `;
    
    const result = await db.query(query, [
      userId,
      itemData.title,
      itemData.content
    ]);
    
    return this.getItemById(userId, result.insertId);
  }

  // Get all items for user
  async getItemsByUser(userId) {
    const query = `
      SELECT * FROM my_plugin_items 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `;
    
    return db.query(query, [userId]);
  }

  // Get single item
  async getItemById(userId, itemId) {
    const query = `
      SELECT * FROM my_plugin_items 
      WHERE id = ? AND user_id = ?
    `;
    
    const results = await db.query(query, [itemId, userId]);
    if (results.length === 0) {
      throw new Error('Item not found or access denied');
    }
    
    return results[0];
  }

  // Update item
  async updateItem(userId, itemId, itemData) {
    // Verify ownership
    await this.getItemById(userId, itemId);
    
    const query = `
      UPDATE my_plugin_items 
      SET title = ?, content = ?, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `;
    
    await db.query(query, [
      itemData.title,
      itemData.content,
      itemId,
      userId
    ]);
    
    return this.getItemById(userId, itemId);
  }

  // Delete item
  async deleteItem(userId, itemId) {
    // Verify ownership
    await this.getItemById(userId, itemId);
    
    const query = `DELETE FROM my_plugin_items WHERE id = ? AND user_id = ?`;
    await db.query(query, [itemId, userId]);
  }
}

module.exports = new MyPluginModel();
```

### 4. Controller Logic
**plugins/my-plugin/controller.js:**
```javascript
const model = require('./model');

class MyPluginController {
  // Get all items
  async getItems(req, res) {
    try {
      const userId = req.session.user.id;
      const items = await model.getItemsByUser(userId);
      res.json(items);
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ error: 'Failed to fetch items' });
    }
  }

  // Get single item
  async getItem(req, res) {
    try {
      const userId = req.session.user.id;
      const { id } = req.params;
      
      const item = await model.getItemById(userId, id);
      res.json(item);
    } catch (error) {
      console.error('Error fetching item:', error);
      if (error.message === 'Item not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to fetch item' });
    }
  }

  // Create item
  async createItem(req, res) {
    try {
      const userId = req.session.user.id;
      const itemData = req.body;
      
      // Validation
      if (!itemData.title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const item = await model.createItem(userId, itemData);
      res.status(201).json(item);
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).json({ error: 'Failed to create item' });
    }
  }

  // Update item
  async updateItem(req, res) {
    try {
      const userId = req.session.user.id;
      const { id } = req.params;
      const itemData = req.body;
      
      // Validation
      if (!itemData.title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      const item = await model.updateItem(userId, id, itemData);
      res.json(item);
    } catch (error) {
      console.error('Error updating item:', error);
      if (error.message === 'Item not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update item' });
    }
  }

  // Delete item
  async deleteItem(req, res) {
    try {
      const userId = req.session.user.id;
      const { id } = req.params;
      
      await model.deleteItem(userId, id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting item:', error);
      if (error.message === 'Item not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete item' });
    }
  }
}

module.exports = new MyPluginController();
```

### 5. Express Routes
**plugins/my-plugin/routes.js:**
```javascript
const express = require('express');

function createMyPluginRoutes(controller, requirePlugin) {
  const router = express.Router();

  // All routes require plugin access
  router.get('/', requirePlugin('my-plugin'), (req, res) => 
    controller.getItems(req, res));
  
  router.post('/', requirePlugin('my-plugin'), (req, res) => 
    controller.createItem(req, res));
  
  router.get('/:id', requirePlugin('my-plugin'), (req, res) => 
    controller.getItem(req, res));
  
  router.put('/:id', requirePlugin('my-plugin'), (req, res) => 
    controller.updateItem(req, res));
  
  router.delete('/:id', requirePlugin('my-plugin'), (req, res) => 
    controller.deleteItem(req, res));

  return router;
}

module.exports = createMyPluginRoutes;
```

### 6. Plugin Initialization
**plugins/my-plugin/index.js:**
```javascript
const config = require('./plugin.config');
const controller = require('./controller');
const createRoutes = require('./routes');

module.exports = {
  config,
  controller,
  createRoutes,
};
```

## Database Integration

### Create Database Table
```sql
CREATE TABLE IF NOT EXISTS my_plugin_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

### Grant Plugin Access
```sql
INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
SELECT id, 'my-plugin', true FROM users WHERE role = 'superuser';
```

## Security Best Practices

### Input Validation
- Always validate required fields
- Sanitize input data
- Use parameterized queries
- Verify user ownership

### Authentication
- All routes require authentication via `requirePlugin`
- User ID from session: `req.session.user.id`
- Verify user has plugin access

### Error Handling
- Log errors server-side
- Return generic error messages
- Use appropriate HTTP status codes
- Don't expose sensitive information

## Testing Backend

### 1. Check Plugin Loading
```bash
npm run dev
# Look for: 🟢 Loaded plugin: my-plugin (/api/my-plugin)
```

### 2. Test API Endpoints
```bash
# Create item
curl -X POST http://localhost:3002/api/my-plugin \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Item","content":"Test content"}' \
  --cookie-jar cookies.txt

# Get items
curl http://localhost:3002/api/my-plugin --cookie cookies.txt

# Update item
curl -X PUT http://localhost:3002/api/my-plugin/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Item","content":"Updated content"}' \
  --cookie cookies.txt

# Delete item
curl -X DELETE http://localhost:3002/api/my-plugin/1 --cookie cookies.txt
```

### 3. Verify Database
```sql
-- Check table creation
SHOW TABLES LIKE 'my_plugin_items';

-- Check data
SELECT * FROM my_plugin_items;

-- Check plugin access
SELECT * FROM user_plugin_access WHERE plugin_name = 'my-plugin';
```

## Common Issues

### Plugin Not Loading
- Check `plugin.config.js` syntax
- Verify all required files exist
- Check server logs for errors

### Database Errors
- Verify table exists
- Check column names match model
- Ensure foreign key constraints

### Authentication Errors
- User must be logged in
- User must have plugin access
- Check `requirePlugin` middleware

---

**Development Time:** 5 minutes using templates  
**Security:** Production-grade authentication and validation  
**Performance:** Optimized queries with proper indexing  

*Copy `templates/plugin-backend-template` structure for fastest development.*