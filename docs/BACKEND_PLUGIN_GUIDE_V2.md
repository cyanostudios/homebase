# Backend Plugin Development Guide

## Overview

Backend plugins provide database operations, API routes, and business logic using core services architecture with security enforcement at every layer.

## Key Features

- Use @homebase/core SDK for stable interfaces
- Use core services (ServiceManager) instead of direct infrastructure
- Security enforced through middleware and adapters
- Standardized error handling
- Audit logging built-in
- Tenant isolation automatic

Plugin Structure
plugins/my-plugin/
├── plugin.config.js # Plugin metadata and routing
├── model.js # Business logic using core services
├── controller.js # Request handling with validation
├── routes.js # Express routes with security middleware
└── index.js # Plugin initialization

Step-by-Step Development

1. Plugin Configuration
   plugins/my-plugin/plugin.config.js:
   module.exports = {
   name: 'my-plugin',
   routeBase: '/api/my-plugin',
   requiredRole: 'user',
   description: 'My plugin description',

// Security settings
security: {
rateLimits: {
global: { windowMs: 15 _ 60 _ 1000, max: 100 },
create: { windowMs: 60 \* 1000, max: 10 }
},
auditLog: true
}
};

2. Model Layer (Using @homebase/core SDK)
   plugins/my-plugin/model.js:
   const { Logger, Database } = require('@homebase/core');
   const { AppError } = require('../../server/core/errors');

class MyPluginModel {
// Create item
async createItem(req, itemData) {
try {
// Validation
this.validateItem(itemData);

      // Get database instance for current request
      const db = Database.get(req);

      // Insert (tenant isolation automatic)
      const result = await db.insert('my_plugin_items', {
        title: itemData.title,
        content: itemData.content,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Audit log
      Logger.info('Item created', {
        itemId: result.id,
        title: itemData.title
      });

      return this.getItemById(result.id);

    } catch (error) {
      Logger.error('Failed to create item', error, { itemData });
      throw new AppError('Failed to create item', 500, 'CREATE_FAILED');
    }

}

// Get all items for current user
async getItemsByUser(req) {
try {
const db = Database.get(req);

      // Tenant filtering automatic - no userId needed
      const result = await db.query(
        'SELECT * FROM my_plugin_items ORDER BY created_at DESC',
        []
      );

      return result.rows;
        []
      );
    } catch (error) {
      logger.error('Failed to fetch items', error);
      throw new AppError('Failed to fetch items', 500, 'FETCH_FAILED');
    }

}

// Get single item (with ownership verification)
async getItemById(itemId) {
const results = await database.query(
'SELECT \* FROM my_plugin_items WHERE id = ?',
[itemId]
);

    if (results.length === 0) {
      throw new AppError('Item not found', 404, 'NOT_FOUND');
    }

    return results[0];

}

// Update item
async updateItem(itemId, itemData) {
try {
// Verify item exists (ownership check automatic via tenant isolation)
await this.getItemById(itemId);

      // Validation
      this.validateItem(itemData);

      // Update
      await database.update('my_plugin_items', itemId, {
        title: itemData.title,
        content: itemData.content,
        updated_at: new Date()
      });

      logger.info('Item updated', { itemId });

      return this.getItemById(itemId);

    } catch (error) {
      if (error.code === 'NOT_FOUND') throw error;
      logger.error('Failed to update item', error, { itemId });
      throw new AppError('Failed to update item', 500, 'UPDATE_FAILED');
    }

}

// Delete item
async deleteItem(itemId) {
try {
// Verify item exists
await this.getItemById(itemId);

      // Delete
      await database.delete('my_plugin_items', itemId);

      logger.info('Item deleted', { itemId });

    } catch (error) {
      if (error.code === 'NOT_FOUND') throw error;
      logger.error('Failed to delete item', error, { itemId });
      throw new AppError('Failed to delete item', 500, 'DELETE_FAILED');
    }

}

// Validation
validateItem(itemData) {
if (!itemData.title?.trim()) {
throw new AppError('Title is required', 400, 'VALIDATION_ERROR');
}

    if (itemData.title.length > 255) {
      throw new AppError('Title too long (max 255 characters)', 400, 'VALIDATION_ERROR');
    }

}
}

module.exports = new MyPluginModel();
Key Changes:

✅ Use ServiceManager.get('database') instead of direct DB import
✅ Use logger instead of console.log
✅ Throw standardized AppError
✅ Tenant isolation automatic (no manual userId filtering)
✅ Audit logging for all operations

3. Controller Layer (Security & Validation)
   plugins/my-plugin/controller.js:
   const model = require('./model');
   const { AppError } = require('../../server/core/errors');

class MyPluginController {
// Get all items
async getItems(req, res, next) {
try {
const items = await model.getItemsByUser();
res.json(items);
} catch (error) {
next(error); // Pass to error handler middleware
}
}

// Get single item
async getItem(req, res, next) {
try {
const { id } = req.params;
const item = await model.getItemById(id);
res.json(item);
} catch (error) {
next(error);
}
}

// Create item
async createItem(req, res, next) {
try {
const itemData = req.body;

      // Additional business logic validation
      if (itemData.title && itemData.title.toLowerCase().includes('spam')) {
        throw new AppError('Invalid content detected', 400, 'VALIDATION_ERROR');
      }

      const item = await model.createItem(itemData);
      res.status(201).json(item);

    } catch (error) {
      next(error);
    }

}

// Update item
async updateItem(req, res, next) {
try {
const { id } = req.params;
const itemData = req.body;

      const item = await model.updateItem(id, itemData);
      res.json(item);

    } catch (error) {
      next(error);
    }

}

// Delete item
async deleteItem(req, res, next) {
try {
const { id } = req.params;
await model.deleteItem(id);
res.status(204).send();

    } catch (error) {
      next(error);
    }

}
}

module.exports = new MyPluginController();
Key Changes:

✅ All methods use try-catch with next(error) for centralized error handling
✅ No manual error response formatting (middleware handles it)
✅ Focus on business logic, not infrastructure

4. Routes Layer (Security Middleware)
   plugins/my-plugin/routes.js:
   const express = require('express');
   const { body, param, validationResult } = require('express-validator');
   const rateLimit = require('express-rate-limit');

// Validation middleware
const validateRequest = (req, res, next) => {
const errors = validationResult(req);
if (!errors.isEmpty()) {
return res.status(400).json({
error: 'Validation failed',
details: errors.array()
});
}
next();
};

// Rate limiter for create operations
const createLimiter = rateLimit({
windowMs: 60 \* 1000, // 1 minute
max: 10, // 10 requests per minute
message: 'Too many items created, please try again later'
});

function createMyPluginRoutes(controller, requirePlugin, csrfProtection) {
const router = express.Router();

// GET all items - read-only, no CSRF needed
router.get('/',
requirePlugin('my-plugin'),
(req, res, next) => controller.getItems(req, res, next)
);

// POST create item - with validation, CSRF, rate limiting
router.post('/',
requirePlugin('my-plugin'),
csrfProtection,
createLimiter,
[
body('title')
.trim()
.notEmpty().withMessage('Title is required')
.isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters')
.escape(),
body('content')
.optional()
.trim()
.isLength({ max: 5000 }).withMessage('Content too long (max 5000 characters)')
],
validateRequest,
(req, res, next) => controller.createItem(req, res, next)
);

// GET single item
router.get('/:id',
requirePlugin('my-plugin'),
[
param('id').isInt().withMessage('Invalid item ID')
],
validateRequest,
(req, res, next) => controller.getItem(req, res, next)
);

// PUT update item
router.put('/:id',
requirePlugin('my-plugin'),
csrfProtection,
[
param('id').isInt().withMessage('Invalid item ID'),
body('title')
.trim()
.notEmpty().withMessage('Title is required')
.isLength({ min: 1, max: 255 }).withMessage('Title must be 1-255 characters')
.escape(),
body('content')
.optional()
.trim()
.isLength({ max: 5000 }).withMessage('Content too long')
],
validateRequest,
(req, res, next) => controller.updateItem(req, res, next)
);

// DELETE item
router.delete('/:id',
requirePlugin('my-plugin'),
csrfProtection,
[
param('id').isInt().withMessage('Invalid item ID')
],
validateRequest,
(req, res, next) => controller.deleteItem(req, res, next)
);

return router;
}

module.exports = createMyPluginRoutes;
Key Changes:

✅ ALL routes require authentication (requirePlugin)
✅ POST/PUT/DELETE require CSRF protection
✅ Input validation with express-validator
✅ Rate limiting on create operations
✅ Centralized validation error handling
✅ HTML escaping to prevent XSS

5. Plugin Initialization
   plugins/my-plugin/index.js:
   const config = require('./plugin.config');
   const controller = require('./controller');
   const createRoutes = require('./routes');

module.exports = {
config,
controller,
createRoutes,
};
No changes needed - this pattern still works perfectly.

Database Integration
Create Database Table
Use migrations instead of raw SQL:
// migrations/001_create_my_plugin_items.js
module.exports = {
up: async (database) => {
await database.query(`
CREATE TABLE IF NOT EXISTS my_plugin_items (
id SERIAL PRIMARY KEY,
user_id INT NOT NULL,
title VARCHAR(255) NOT NULL,
content TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);

},

down: async (database) => {
await database.query('DROP TABLE IF EXISTS my_plugin_items');
}
};
Grant Plugin Access
sqlINSERT INTO user_plugin_access (user_id, plugin_name, enabled)
SELECT id, 'my-plugin', true FROM users WHERE role = 'superuser';

Advanced Patterns
Using Storage Service
For file uploads:
const ServiceManager = require('../../server/core/ServiceManager');
const storage = ServiceManager.get('storage');

async uploadAttachment(req, res, next) {
try {
const { id } = req.params;

    // Verify item ownership
    const item = await model.getItemById(id);

    // Upload file to cloud storage
    const fileURL = await storage.upload(
      req.file.buffer,
      `my-plugin/${id}/${req.file.originalname}`,
      {
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        maxSize: 10 * 1024 * 1024, // 10MB
        public: false
      }
    );

    // Update item with file reference
    await model.updateItem(id, {
      attachmentURL: fileURL
    });

    res.json({ fileURL });

} catch (error) {
next(error);
}
}

Using Email Service
For notifications:
const email = ServiceManager.get('email');

async sendNotification(itemId, recipientEmail) {
const item = await model.getItemById(itemId);

await email.send({
to: recipientEmail,
subject: `New Item: ${item.title}`,
html: `       <h2>${item.title}</h2>
      <p>${item.content}</p>
      <a href="${process.env.APP_URL}/items/${item.id}">View Item</a>
    `
});

logger.info('Notification sent', { itemId, recipientEmail });
}

Using Queue Service
For bulk operations:
const queue = ServiceManager.get('queue');

async bulkCreate(items) {
// Queue background job
const jobId = await queue.add('bulk-create-items', {
items,
userId: req.session.user.id
}, {
priority: 5,
attempts: 3
});

return { jobId, status: 'queued' };
}

// Process jobs
queue.process('bulk-create-items', async (job) => {
const { items } = job.data;

for (const itemData of items) {
await model.createItem(itemData);
}
});

Using Cache Service
For expensive queries:
const cache = ServiceManager.get('cache');

async getItemsByUser() {
// Try cache first
return await cache.wrap('my-plugin:items:all', async () => {
// Cache miss - fetch from database
return await database.query(
'SELECT \* FROM my_plugin_items ORDER BY created_at DESC',
[]
);
}, 300); // Cache for 5 minutes
}

async updateItem(itemId, itemData) {
// Update database
const updated = await database.update('my_plugin_items', itemId, itemData);

// Invalidate cache
await cache.invalidate('my-plugin:items:\*');

return updated;
}

Security Best Practices
Input Validation Checklist
Every endpoint MUST validate:

✅ Parameter types (integers, strings, enums)
✅ String lengths (prevent buffer overflow)
✅ Required fields
✅ HTML escaping (prevent XSS)
✅ Email formats (if applicable)
✅ Date formats (if applicable)

Authorization Checklist
Every UPDATE/DELETE MUST:

✅ Verify resource exists
✅ Verify ownership (automatic via tenant isolation)
✅ Check role permissions (if role-based)
✅ Log the operation

Error Handling Checklist
Every method MUST:

✅ Use try-catch blocks
✅ Throw standardized AppError
✅ Log errors with context
✅ Never expose internal details to client
✅ Use appropriate HTTP status codes

Testing Backend
Unit Tests with Mock Adapters
const MockDatabaseAdapter = require('../../server/core/services/database/adapters/MockAdapter');

describe('My Plugin Model', () => {
beforeEach(() => {
ServiceManager.override('database', new MockDatabaseAdapter());
});

it('should create item', async () => {
const item = await model.createItem({
title: 'Test Item',
content: 'Test content'
});

    expect(item).toHaveProperty('id');
    expect(item.title).toBe('Test Item');

});

it('should throw error on invalid data', async () => {
await expect(model.createItem({ title: '' }))
.rejects.toThrow('Title is required');
});
});
Integration Tests
const request = require('supertest');
const app = require('../../server/app');

describe('My Plugin API', () => {
let csrfToken;

beforeEach(async () => {
const response = await request(app).get('/api/csrf-token');
csrfToken = response.body.csrfToken;
});

it('should create item with validation', async () => {
const response = await request(app)
.post('/api/my-plugin')
.set('X-CSRF-Token', csrfToken)
.send({
title: 'Test Item',
content: 'Test content'
});

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');

});

it('should reject invalid input', async () => {
const response = await request(app)
.post('/api/my-plugin')
.set('X-CSRF-Token', csrfToken)
.send({
title: '', // Invalid - empty
content: 'Test'
});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');

});
});

Common Patterns
Cross-Plugin References
async getItemWithContact(itemId) {
const item = await model.getItemById(itemId);

if (item.contact_id) {
// Use contacts plugin service
const contactsModel = require('../contacts/model');
item.contact = await contactsModel.getContactById(item.contact_id);
}

return item;
}
Audit Logging Sensitive Operations
async deleteItem(itemId) {
const item = await this.getItemById(itemId);

// Audit log before deletion
logger.info('Item deletion requested', {
itemId,
title: item.title,
userId: req.session.user.id,
timestamp: new Date()
});

await database.delete('my_plugin_items', itemId);

logger.info('Item deleted', { itemId });
}
Rate Limiting Email Operations
const emailLimiter = rateLimit({
windowMs: 60 _ 60 _ 1000, // 1 hour
max: 50, // 50 emails per hour
message: 'Email rate limit exceeded'
});

router.post('/:id/send-email',
requirePlugin('my-plugin'),
emailLimiter,
controller.sendEmail
);

Migration from V1
Old Pattern (Direct DB)
const db = require('../../server/database');

async getItems(userId) {
return db.query('SELECT \* FROM items WHERE user_id = ?', [userId]);
}
New Pattern (Core Services)
const database = ServiceManager.get('database');

async getItems() {
// Tenant isolation automatic - no userId needed
return database.query('SELECT \* FROM items', []);
}
Benefits:

Tenant isolation automatic
Easier testing with mocks
Infrastructure can change without plugin changes
Standardized error handling
Audit logging built-in

Conclusion
Backend plugins now:

✅ Use core services for all infrastructure
✅ Enforce security through middleware
✅ Validate all user input
✅ Handle errors consistently
✅ Log operations for audit trail
✅ Support easy testing with mocks

Result: Secure, testable, maintainable backend code that focuses on business logic.

See Also:

CORE_SERVICES_ARCHITECTURE.md - Service details
SECURITY_GUIDELINES.md - Security enforcement
REFACTORING_EXISTING_PLUGINS.md - Migration guide
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Naming conventions
