## Overview

This guide helps you migrate existing Homebase plugins to use service abstraction, security enforcement, and the @homebase/core SDK.

## Migration Benefits:

✅ Infrastructure becomes swappable via configuration
✅ Security enforced at multiple layers
✅ Testing simplified with mock adapters
✅ Tenant isolation automatic
✅ Audit logging built-in
✅ Deployment flexibility

## Breaking Changes Summary

### Backend Changes

| Old Pattern             | New Pattern                  | Why Changed              |
| ----------------------- | ---------------------------- | ------------------------ |
| Direct DB import        | `@homebase/core` SDK         | Swappable infrastructure |
| Manual tenant filtering | Automatic tenant isolation   | Security & simplicity    |
| `console.log()`         | `Logger.info/warn/error`     | Structured logging       |
| `throw new Error()`     | `throw new AppError()`       | Standardized errors      |
| No validation           | `express-validator` required | Security                 |
| No CSRF                 | `csrfProtection` required    | Security                 |
| No rate limiting        | Rate limiters on endpoints   | Security                 |
| `fs.readFile/writeFile` | `storage.upload/download`    | Cloud-ready storage      |

### Frontend Changes

| Old Pattern         | New Pattern                 | Why Changed     |
| ------------------- | --------------------------- | --------------- |
| No CSRF token       | CSRF token in all mutations | Security        |
| Generic errors      | Standardized error display  | User experience |
| No loading states   | Required loading states     | User experience |
| Optional validation | Required validation display | User experience |

## Migration Checklist

Migration completed. All plugins have been migrated to use service abstraction and security enforcement.

Reference documentation:

- CORE_SERVICES_ARCHITECTURE.md
- SECURITY_GUIDELINES.md
- REFACTORING_EXISTING_PLUGINS.md

Migration Strategy
All plugins have been migrated in the following order:

✅ Notes - Simple CRUD, no files, no complex relationships
✅ Contacts - Simple CRUD, photos need storage service
✅ Tasks - Relationships, notifications
✅ Estimates - Complex calculations, PDFs
✅ Files - Heavy storage usage, requires cloud migration

## Step-by-Step Migration Process

### Backend Model Migration

#### Add @homebase/core SDK Imports

**Before (Direct Infrastructure)**:

```javascript
// plugins/my-plugin/model.js
const db = require('../../server/database');

class MyPluginModel {
  async getItemsByUser(userId) {
    return db.query('SELECT * FROM items WHERE user_id = ?', [userId]);
  }
}
```

**After (Service Abstraction)**:

```javascript
// plugins/my-plugin/model.js
const { Logger, Database } = require('@homebase/core');
```

const ServiceManager = require('../../server/core/ServiceManager');
const database = ServiceManager.get('database');
const logger = ServiceManager.get('logger');
const { AppError } = require('../../server/core/errors');

class MyPluginModel {
async getItemsByUser() {
// Tenant isolation automatic - no userId parameter needed
try {
return await database.query('SELECT \* FROM items ORDER BY created_at DESC', []);
} catch (error) {
logger.error('Failed to fetch items', error);
throw new AppError('Failed to fetch items', 500, 'FETCH_FAILED');
}
}
}
Changes:

✅ Import ServiceManager instead of direct db
✅ Get services via ServiceManager.get()
✅ Remove manual userId filtering (automatic)
✅ Add try-catch with logger
✅ Throw AppError instead of Error

Step 1.2: Update All CRUD Operations
Pattern for each method:
// CREATE
async createItem(itemData) {
try {
// Validation
this.validateItem(itemData);

    // Insert (tenant isolation automatic)
    const result = await database.insert('items', {
      title: itemData.title,
      content: itemData.content,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Audit log
    logger.info('Item created', { itemId: result.id });

    return this.getItemById(result.id);

} catch (error) {
logger.error('Create failed', error, { itemData });
throw new AppError('Failed to create item', 500, 'CREATE_FAILED');
}
}

// READ
async getItemById(itemId) {
const results = await database.query(
'SELECT \* FROM items WHERE id = ?',
[itemId]
);

if (results.length === 0) {
throw new AppError('Item not found', 404, 'NOT_FOUND');
}

return results[0];
}

// UPDATE
async updateItem(itemId, itemData) {
try {
// Verify exists (ownership check automatic via tenant isolation)
await this.getItemById(itemId);

    // Validation
    this.validateItem(itemData);

    // Update
    await database.update('items', itemId, {
      title: itemData.title,
      content: itemData.content,
      updated_at: new Date()
    });

    logger.info('Item updated', { itemId });

    return this.getItemById(itemId);

} catch (error) {
if (error.code === 'NOT_FOUND') throw error;
logger.error('Update failed', error, { itemId });
throw new AppError('Failed to update item', 500, 'UPDATE_FAILED');
}
}

// DELETE
async deleteItem(itemId) {
try {
// Verify exists
await this.getItemById(itemId);

    // Delete
    await database.delete('items', itemId);

    logger.info('Item deleted', { itemId });

} catch (error) {
if (error.code === 'NOT_FOUND') throw error;
logger.error('Delete failed', error, { itemId });
throw new AppError('Failed to delete item', 500, 'DELETE_FAILED');
}
}

// VALIDATION
validateItem(itemData) {
if (!itemData.title?.trim()) {
throw new AppError('Title is required', 400, 'VALIDATION_ERROR');
}

if (itemData.title.length > 255) {
throw new AppError('Title too long (max 255)', 400, 'VALIDATION_ERROR');
}
}

Step 1.3: Migrate File Operations (If Applicable)
Before (V1) - Local filesystem:
const fs = require('fs').promises;
const path = require('path');

async uploadPhoto(userId, contactId, file) {
const uploadDir = path.join(\_\_dirname, '../../uploads/contacts');
await fs.mkdir(uploadDir, { recursive: true });

const filename = `${contactId}-${Date.now()}.jpg`;
const filepath = path.join(uploadDir, filename);

await fs.writeFile(filepath, file.buffer);

return `/uploads/contacts/${filename}`;
}
After (V2) - Cloud storage:
const storage = ServiceManager.get('storage');

async uploadPhoto(contactId, file) {
try {
const fileURL = await storage.upload(
file.buffer,
`contacts/${contactId}/${file.originalname}`,
{
allowedTypes: ['image/jpeg', 'image/png'],
maxSize: 5 _ 1024 _ 1024, // 5MB
public: false
}
);

    logger.info('Photo uploaded', { contactId, fileURL });

    return fileURL;

} catch (error) {
logger.error('Upload failed', error, { contactId });
throw new AppError('Failed to upload photo', 500, 'UPLOAD_FAILED');
}
}
Benefits:

✅ Works with any storage provider (local, S3, R2, Scaleway)
✅ Automatic file validation
✅ Secure signed URLs
✅ No filesystem management

Phase 2: Backend Controller Migration
Step 2.1: Update Error Handling
Before (V1):
async getItems(req, res) {
try {
const userId = req.session.user.id;
const items = await model.getItemsByUser(userId);
res.json(items);
} catch (error) {
console.error('Error:', error);
res.status(500).json({ error: 'Failed to fetch items' });
}
}
After (V2):
async getItems(req, res, next) {
try {
const items = await model.getItemsByUser();
res.json(items);
} catch (error) {
next(error); // Pass to error handling middleware
}
}
Changes:

✅ Add next parameter
✅ Remove manual userId passing (automatic)
✅ Remove manual error responses (middleware handles)
✅ Use next(error) for centralized handling

Step 2.2: Update All Controller Methods
Pattern for each method:
class MyPluginController {
async getItems(req, res, next) {
try {
const items = await model.getItemsByUser();
res.json(items);
} catch (error) {
next(error);
}
}

async getItem(req, res, next) {
try {
const { id } = req.params;
const item = await model.getItemById(id);
res.json(item);
} catch (error) {
next(error);
}
}

async createItem(req, res, next) {
try {
const itemData = req.body;

      // Additional business logic validation
      if (itemData.someField && !isValid(itemData.someField)) {
        throw new AppError('Invalid field value', 400, 'VALIDATION_ERROR');
      }

      const item = await model.createItem(itemData);
      res.status(201).json(item);

    } catch (error) {
      next(error);
    }

}

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

Phase 3: Backend Routes Migration
Step 3.1: Add Security Middleware
Before (V1):
const express = require('express');

function createMyPluginRoutes(controller, requirePlugin) {
const router = express.Router();

router.get('/', requirePlugin('my-plugin'), (req, res) =>
controller.getItems(req, res));

router.post('/', requirePlugin('my-plugin'), (req, res) =>
controller.createItem(req, res));

router.put('/:id', requirePlugin('my-plugin'), (req, res) =>
controller.updateItem(req, res));

router.delete('/:id', requirePlugin('my-plugin'), (req, res) =>
controller.deleteItem(req, res));

return router;
}
After (V2):
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

// Rate limiter
const createLimiter = rateLimit({
windowMs: 60 \* 1000,
max: 10,
message: 'Too many requests'
});

function createMyPluginRoutes(controller, requirePlugin, csrfProtection) {
const router = express.Router();

// GET routes - no CSRF needed
router.get('/',
requirePlugin('my-plugin'),
(req, res, next) => controller.getItems(req, res, next)
);

router.get('/:id',
requirePlugin('my-plugin'),
[
param('id').isInt().withMessage('Invalid ID')
],
validateRequest,
(req, res, next) => controller.getItem(req, res, next)
);

// POST - with CSRF, validation, rate limiting
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
.isLength({ max: 5000 }).withMessage('Content too long')
],
validateRequest,
(req, res, next) => controller.createItem(req, res, next)
);

// PUT - with CSRF, validation
router.put('/:id',
requirePlugin('my-plugin'),
csrfProtection,
[
param('id').isInt().withMessage('Invalid ID'),
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

// DELETE - with CSRF
router.delete('/:id',
requirePlugin('my-plugin'),
csrfProtection,
[
param('id').isInt().withMessage('Invalid ID')
],
validateRequest,
(req, res, next) => controller.deleteItem(req, res, next)
);

return router;
}

module.exports = createMyPluginRoutes;
Changes:

✅ Add csrfProtection to mutations (POST/PUT/DELETE)
✅ Add input validation with express-validator
✅ Add rate limiting on create operations
✅ Add validateRequest middleware
✅ Pass next to all controller calls

Phase 4: Frontend API Migration
Step 4.1: Add CSRF Token Handling
Before (V1):
// client/src/plugins/my-plugin/api/myPluginApi.ts
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
      throw new Error('Request failed');
    }

    return response.json();

}

async createItem(itemData: any) {
return this.request('', {
method: 'POST',
body: JSON.stringify(itemData),
});
}
}
After (V2):
// client/src/plugins/my-plugin/api/myPluginApi.ts
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
Changes:

✅ Add getCsrfToken() method
✅ Cache CSRF token for reuse
✅ Automatically include CSRF token in mutations
✅ Better error handling

Phase 5: Frontend Context Migration
Step 5.1: Update Error Handling
Before (V1):
const saveMyPlugin = async (itemData: any): Promise<boolean> => {
try {
if (currentMyPluginItem) {
const saved = await myPluginApi.updateItem(currentMyPluginItem.id, itemData);
// Update state...
} else {
const saved = await myPluginApi.createItem(itemData);
// Update state...
}
return true;
} catch (error) {
console.error('Save failed:', error);
return false;
}
};
After (V2):
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
      setPanelMode('view'); // Transition to view after save
    } else {
      savedItem = await myPluginApi.createItem(itemData);
      setMyPluginItems(prev => [...prev, {
        ...savedItem,
        createdAt: new Date(savedItem.createdAt),
        updatedAt: new Date(savedItem.updatedAt),
      }]);
      closeMyPluginPanel(); // Close after create
    }

    setValidationErrors([]);
    return true;

} catch (error) {
console.error('Failed to save item:', error);
setValidationErrors([{
field: 'general',
message: 'Failed to save item. Please try again.'
}]);
return false;
}
};
Changes:

✅ Validate before save
✅ User-friendly error messages
✅ Proper state transitions (edit → view)
✅ Clear validation on success

Phase 6: Frontend Components Migration
Step 6.1: Update Form Component
Add validation display:
{hasBlockingErrors && (

  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <div className="flex items-center">
      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
        <ul className="mt-2 text-sm text-red-700">
          {blockingErrors.map((error, index) => (
            <li key={index}>• {error.message}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)}
Add loading states:
 const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
if (isSaving) return; // Prevent double submission

setIsSaving(true);
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

Phase 7: Testing Migration
Step 7.1: Update Backend Tests
Before (V1):
const db = require('../../server/database');

describe('My Plugin Model', () => {
beforeEach(async () => {
await db.query('DELETE FROM items');
});

it('should create item', async () => {
const item = await model.createItem(1, { title: 'Test' });
expect(item).toHaveProperty('id');
});
});
After (V2):
const ServiceManager = require('../../server/core/ServiceManager');
const MockDatabaseAdapter = require('../../server/core/services/database/adapters/MockAdapter');
const MockLoggerAdapter = require('../../server/core/services/logger/adapters/MockAdapter');

describe('My Plugin Model', () => {
beforeEach(() => {
ServiceManager.override('database', new MockDatabaseAdapter());
ServiceManager.override('logger', new MockLoggerAdapter());
});

afterEach(() => {
ServiceManager.reset();
});

it('should create item', async () => {
const item = await model.createItem({ title: 'Test', content: 'Content' });
expect(item).toHaveProperty('id');
expect(item.title).toBe('Test');
});

it('should throw error on invalid data', async () => {
await expect(model.createItem({ title: '' }))
.rejects.toThrow('Title is required');
});
});
Changes:

✅ Use mock adapters instead of real database
✅ No cleanup needed (mocks reset automatically)
✅ Test error handling
✅ Faster tests (no database I/O)

Step 7.2: Add Security Tests
New tests for V2:
const request = require('supertest');
const app = require('../../server/app');

describe('My Plugin Security', () => {
describe('Authentication', () => {
it('should require authentication', async () => {
const response = await request(app).get('/api/my-plugin');
expect(response.status).toBe(401);
});
});

describe('CSRF Protection', () => {
it('should reject requests without CSRF token', async () => {
const response = await request(app)
.post('/api/my-plugin')
.send({ title: 'Test' });
expect(response.status).toBe(403);
});

    it('should accept requests with valid CSRF token', async () => {
      const { csrfToken } = await request(app)
        .get('/api/csrf-token')
        .then(r => r.body);

      const response = await request(app)
        .post('/api/my-plugin')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Test', content: 'Content' });

      expect(response.status).toBe(201);
    });

});

describe('Input Validation', () => {
it('should reject empty title', async () => {
const { csrfToken } = await request(app)
.get('/api/csrf-token')
.then(r => r.body);

      const response = await request(app)
        .post('/api/my-plugin')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: '', content: 'Content' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should reject title too long', async () => {
      const { csrfToken } = await request(app)
        .get('/api/csrf-token')
        .then(r => r.body);

      const longTitle = 'a'.repeat(256);
      const response = await request(app)
        .post('/api/my-plugin')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: longTitle, content: 'Content' });

      expect(response.status).toBe(400);
    });

});

describe('Rate Limiting', () => {
it('should rate limit create requests', async () => {
const { csrfToken } = await request(app)
.get('/api/csrf-token')
.then(r => r.body);

      // Make 11 requests (limit is 10)
      for (let i = 0; i < 11; i++) {
        const response = await request(app)
          .post('/api/my-plugin')
          .set('X-CSRF-Token', csrfToken)
          .send({ title: `Test ${i}`, content: 'Content' });

        if (i < 10) {
          expect(response.status).toBe(201);
        } else {
          expect(response.status).toBe(429); // Too many requests
        }
      }
    });

});
});

Phase 8: Configuration & Deployment
Step 8.1: Update Environment Variables
Add to .env.local:

# Service Providers

DB_PROVIDER=postgres
STORAGE_PROVIDER=local
EMAIL_PROVIDER=smtp
QUEUE_PROVIDER=memory
CACHE_PROVIDER=memory
LOGGER_PROVIDER=console

# Storage Configuration (if using cloud)

# R2_ACCOUNT_ID=...

# R2_ACCESS_KEY=...

# R2_SECRET_KEY=...

# R2_BUCKET=...

# Email Configuration (if using cloud)

# RESEND_API_KEY=...

# Sentry (if using)

# SENTRY_DSN=...

Step 8.2: Update Plugin Config
Add security settings:
// plugins/my-plugin/plugin.config.js
module.exports = {
name: 'my-plugin',
routeBase: '/api/my-plugin',
requiredRole: 'user',
description: 'My plugin description',

// NEW: Security settings
security: {
rateLimits: {
global: { windowMs: 15 _ 60 _ 1000, max: 100 },
create: { windowMs: 60 _ 1000, max: 10 },
email: { windowMs: 60 _ 60 \* 1000, max: 50 }
},
auditLog: true,
csrfProtection: true
}
};

Plugin-Specific Migration Notes
Contacts Plugin
Critical changes:

✅ Migrate photo storage from local filesystem to StorageService
✅ Return signed URLs instead of file paths
✅ Add file validation (type, size)
✅ Update frontend to use photo URLs

Photo migration script:
// scripts/migrate-contact-photos.js
const fs = require('fs').promises;
const path = require('path');
const ServiceManager = require('../server/core/ServiceManager');

async function migratePhotos() {
const storage = ServiceManager.get('storage');
const database = ServiceManager.get('database');

const localDir = path.join(\_\_dirname, '../uploads/contacts');
const files = await fs.readdir(localDir);

for (const file of files) {
const contactId = file.split('-')[0];
const buffer = await fs.readFile(path.join(localDir, file));

    const url = await storage.upload(
      buffer,
      `contacts/${contactId}/${file}`,
      { public: false }
    );

    await database.update('contacts', contactId, { photoURL: url });
    console.log(`Migrated photo for contact ${contactId}`);

}
}

migratePhotos().catch(console.error);

Notes Plugin
Critical changes:

✅ Sanitize content HTML to prevent XSS
✅ Validate @mentions reference existing contacts
✅ Add audit logging for note updates

Content sanitization:
import DOMPurify from 'dompurify';

const saveNote = async (noteData: any) => {
// Sanitize HTML content
const sanitizedContent = DOMPurify.sanitize(noteData.content, {
ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
ALLOWED_ATTR: ['href']
});

const validated = {
...noteData,
content: sanitizedContent
};

return await myPluginApi.createItem(validated);
};

Tasks Plugin
Critical changes:

✅ Add email notifications via EmailService
✅ Validate task assignments
✅ Add due date validation

Email notifications:
const email = ServiceManager.get('email');

async notifyTaskAssignment(taskId) {
const task = await this.getTaskById(taskId);
const assignee = await contactModel.getContactById(task.assignedTo);

await email.send({
to: assignee.email,
subject: `New Task Assigned: ${task.title}`,
html: `       <h2>You've been assigned a new task</h2>
      <p><strong>${task.title}</strong></p>
      <p>${task.description}</p>
      <p>Due: ${task.dueDate.toLocaleDateString()}</p>
    `
});

logger.info('Task assignment notification sent', { taskId, assigneeId: assignee.id });
}

Estimates Plugin
Critical changes:

✅ Use PDFService for PDF generation
✅ Email via EmailService
✅ Validate line items
✅ Signed URLs for PDF access

PDF generation:
const pdf = ServiceManager.get('pdf');
const storage = ServiceManager.get('storage');

async generateEstimatePDF(estimateId) {
const estimate = await this.getEstimateById(estimateId);
const contact = await contactModel.getContactById(estimate.contactId);

// Generate PDF
const pdfBuffer = await pdf.generate({
template: 'estimate',
data: { estimate, contact }
});

// Upload to storage
const url = await storage.upload(
pdfBuffer,
`estimates/${estimateId}/estimate.pdf`,
{ public: false }
);

// Update estimate with PDF URL
await database.update('estimates', estimateId, { pdfURL: url });

logger.info('Estimate PDF generated', { estimateId });

return url;
}

Files Plugin
Critical changes:

✅ MUST migrate to cloud storage (Railway ephemeral filesystem)
✅ Add virus scanning (optional but recommended)
✅ Generate signed URLs for downloads
✅ Enforce file type whitelist

File upload with validation:
const storage = ServiceManager.get('storage');

async uploadFile(fileData, file) {
// Validate file type
const allowedTypes = [
'application/pdf',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'image/jpeg',
'image/png'
];

if (!allowedTypes.includes(file.mimetype)) {
throw new AppError('File type not allowed', 400, 'INVALID_FILE_TYPE');
}

// Upload to cloud storage
const fileURL = await storage.upload(
file.buffer,
`files/${Date.now()}-${file.originalname}`,
{
allowedTypes,
maxSize: 50 _ 1024 _ 1024, // 50MB
public: false
}
);

// Save file metadata
const result = await database.insert('files', {
filename: file.originalname,
fileURL,
filesize: file.size,
mimetype: file.mimetype,
...fileData
});

logger.info('File uploaded', { fileId: result.id, filename: file.originalname });

return result;
}

async downloadFile(fileId) {
const file = await this.getFileById(fileId);

// Generate signed URL (valid for 1 hour)
const signedURL = await storage.getSignedUrl(file.fileURL, 3600);

return signedURL;
}

Verification Checklist
After migration, verify each item:
Backend

All database calls use ServiceManager.get('database')
All logging uses ServiceManager.get('logger')
No direct infrastructure imports (db, fs, etc.)
All errors are AppError instances
All routes have security middleware
All mutations have CSRF protection
All inputs have validation
Rate limiting on appropriate endpoints
Tenant isolation verified (no manual userId filtering)
Tests use mock adapters
Security tests added

Frontend

CSRF token in all mutations
Loading states prevent double submissions
Validation errors displayed
User-friendly error messages
No sensitive data in console logs
Tests updated

Configuration

Environment variables updated
Service providers configured
Plugin config has security settings
Credentials secure (not in code)

Rollback Plan
If migration causes issues:
Immediate Rollback

# Switch back to V1 branch

git checkout main

# Restart services

npm run dev
Partial Rollback

# Keep V2 for working plugins, V1 for problematic ones

git checkout migration-v2 -- plugins/working-plugin
git checkout main -- plugins/problematic-plugin
Database Rollback

# If migrations cause issues

npm run migrate:rollback

# Or restore from backup

psql homebase_dev < backups/pre-migration.sql

Common Migration Issues
Issue: CSRF Token Errors
Symptom: All mutations fail with 403
Cause: Frontend not including CSRF token
Fix:
// Check API layer has getCsrfToken() and includes token
headers: {
'X-CSRF-Token': await this.getCsrfToken()
}

Issue: Tenant Isolation Broken
Symptom: Users see other users' data
Cause: Manual userId filtering still present
Fix: Remove all manual userId parameters and filters

Issue: File Uploads Failing
Symptom: Files not uploading or disappearing after restart
Cause: Still using local filesystem on Railway
Fix: Migrate to cloud storage (R2, S3, Scaleway)

Issue: Tests Failing
Symptom: Tests that worked in V1 now fail
Cause: Tests use real database instead of mocks
Fix:
beforeEach(() => {
ServiceManager.override('database', new MockDatabaseAdapter());
});

Migration Completed
All migration tasks have been completed:

✅ All plugins migrated to V2 architecture
✅ Documentation updated and marked as V2 compliant
✅ Production monitoring in place
✅ Performance testing completed
✅ Security audit completed
✅ Old code cleaned up
✅ Team documentation updated

Success Criteria - All Met
✅ All existing functionality works
✅ All tests passing (unit + integration + security)
✅ No console errors in production
✅ Performance same or better than V1
✅ Security tests passing
✅ No tenant isolation issues
✅ Infrastructure swappable via config
✅ Files working with cloud storage support

Conclusion
V2 migration provides:

Infrastructure flexibility - Swappable providers
Enhanced security - Multiple enforcement layers
Better testing - Mock adapters for speed
Simplified code - Automatic tenant isolation
Production ready - Cloud storage, logging, monitoring

Migration completed successfully. All plugins are now using V2 architecture with service abstraction and security enforcement.

See Also:

CORE_SERVICES_ARCHITECTURE.md - Service details
SECURITY_GUIDELINES.md - Security requirements
REFACTORING_EXISTING_PLUGINS.md - Plugin-specific guides
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - V2 conventions
