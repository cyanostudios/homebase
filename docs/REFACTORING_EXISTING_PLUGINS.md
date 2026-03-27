## Overview

This guide covers migrating existing plugins (contacts, notes, tasks, estimates) from direct infrastructure calls to @homebase/core SDK and security enhancements.

**Goal**: Modernize plugins to use abstraction layers and security best practices.

**3.1 approach**: Use `@homebase/core` – `Database.get(req)`, `Logger`, `Context.getUserId(req)`. Model methods receive `req` for tenant-isolated DB access. Storage, email, queue, PDF are app-specific services (injected or provided via app).

## Migration Strategy

### Analyze Current State

For each plugin, document:

- Direct database calls (identify all queries)
- File operations (if any)
- Email sending (if any)
- External API calls
- Missing validation
- Missing authorization checks
- Security vulnerabilities

### Refactor to @homebase/core SDK

Replace direct calls with SDK interfaces:

- Database → `Database.get(req)` from `@homebase/core`
- Logger → `Logger` from `@homebase/core`
- Context → `Context.getUserId(req)` from `@homebase/core`

### Add Security Layers

Implement missing security:

- Input validation (express-validator)
- Authorization checks (ownership verification)
- CSRF protection
- Rate limiting
- Audit logging

### Test Thoroughly

Verify:

All CRUD operations work
Tenant isolation maintained
Cross-plugin references preserved
Security enforced
Performance acceptable

Refactoring Checklist
Backend Plugin
Model Layer:

- Replace direct `require('../../server/database')` with `@homebase/core` SDK
- Use `Database.get(req)` for tenant-isolated queries
- Remove manual tenant scoping in SQL (core routes automatically)
- Use parameterized queries (no string interpolation)
  Add try-catch with proper error handling
  Remove connection pool management
  Use standardized error types

Controller Layer:

Add input validation middleware to all routes
Add authorization checks (verify ownership)
Use logging service instead of console.log
Standardize error responses (no internal details)
Add audit logging for sensitive operations

Routes Layer:

Add requireAuth() to ALL routes
Add CSRF protection to POST/PUT/DELETE
Add rate limiting to email/notification endpoints
Add role-based access control where needed

Frontend Plugin
Context Layer:

Update API calls to include CSRF token
Handle new error format from backend
Add loading states
Add error states

Components:

Sanitize user input before display
Validate forms client-side (in addition to server-side)
Show appropriate error messages
Handle network errors gracefully

Plugin-Specific Refactoring
Contacts Plugin
Refactoring Steps (Completed):
No authorization on delete
Files stored locally (ephemeral)

Refactoring Steps:

1. Model Layer:
   // BEFORE
   const db = require('../../server/database');

class ContactsModel {
async getForTenant() {
const query = 'SELECT \* FROM contacts';
return db.query(query);
}
}

// AFTER
const { Database, Logger } = require('@homebase/core');

class ContactsModel {
async getForTenant(req) {
try {
const db = Database.get(req);
// Tenant isolation via req – core sets tenant context
return await db.query('SELECT \* FROM contacts', []);
} catch (error) {
Logger.error('Failed to fetch contacts', error);
throw new AppError('Failed to fetch contacts', 500, 'DATABASE_ERROR');
}
}
}
} 2. Controller Layer:
// BEFORE
async deleteContact(req, res) {
const { id } = req.params;
await contactsModel.delete(id);
res.status(204).send();
}

// AFTER
const { Database, Logger, Context } = require('@homebase/core');

async deleteContact(req, res) {
const { id } = req.params;

const db = Database.get(req);
const rows = await db.query('SELECT \* FROM contacts WHERE id = $1', [id]);
const contact = rows[0];

if (!contact) {
throw new AppError('Contact not found', 404, 'NOT_FOUND');
}

await contactsModel.delete(req, id);

Logger.info('Contact deleted', { contactId: id });

res.status(204).send();
} 3. Routes Layer:
// BEFORE
router.delete('/:id', controller.deleteContact);

// AFTER
const { param } = require('express-validator');

router.delete('/:id',
requireAuth(),
csrfProtection,
param('id').isInt(),
validateRequest,
controller.deleteContact
); 4. Photo Upload:
// BEFORE
const fs = require('fs');

async uploadPhoto(req, res) {
const path = `./uploads/contacts/${req.params.id}.jpg`;
fs.writeFileSync(path, req.file.buffer);
// ❌ File lost on container restart
}

// AFTER – use @homebase/core for DB/Logger; storage is app-specific
const { Database, Logger, Context } = require('@homebase/core');
// const storage = getStorage(req); // app-specific (S3, R2, local Multer, etc.)

async uploadPhoto(req, res) {
const { id } = req.params;
const db = Database.get(req);

const rows = await db.query('SELECT \* FROM contacts WHERE id = $1', [id]);
if (!rows[0]) {
throw new AppError('Contact not found', 404);
}

// Upload to app-provided storage (cloud or local)
const photoURL = await storage.upload(req.file.buffer, `contacts/${id}/photo.jpg`, {
allowedTypes: ['image/jpeg', 'image/png'],
maxSize: 5 _ 1024 _ 1024,
public: true
});

await db.query('UPDATE contacts SET photo_url = $1 WHERE id = $2', [photoURL, id]);

res.json({ photoURL });
}

Notes Plugin
Refactoring Steps (Completed):

1. Content Sanitization:
   // BEFORE
   async createNote(noteData) {
   return database.insert('notes', noteData);
   // ❌ Stores raw HTML - XSS vulnerability
   }

// AFTER – sanitize first; use Database.get(req) for insert
const sanitizeHTML = require('sanitize-html');
const { Database } = require('@homebase/core');

async createNote(req, noteData) {
noteData.content = sanitizeHTML(noteData.content, {
allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
allowedAttributes: { 'a': ['href'] }
});
const db = Database.get(req);
const { rows } = await db.query('INSERT INTO notes (user_id, content) VALUES ($1, $2) RETURNING \*', [req.session?.user?.id, noteData.content]);
return rows[0];
} 2. @Mention Validation:
// BEFORE
async createNote(noteData) {
// ❌ No validation of mentioned contacts
return database.insert('notes', {
content: noteData.content,
mentions: noteData.mentions // Blindly trust client
});
}

// AFTER – model method receives req for Database.get(req)
const { Database, Logger } = require('@homebase/core');

async createNote(req, noteData) {
const db = Database.get(req);
if (noteData.mentions && noteData.mentions.length > 0) {
const contactIds = noteData.mentions.map(m => m.contactId);
const { rows } = await db.query('SELECT id FROM contacts WHERE id = ANY($1::int[]) AND user_id = $2', [contactIds, req.session?.user?.id]);

    if (rows.length !== contactIds.length) {
      throw new AppError('Invalid contact references', 400);
    }

}

const { rows } = await db.query('INSERT INTO notes (user_id, content, ...) VALUES ($1, $2, ...) RETURNING _', [req.session?.user?.id, noteData.content]);
return rows[0];
} 3. Audit Logging:
// AFTER – add to sensitive note operations; use Logger from @homebase/core
async createNote(req, noteData) {
const db = Database.get(req);
const { rows } = await db.query('INSERT INTO notes (user_id, content) VALUES ($1, $2) RETURNING _', [req.session?.user?.id, noteData.content]);
const note = rows[0];

Logger.info('Note created', {
noteId: note.id,
userId: req.session?.user?.id,
hasMentions: noteData.mentions?.length > 0,
contentLength: noteData.content.length
});

return note;
}

Tasks Plugin
Refactoring Steps (Completed):

1. Assignment Validation:
   // BEFORE
   async assignTask(taskId, contactId) {
   return database.update('tasks', taskId, { assigned_to: contactId });
   // ❌ No check if contact exists or belongs to user
   }

// AFTER – use @homebase/core for DB/Logger; email is app-specific
const { Database, Logger } = require('@homebase/core');
// const emailService = getEmailService(req); // app-specific

async assignTask(req, taskId, contactId) {
const db = Database.get(req);
const userId = req.session?.user?.id;

const { rows: taskRows } = await db.query('SELECT \* FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
if (!taskRows[0]) throw new AppError('Task not found', 404);

const { rows: contactRows } = await db.query('SELECT \* FROM contacts WHERE id = $1 AND user_id = $2', [contactId, userId]);
if (!contactRows[0]) throw new AppError('Contact not found', 404);

await db.query('UPDATE tasks SET assigned_to = $1 WHERE id = $2 AND user_id = $3', [contactId, taskId, userId]);

// Send notification (app-specific email service)
if (emailService) {
await emailService.send({ to: contactRows[0].email, subject: 'New Task Assigned', html: taskAssignmentTemplate(taskRows[0], contactRows[0]) });
}

return taskRows[0];
} 2. Date Validation:
// BEFORE
router.post('/', [
body('title').notEmpty(),
body('due_date').optional()
], controller.createTask);

// AFTER
router.post('/', [
body('title').trim().isLength({ min: 1, max: 255 }),
body('description').optional().trim().isLength({ max: 5000 }),
body('due_date').optional().isISO8601().toDate(),
body('priority').isIn(['low', 'medium', 'high']),
body('status').isIn(['not started', 'in progress', 'done', 'canceled']),
body('assigned_to').optional().isInt(),
validateRequest
], controller.createTask); 3. Bulk Operations:
// NEW – queue bulk task assignments; queue is app-specific
// const queue = getQueue(req); // app-specific (Bull, BullMQ, etc.)

async assignTasksToMultiple(req, taskId, contactIds) {
const jobId = await queue.add('bulk-task-assignment', {
taskId,
contactIds,
userId: req.session?.user?.id
});
return { jobId, status: 'queued' };
}

// Process in background (app-specific)
queue.process('bulk-task-assignment', async (job) => {
const { taskId, contactIds } = job.data;
const req = job.data.req; // pass req or reconstruct for Database.get(req)
for (const contactId of contactIds) {
await assignTask(req, taskId, contactId);
}
});

Estimates Plugin
Refactoring Steps (Completed):

1. Line Items Validation:
   // BEFORE
   async createEstimate(estimateData) {
   return database.insert('estimates', estimateData);
   // ❌ Line items stored as JSON without validation
   }

// AFTER – use Database.get(req); model method receives req
const { Database } = require('@homebase/core');

async createEstimate(req, estimateData) {
if (!estimateData.line_items || !Array.isArray(estimateData.line_items)) {
throw new AppError('Line items required', 400);
}

estimateData.line_items.forEach((item, index) => {
if (!item.description || !item.quantity || !item.price) {
throw new AppError(`Invalid line item at position ${index}`, 400);
}
if (item.quantity <= 0 || item.price < 0) {
throw new AppError(`Invalid values in line item ${index}`, 400);
}
});

estimateData.total = estimateData.line_items.reduce((sum, item) => sum + (item.quantity \* item.price), 0);

const db = Database.get(req);
const { rows } = await db.query('INSERT INTO estimates (user_id, line_items, total, ...) VALUES ($1, $2, $3, ...) RETURNING \*', [req.session?.user?.id, JSON.stringify(estimateData.line_items), estimateData.total]);
return rows[0];
} 2. PDF Generation:
// NEW – use @homebase/core for DB; pdf/storage are app-specific
const { Database, Logger } = require('@homebase/core');
// const pdfService = getPdfService(req);
// const storage = getStorage(req);

async generateEstimatePDF(req, estimateId) {
const db = Database.get(req);
const userId = req.session?.user?.id;

const { rows: estRows } = await db.query('SELECT \* FROM estimates WHERE id = $1 AND user_id = $2', [estimateId, userId]);
if (!estRows[0]) throw new AppError('Estimate not found', 404);

const { rows: contactRows } = await db.query('SELECT \* FROM contacts WHERE id = $1 AND user_id = $2', [estRows[0].contact_id, userId]);

const pdfBuffer = await pdfService.generate('estimate-template', { estimate: estRows[0], contact: contactRows[0], lineItems: estRows[0].line_items });
const pdfURL = await storage.upload(pdfBuffer, `estimates/${estimateId}/estimate.pdf`, { contentType: 'application/pdf', public: false });

await db.query('UPDATE estimates SET pdf_url = $1 WHERE id = $2 AND user_id = $3', [pdfURL, estimateId, userId]);
return pdfURL;
} 3. Email Estimate:
// NEW – use @homebase/core for DB/Logger; email/storage are app-specific
const { Database, Logger } = require('@homebase/core');
// const emailService = getEmailService(req);
// const storage = getStorage(req);

async sendEstimate(req, estimateId) {
const db = Database.get(req);
const userId = req.session?.user?.id;

const { rows: estRows } = await db.query('SELECT \* FROM estimates WHERE id = $1 AND user_id = $2', [estimateId, userId]);
if (!estRows[0]) throw new AppError('Estimate not found', 404);

const { rows: contactRows } = await db.query('SELECT \* FROM contacts WHERE id = $1 AND user_id = $2', [estRows[0].contact_id, userId]);

if (!estRows[0].pdf_url) await generateEstimatePDF(req, estimateId);
const pdfDownloadURL = storage.getSignedURL(`estimates/${estimateId}/estimate.pdf`, 3600);

await emailService.send({ to: contactRows[0].email, subject: `Estimate #${estRows[0].id}`, html: estimateEmailTemplate(estRows[0], contactRows[0], pdfDownloadURL) });

Logger.info('Estimate sent', { estimateId, contactId: contactRows[0].id, email: contactRows[0].email });
}

Files Plugin Considerations
Refactoring Steps (Completed):

1. Storage Service Integration:
   // BEFORE
   const fs = require('fs');
   const path = require('path');

async uploadFile(fileData, buffer) {
const filePath = path.join('./uploads', fileData.filename);
fs.writeFileSync(filePath, buffer);

return database.insert('files', {
filename: fileData.filename,
path: filePath,
size: buffer.length
});
}

// AFTER – use @homebase/core for DB/Logger; storage is app-specific
const { Database, Logger, Context } = require('@homebase/core');
// const storage = getStorage(req); // app-specific (S3, R2, local Multer, etc.)

async uploadFile(req, fileData, buffer) {
const db = Database.get(req);
const url = await storage.upload(buffer, `files/${fileData.filename}`, {
allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
maxSize: 25 _ 1024 _ 1024 // 25MB
});

const { rows } = await db.query('INSERT INTO user_files (user_id, name, size, mime_type, url) VALUES ($1, $2, $3, $4, $5) RETURNING _', [Context.getUserId(req), fileData.filename, buffer.length, fileData.mimetype, url]);
return rows[0];
} 2. Download Handler:
// BEFORE
async downloadFile(fileId) {
const file = await database.query('SELECT _ FROM files WHERE id = ?', [fileId]);
return fs.readFileSync(file.path);
}

// AFTER – use Database.get(req) and app-provided storage
const { Database, Logger } = require('@homebase/core');

async downloadFile(req, fileId) {
const db = Database.get(req);
const { rows } = await db.query('SELECT \* FROM user_files WHERE id = $1 AND user_id = $2', [fileId, req.session?.user?.id]);
if (!rows[0]) throw new AppError('File not found', 404);
return storage.getSignedURL(rows[0].url, 3600);
} 3. Virus Scanning (Optional but Recommended):
// Add to storage adapter; use Logger from @homebase/core
const { Logger } = require('@homebase/core');

async upload(file, path, options) {
if (process.env.ENABLE_VIRUS_SCAN === 'true') {
const scanResult = await this.virusScanner.scan(file);
if (scanResult.infected) {
Logger.warn('Virus detected in upload', { filename: path, virus: scanResult.name });
throw new AppError('File contains malware', 400);
}
}
return this.provider.upload(file, path);
}

Testing Refactored Plugins
Unit Tests
With @homebase/core, test by providing mock req with mock db or by using test database:

describe('Contacts Model', () => {
let mockReq;

beforeEach(() => {
// Mock req with session and mock db for Database.get(req)
mockReq = {
session: { user: { id: 1 } },
// If using test DB, req is passed through normal middleware
};
});

it('should create contact', async () => {
const contact = await contactsModel.create(mockReq, { companyName: 'Test Company', email: 'test@example.com' });
expect(contact).toHaveProperty('id');
expect(contact.companyName).toBe('Test Company');
});

it('should enforce tenant isolation', async () => {
const contact1 = await contactsModel.create({ ...mockReq, session: { user: { id: 1 } } }, { companyName: 'User 1' });
const req2 = { ...mockReq, session: { user: { id: 2 } } };
const contacts = await contactsModel.getByUser(req2);
expect(contacts).not.toContainEqual(contact1);
});
});
Integration Tests
Test with real adapters in test environment:
describe('Contacts API', () => {
let csrfToken;

beforeEach(async () => {
// Get CSRF token
const response = await request(app).get('/api/csrf-token');
csrfToken = response.body.csrfToken;
});

it('should create contact with validation', async () => {
const response = await request(app)
.post('/api/contacts')
.set('X-CSRF-Token', csrfToken)
.send({
companyName: 'Test Company',
email: 'test@example.com'
});

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');

});

it('should reject invalid email', async () => {
const response = await request(app)
.post('/api/contacts')
.set('X-CSRF-Token', csrfToken)
.send({
companyName: 'Test',
email: 'invalid-email'
});

    expect(response.status).toBe(400);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: 'email' })
    );

});
});

Deployment Checklist
Before deploying refactored plugins:

All tests passing (unit + integration)
Security scanning passed (npm audit, eslint)
Manual testing completed

CRUD operations work
Cross-plugin references preserved
Tenant isolation verified
File uploads work (cloud storage)
Email sending works

Performance testing

Response times acceptable
No N+1 query issues
Caching working

Configuration verified

Environment variables set
Service providers configured
Secrets stored securely

Monitoring setup

Error tracking (Sentry)
Log aggregation (Logtail)
Performance monitoring

Backup tested

Database backups scheduled
File storage backups configured
Restore procedure documented

Documentation updated

API changes documented
Breaking changes noted
Migration guide written

Rollback Plan
If issues found in production:

Immediate: Revert to previous deployment
Investigate: Review logs, identify root cause
Fix: Apply fix in development
Test: Thorough testing of fix
Deploy: Gradual rollout (canary deployment if possible)

Maintain compatibility:

Keep old API endpoints during transition
Support both old and new data formats
Gradual migration of data

Conclusion
Refactoring to core services:

Improves security through centralized enforcement
Increases flexibility via adapter pattern
Simplifies plugins by removing infrastructure code
Enables testing with mock adapters
Future-proofs for deployment changes

Refactor incrementally:

One plugin at a time
One layer at a time (model → controller → routes)
Test thoroughly at each step
Deploy gradually

Result: Modern, secure, flexible plugin architecture.

See Also:

CORE_SERVICES_ARCHITECTURE.md - Service abstraction details
SECURITY_GUIDELINES.md - Security requirements
PLUGIN_DEVELOPMENT_STANDARDS.md - Coding standards
