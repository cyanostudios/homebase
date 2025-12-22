Overview
This guide covers migrating existing plugins (contacts, notes, tasks, estimates) from direct infrastructure calls to core services architecture with security enhancements.
Goal: Modernize plugins to use abstraction layers and security best practices.

Migration Strategy
Phase 1: Analyze Current State
For each plugin, document:

Direct database calls (identify all queries)
File operations (if any)
Email sending (if any)
External API calls
Missing validation
Missing authorization checks
Security vulnerabilities

Phase 2: Refactor to Core Services
Replace direct calls with service adapters:

Database → DatabaseService
Files → StorageService
Emails → EmailService
Logs → LoggingService

Phase 3: Add Security Layers
Implement missing security:

Input validation (express-validator)
Authorization checks (ownership verification)
CSRF protection
Rate limiting
Audit logging

Phase 4: Test Thoroughly
Verify:

All CRUD operations work
Tenant isolation maintained
Cross-plugin references preserved
Security enforced
Performance acceptable


Refactoring Checklist
Backend Plugin
Model Layer:

 Replace direct require('../../server/database') with ServiceManager.get('database')
 Remove manual tenant filtering (core handles it)
 Use parameterized queries (no string interpolation)
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
Current Issues:

Direct database access
Missing email validation
No authorization on delete
Files stored locally (ephemeral)

Refactoring Steps:
1. Model Layer:
// BEFORE
const db = require('../../server/database');

class ContactsModel {
  async getByUser(userId) {
    const query = 'SELECT * FROM contacts WHERE user_id = ?';
    return db.query(query, [userId]);
  }
}

// AFTER
const ServiceManager = require('../../server/core/ServiceManager');
const database = ServiceManager.get('database');
const logger = ServiceManager.get('logger');

class ContactsModel {
  async getByUser(userId) {
    try {
      // Tenant isolation automatic - no need to pass userId
      return await database.query('SELECT * FROM contacts', []);
    } catch (error) {
      logger.error('Failed to fetch contacts', error, { userId });
      throw new AppError('Failed to fetch contacts', 500, 'DATABASE_ERROR');
    }
  }
}
2. Controller Layer:
// BEFORE
async deleteContact(req, res) {
  const { id } = req.params;
  await contactsModel.delete(id);
  res.status(204).send();
}

// AFTER
async deleteContact(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;
  
  // Verify ownership
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [id]
  );
  
  if (!contact) {
    throw new AppError('Contact not found', 404, 'NOT_FOUND');
  }
  
  // Delete
  await contactsModel.delete(id);
  
  // Audit log
  logger.info('Contact deleted', { contactId: id, userId });
  
  res.status(204).send();
}
3. Routes Layer:
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
);
4. Photo Upload:
// BEFORE
const fs = require('fs');

async uploadPhoto(req, res) {
  const path = `./uploads/contacts/${req.params.id}.jpg`;
  fs.writeFileSync(path, req.file.buffer);
  // ❌ File lost on container restart
}

// AFTER
const storage = ServiceManager.get('storage');

async uploadPhoto(req, res) {
  const { id } = req.params;
  
  // Verify ownership
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [id]
  );
  
  if (!contact) {
    throw new AppError('Contact not found', 404);
  }
  
  // Upload to cloud storage
  const photoURL = await storage.upload(
    req.file.buffer,
    `contacts/${id}/photo.jpg`,
    {
      allowedTypes: ['image/jpeg', 'image/png'],
      maxSize: 5 * 1024 * 1024,
      public: true
    }
  );
  
  // Update contact with photo URL
  await database.update('contacts', id, { photoURL });
  
  res.json({ photoURL });
}

Notes Plugin
Current Issues:

Direct database access
Missing XSS protection on notes content
@mentions stored but not validated
No audit log for sensitive notes

Refactoring Steps:
1. Content Sanitization:
// BEFORE
async createNote(noteData) {
  return database.insert('notes', noteData);
  // ❌ Stores raw HTML - XSS vulnerability
}

// AFTER
const sanitizeHTML = require('sanitize-html');

async createNote(noteData) {
  // Sanitize content
  noteData.content = sanitizeHTML(noteData.content, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    allowedAttributes: { 'a': ['href'] }
  });
  
  return database.insert('notes', noteData);
}
2. @Mention Validation:
// BEFORE
async createNote(noteData) {
  // ❌ No validation of mentioned contacts
  return database.insert('notes', {
    content: noteData.content,
    mentions: noteData.mentions // Blindly trust client
  });
}

// AFTER
async createNote(noteData) {
  // Validate mentions exist and belong to user
  if (noteData.mentions && noteData.mentions.length > 0) {
    const contactIds = noteData.mentions.map(m => m.contactId);
    
    const validContacts = await database.query(
      `SELECT id FROM contacts WHERE id IN (${contactIds.map(() => '?').join(',')})`,
      contactIds
    );
    
    if (validContacts.length !== contactIds.length) {
      throw new AppError('Invalid contact references', 400);
    }
  }
  
  return database.insert('notes', noteData);
}
3. Audit Logging:
// AFTER - Add to sensitive note operations
async createNote(noteData) {
  const note = await database.insert('notes', noteData);
  
  // Audit log
  logger.info('Note created', {
    noteId: note.id,
    userId: noteData.userId,
    hasMentions: noteData.mentions?.length > 0,
    contentLength: noteData.content.length
  });
  
  return note;
}

Tasks Plugin
Current Issues:

Direct database access
No validation of assigned_to field
Missing due date validation
No notification system

Refactoring Steps:
1. Assignment Validation:
// BEFORE
async assignTask(taskId, contactId) {
  return database.update('tasks', taskId, { assigned_to: contactId });
  // ❌ No check if contact exists or belongs to user
}

// AFTER
async assignTask(taskId, contactId) {
  // Verify task ownership
  const task = await database.query(
    'SELECT * FROM tasks WHERE id = ?',
    [taskId]
  );
  
  if (!task) {
    throw new AppError('Task not found', 404);
  }
  
  // Verify contact exists and belongs to user
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [contactId]
  );
  
  if (!contact) {
    throw new AppError('Contact not found', 404);
  }
  
  // Update assignment
  await database.update('tasks', taskId, { assigned_to: contactId });
  
  // Send notification
  const email = ServiceManager.get('email');
  await email.send({
    to: contact.email,
    subject: 'New Task Assigned',
    html: taskAssignmentTemplate(task, contact)
  });
  
  return task;
}
2. Date Validation:
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
], controller.createTask);
3. Bulk Operations:
// NEW - Queue bulk task assignments
const queue = ServiceManager.get('queue');

async assignTasksToMultiple(taskId, contactIds) {
  // Queue background job
  const jobId = await queue.add('bulk-task-assignment', {
    taskId,
    contactIds,
    userId: req.session.user.id
  });
  
  return { jobId, status: 'queued' };
}

// Process in background
queue.process('bulk-task-assignment', async (job) => {
  const { taskId, contactIds } = job.data;
  
  for (const contactId of contactIds) {
    await assignTask(taskId, contactId);
  }
});

Estimates Plugin
Current Issues:

Direct database access
No PDF generation
Missing line item validation
No email sending capability

Refactoring Steps:
1. Line Items Validation:
// BEFORE
async createEstimate(estimateData) {
  return database.insert('estimates', estimateData);
  // ❌ Line items stored as JSON without validation
}

// AFTER
async createEstimate(estimateData) {
  // Validate line items
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
  
  // Calculate total
  estimateData.total = estimateData.line_items.reduce(
    (sum, item) => sum + (item.quantity * item.price),
    0
  );
  
  return database.insert('estimates', estimateData);
}
2. PDF Generation:
// NEW - Generate PDF estimate
const pdfService = ServiceManager.get('pdf');
const storage = ServiceManager.get('storage');

async generateEstimatePDF(estimateId) {
  const estimate = await database.query(
    'SELECT * FROM estimates WHERE id = ?',
    [estimateId]
  );
  
  if (!estimate) {
    throw new AppError('Estimate not found', 404);
  }
  
  // Get contact details
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [estimate.contact_id]
  );
  
  // Generate PDF
  const pdfBuffer = await pdfService.generate('estimate-template', {
    estimate,
    contact,
    lineItems: estimate.line_items
  });
  
  // Upload to storage
  const pdfURL = await storage.upload(
    pdfBuffer,
    `estimates/${estimateId}/estimate.pdf`,
    {
      contentType: 'application/pdf',
      public: false
    }
  );
  
  // Update estimate with PDF URL
  await database.update('estimates', estimateId, { pdf_url: pdfURL });
  
  return pdfURL;
}
3. Email Estimate:
// NEW - Email estimate to contact
const email = ServiceManager.get('email');

async sendEstimate(estimateId) {
  const estimate = await database.query(
    'SELECT * FROM estimates WHERE id = ?',
    [estimateId]
  );
  
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [estimate.contact_id]
  );
  
  // Generate PDF if not exists
  if (!estimate.pdf_url) {
    await generateEstimatePDF(estimateId);
  }
  
  // Get signed URL (temporary access)
  const pdfDownloadURL = storage.getSignedURL(
    `estimates/${estimateId}/estimate.pdf`,
    3600 // 1 hour
  );
  
  // Send email
  await email.send({
    to: contact.email,
    subject: `Estimate #${estimate.id}`,
    html: estimateEmailTemplate(estimate, contact, pdfDownloadURL)
  });
  
  // Audit log
  logger.info('Estimate sent', {
    estimateId,
    contactId: contact.id,
    email: contact.email
  });
}

Files Plugin Considerations
Current State:
If files plugin stores to local filesystem, it MUST be refactored.
Critical Issue:
Railway (and most cloud platforms) use ephemeral filesystems - files are lost on restart.
Required Changes:
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

// AFTER
const storage = ServiceManager.get('storage');

async uploadFile(fileData, buffer) {
  // Upload to cloud storage (S3, R2, Scaleway, etc.)
  const url = await storage.upload(
    buffer,
    `files/${fileData.filename}`,
    {
      allowedTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ],
      maxSize: 25 * 1024 * 1024 // 25MB
    }
  );
  
  return database.insert('files', {
    filename: fileData.filename,
    url: url,
    size: buffer.length,
    mimetype: fileData.mimetype
  });
}
2. Download Handler:
// BEFORE
async downloadFile(fileId) {
  const file = await database.query('SELECT * FROM files WHERE id = ?', [fileId]);
  return fs.readFileSync(file.path);
}

// AFTER
async downloadFile(fileId) {
  const file = await database.query('SELECT * FROM files WHERE id = ?', [fileId]);
  
  // Return signed URL (temporary download link)
  return storage.getSignedURL(file.url, 3600);
}
3. Virus Scanning (Optional but Recommended):
// Add to storage adapter
async upload(file, path, options) {
  // ... validation ...
  
  if (process.env.ENABLE_VIRUS_SCAN === 'true') {
    const scanResult = await this.virusScanner.scan(file);
    
    if (scanResult.infected) {
      logger.warn('Virus detected in upload', {
        filename: path,
        virus: scanResult.name
      });
      throw new AppError('File contains malware', 400);
    }
  }
  
  return this.provider.upload(file, path);
}

Testing Refactored Plugins
Unit Tests
Test with mock adapters:
const MockDatabaseAdapter = require('../../server/core/services/database/adapters/MockAdapter');

describe('Contacts Model', () => {
  beforeEach(() => {
    // Use mock database
    ServiceManager.override('database', new MockDatabaseAdapter());
  });
  
  it('should create contact', async () => {
    const contact = await contactsModel.create({
      companyName: 'Test Company',
      email: 'test@example.com'
    });
    
    expect(contact).toHaveProperty('id');
    expect(contact.companyName).toBe('Test Company');
  });
  
  it('should enforce tenant isolation', async () => {
    // Create contact as user 1
    const contact1 = await contactsModel.create({ companyName: 'User 1' });
    
    // Switch to user 2
    MockDatabaseAdapter.setCurrentUser(2);
    
    // User 2 should not see user 1's contact
    const contacts = await contactsModel.getByUser(2);
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
