Overview
Security in Homebase is enforced through layered defense. Each layer has specific responsibilities, and plugins inherit security by default when using core services correctly.
Security Principle: Secure by default, insecure by exception.

Production Launch Baseline (MUST before release)
This section is the go-live baseline. If any MUST item is not complete, launch should be blocked.

1) CSRF protection must be active end-to-end
- CSRF middleware must be enabled in runtime (no debug no-op fallback).
- All state-changing routes (POST/PUT/PATCH/DELETE) must enforce CSRF.
- Frontend must fetch and send CSRF token for all mutations.
- Acceptance: external cross-site form POST cannot mutate data.

2) Session and secret hardening
- SESSION_SECRET must be provided by environment in production (no insecure default fallback).
- Cookies must be httpOnly + secure + sameSite, and HTTPS-only in production.
- Rotate all production secrets before launch (session, API keys, SMTP, storage, webhook).
- Acceptance: app refuses startup or health turns failed when required secrets are missing.

3) Encryption in transit and at rest
- HTTPS/TLS required for all client traffic.
- TLS required for database and external providers.
- At-rest encryption required for database, object storage, and backups.
- For highly sensitive credentials, use application-level encryption (envelope/KMS pattern preferred).

4) Sensitive data handling and log redaction
- Never log credentials, tokens, API keys, session identifiers, or raw secrets.
- SQL logging must redact or disable parameter values in production.
- Error responses must not expose stack traces or internal schema details in production.
- Acceptance: security log review shows masked values only.

5) Admin and privileged endpoint hardening
- Do not expose tenant/database connection strings or infrastructure secrets in API responses.
- Superuser/admin actions must be auditable with actor identity and timestamp.
- Add step-up controls for privileged actions (MFA strongly recommended for admin accounts).

6) File upload hardening
- Enforce allowlist, size limits, path sanitization, and traversal prevention.
- Validate by file signature (magic bytes), not MIME header only.
- Block executable and script-like payloads; optional AV scanning is recommended in production.
- Serve downloads with safe headers and strict access checks.

7) Rate limiting and abuse protection
- Global and endpoint-specific rate limiting must be active.
- Use a shared store (for example Redis) for multi-instance deployments.
- Protect login, webhook, upload, and email endpoints with stricter limits.
- Add alerting for brute force, abuse bursts, and repeated authorization failures.

8) Verification before go-live
- Run dependency and static scans (`npm audit`, SAST, lint, secret scan).
- Run manual abuse tests (CSRF, IDOR, upload, auth bypass, rate-limit bypass).
- Execute restore drill for backups and document incident runbook.

Current Security Gap Tracker (required for release sign-off)
Use this checklist to track "as-is" versus "target". Status values: Open / In Progress / Done / N-A.

- [ ] CSRF enabled in runtime and enforced on all state-changing routes
- [ ] No temporary security bypass comments remain in active routes
- [ ] Production secrets required (no insecure fallback defaults)
- [ ] Log redaction in place (no secret/PII/token leakage)
- [ ] No stack traces/internal details exposed to clients in production
- [ ] No admin endpoint returns connection strings or secrets
- [ ] Credentials at rest encrypted or protected by managed secret mechanism
- [ ] File upload validated by magic bytes + strict allowlist/limits
- [ ] Shared/distributed rate limiting configured for production topology
- [ ] Webhook endpoints protected by secret + strict rate limits (+ allowlist where possible)
- [ ] Backup + restore drill completed and documented
- [ ] Incident response playbook reviewed and tested

Security Layers
Layer 1: Network & Request (Middleware)
Responsibilities:

Authentication verification
CSRF protection
Rate limiting
Request validation
Security headers

Enforcement Point: Before request reaches plugin code
Implementation: Express middleware stack

Layer 2: Service Adapters (Core)
Responsibilities:

Input sanitization
SQL injection prevention
File validation
Audit logging
Tenant isolation

Enforcement Point: At infrastructure boundary
Implementation: Core service adapters

Layer 3: Business Logic (Plugins)
Responsibilities:

Authorization (ownership checks)
Business rule validation
Cross-plugin permission checks
Data transformation

Enforcement Point: Within plugin controllers
Implementation: Plugin-specific code

Layer 4: Database (Last Resort)
Responsibilities:

Row-level security
Constraint enforcement
Cascade deletes
Data integrity

Enforcement Point: At data layer
Implementation: PostgreSQL policies and constraints

Authentication
Session-Based Authentication
Current implementation uses:

Express-session with secure cookies
bcrypt password hashing
Session store (PostgreSQL or Redis)

Plugin Requirements:

ALL routes must use requireAuth() middleware
Session data accessed via req.session.user
Never store passwords in plaintext

Middleware Usage:
 router.get('/contacts', requireAuth(), controller.getContacts);
router.post('/contacts', requireAuth(), controller.createContact);
Future Authentication Extensions
Extensible via adapters:

OAuth2 (Google, Microsoft, BankID)
SAML (Enterprise SSO)
Magic links (passwordless)
JWT (API/mobile access)

Core provides interface, adapters implement strategy.

Authorization
Tenant Isolation (Automatic)
Core enforces tenant boundaries:
 // Plugin queries without tenant awareness
await database.query('SELECT * FROM contacts WHERE id = ?', [contactId]);

// Core automatically adds: AND user_id = current_user_id
Plugins MUST NOT:

Query across tenant boundaries
Access resources without ownership check
Bypass core database service

Ownership Verification (Plugin Responsibility)
For UPDATE and DELETE operations:
 async deleteContact(req, res) {
  const { id } = req.params;
  const userId = req.session.user.id;
  
  // ✅ REQUIRED: Verify ownership before deletion
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  
  if (!contact) {
    return res.status(404).json({ error: 'Contact not found' });
  }
  
  await database.delete('contacts', id);
  res.status(204).send();
}
NEVER:
 // ❌ WRONG: No ownership check
async deleteContact(req, res) {
  await database.delete('contacts', req.params.id);
  res.status(204).send();
}
Role-Based Access Control
User roles:

user - Standard access to own data
admin - Extended permissions within tenant
superuser - System-wide administration

Plugin-specific permissions:
 // Define in plugin config
permissions: {
  'view': ['user', 'admin', 'superuser'],
  'create': ['user', 'admin', 'superuser'],
  'edit': ['admin', 'superuser'],
  'delete': ['superuser']
}

// Middleware enforcement
router.delete('/contacts/:id', 
  requireAuth(),
  requireRole(['admin', 'superuser']),
  controller.deleteContact
);

Input Validation
Request Validation Middleware
ALL endpoints accepting user input MUST validate:
 const { body, param, query, validationResult } = require('express-validator');

router.post('/contacts', [
  requireAuth(),
  
  // Validation rules
  body('email').isEmail().normalizeEmail(),
  body('companyName').trim().isLength({ min: 1, max: 255 }).escape(),
  body('phone').optional().matches(/^\+?[0-9\s\-()]+$/),
  body('website').optional().isURL(),
  
  // Validation check
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
], controller.createContact);
Validation Rules
Required for ALL user input:

✅ Email format validation
✅ String length limits (prevent buffer overflow)
✅ HTML escape (prevent XSS)
✅ SQL parameterization (prevent injection)
✅ Path sanitization (prevent directory traversal)
✅ File type validation (prevent malicious uploads)

Common Patterns:
 // Email
body('email').isEmail().normalizeEmail()

// Text fields
body('name').trim().isLength({ min: 1, max: 255 }).escape()

// Optional fields
body('description').optional().trim().isLength({ max: 5000 })

// Numbers
body('amount').isFloat({ min: 0, max: 999999 })

// Dates
body('date').isISO8601().toDate()

// Enums
body('status').isIn(['pending', 'approved', 'rejected'])

// Arrays
body('tags').isArray({ max: 10 })
body('tags.*').trim().isLength({ min: 1, max: 50 })
Output Sanitization
Prevent XSS in rendered content:
 // Backend: Never trust database content
const sanitizeHTML = require('sanitize-html');

async getContact(req, res) {
  const contact = await database.query('SELECT * FROM contacts WHERE id = ?', [id]);
  
  // Sanitize before sending to client
  contact.notes = sanitizeHTML(contact.notes, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a'],
    allowedAttributes: { 'a': ['href'] }
  });
  
  res.json(contact);
}
Frontend: Escape in JSX (React does this automatically)
// ✅ Safe - React escapes by default
<div>{contact.notes}</div>

// ⚠️ Dangerous - only if you control the content
<div dangerouslySetInnerHTML={{ __html: sanitizedNotes }} />

SQL Injection Prevention
Parameterized Queries (Enforced by Core)
Core database service ONLY accepts parameterized queries:
 // ✅ CORRECT - Parameters separate from SQL
await database.query(
  'SELECT * FROM contacts WHERE email = ? AND user_id = ?',
  [email, userId]
);

// ❌ BLOCKED - String interpolation not allowed
await database.query(
  `SELECT * FROM contacts WHERE email = '${email}'`
);
Adapter enforcement:
 class DatabaseAdapter {
  async query(sql, params) {
    // Reject queries without parameters
    if (typeof sql !== 'string' || !Array.isArray(params)) {
      throw new Error('Invalid query format - use parameterized queries');
    }
    
    // Detect suspicious patterns
    if (this.detectSQLInjection(sql)) {
      await logger.error('Potential SQL injection attempt', { sql });
      throw new Error('Suspicious query detected');
    }
    
    return this.pool.query(sql, params);
  }
  
  detectSQLInjection(sql) {
    // Look for common injection patterns
    const patterns = [
      /;\s*DROP\s+TABLE/i,
      /;\s*DELETE\s+FROM/i,
      /UNION\s+SELECT/i,
      /--/,
      /\/\*/
    ];
    
    return patterns.some(pattern => pattern.test(sql));
  }
}

File Upload Security
Storage Service Validation
Core storage adapter enforces:
 class StorageAdapter {
  ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  MAX_SIZE = 10 * 1024 * 1024; // 10MB default
  
  async upload(file, path, options = {}) {
    // Type validation
    const allowedTypes = options.allowedTypes || this.ALLOWED_TYPES;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed`);
    }
    
    // Size validation
    const maxSize = options.maxSize || this.MAX_SIZE;
    if (file.size > maxSize) {
      throw new Error(`File size ${file.size} exceeds maximum ${maxSize}`);
    }
    
    // Filename sanitization
    const safePath = this.sanitizePath(path);
    
    // Path traversal prevention
    if (safePath.includes('..') || safePath.startsWith('/')) {
      throw new Error('Invalid file path');
    }
    
    // Virus scanning (optional, if enabled)
    if (process.env.ENABLE_VIRUS_SCAN === 'true') {
      await this.scanFile(file);
    }
    
    return this.provider.upload(file, safePath);
  }
  
  sanitizePath(path) {
    return path
      .replace(/\.\./g, '')
      .replace(/^\//, '')
      .replace(/[^a-zA-Z0-9\/_\-\.]/g, '_');
  }
}
Plugin File Upload Pattern
 router.post('/contacts/:id/photo', 
  requireAuth(),
  upload.single('photo'), // multer middleware
  async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    // Verify ownership
    const contact = await database.query(
      'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    // Upload with validation
    const photoURL = await storage.upload(req.file.buffer, `contacts/${id}/photo.jpg`, {
      allowedTypes: ['image/jpeg', 'image/png'],
      maxSize: 5 * 1024 * 1024, // 5MB
      public: true
    });
    
    // Update contact with photo URL
    await database.update('contacts', id, { photoURL });
    
    res.json({ photoURL });
  }
);
NEVER:

Accept executable file types (.exe, .sh, .bat, .php)
Store uploaded files with original filenames
Allow unlimited file sizes
Skip virus scanning in production


CSRF Protection
Cross-Site Request Forgery Prevention
Required for all state-changing operations:
 const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply to all POST/PUT/DELETE routes
router.post('/contacts', csrfProtection, controller.createContact);
router.put('/contacts/:id', csrfProtection, controller.updateContact);
router.delete('/contacts/:id', csrfProtection, controller.deleteContact);

// Provide CSRF token to frontend
router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
Frontend implementation:
// Fetch CSRF token on app load
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());

// Include in all mutations
await fetch('/api/contacts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(contactData)
});

Rate Limiting
Global Rate Limiting
Prevent abuse and DoS attacks:
 const rateLimit = require('express-rate-limit');

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', globalLimiter);
Endpoint-Specific Limits
Stricter limits for sensitive operations:
 // Login rate limiting (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  skipSuccessfulRequests: true
});

router.post('/auth/login', loginLimiter, authController.login);

// Email sending (prevent spam)
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50 // 50 emails per hour
});

router.post('/contacts/:id/send-email', 
  requireAuth(),
  emailLimiter,
  controller.sendEmail
);
Adapter-Level Rate Limiting
Core services can enforce additional limits:
 class EmailAdapter {
  constructor(config) {
    this.limiter = new Map(); // userId -> count
  }
  
  async send(to, subject, body, userId) {
    // Check user-specific limit
    const count = this.limiter.get(userId) || 0;
    
    if (count >= 100) { // 100 emails per day
      throw new Error('Daily email limit exceeded');
    }
    
    await this.provider.send(to, subject, body);
    
    this.limiter.set(userId, count + 1);
  }
}

Security Headers
Helmet.js Integration
Required security headers:
 const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Minimize unsafe-inline
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

Audit Logging
Automatic Audit Trail
Core services log all critical operations:
 class DatabaseAdapter {
  async query(sql, params, context) {
    const startTime = Date.now();
    
    try {
      const result = await this.pool.query(sql, params);
      
      // Log successful operation
      await auditLog.record({
        userId: context.userId,
        action: this.extractAction(sql),
        table: this.extractTable(sql),
        recordId: result.insertId || params[0],
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: true
      });
      
      return result;
    } catch (error) {
      // Log failed operation
      await auditLog.record({
        userId: context.userId,
        action: this.extractAction(sql),
        table: this.extractTable(sql),
        error: error.message,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: false
      });
      
      throw error;
    }
  }
}
Audit Log Schema
sqlCREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete'
  resource_type VARCHAR(100) NOT NULL, -- 'contact', 'note', 'task'
  resource_id VARCHAR(255),
  details JSON,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT true,
  
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_resource (resource_type, resource_id)
);
What to Log
ALWAYS log:

User authentication (login, logout, failed attempts)
Data creation, updates, deletions
Permission changes
File uploads/downloads
Bulk operations
Failed authorization attempts
Security events (detected injection attempts, rate limit hits)

NEVER log:

Passwords (even hashed)
Credit card numbers
Session tokens
API keys
Other credentials


Sensitive Data Handling
Personal Identifiable Information (PII)
GDPR Compliance Requirements:
 // Mark PII fields in database
CREATE TABLE contacts (
  id INT PRIMARY KEY,
  email VARCHAR(255) NOT NULL, -- PII
  phone VARCHAR(50), -- PII
  company_name VARCHAR(255), -- Not PII
  created_at TIMESTAMP,
  
  -- Encryption for extra sensitive data
  ssn VARCHAR(255) ENCRYPTED, -- Extra sensitive PII
  bank_account VARCHAR(255) ENCRYPTED
);
Data Access Logging:
 async getContact(req, res) {
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ?',
    [req.params.id]
  );
  
  // Log PII access
  await auditLog.record({
    userId: req.session.user.id,
    action: 'pii_access',
    resourceType: 'contact',
    resourceId: contact.id,
    fields: ['email', 'phone'], // Which PII fields accessed
    purpose: 'user_request',
    timestamp: new Date()
  });
  
  res.json(contact);
}
Data Encryption
At-rest encryption:

Database encryption (Neon provides this)
File storage encryption (S3/R2 server-side encryption)
Backup encryption

In-transit encryption:

HTTPS only (enforce via middleware)
TLS for database connections
Encrypted websockets (WSS)

Application-level encryption (for extra sensitive data):
 const crypto = require('crypto');

class EncryptionService {
  constructor(key) {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(key, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encrypted, iv, authTag) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

Error Handling
Secure Error Messages
NEVER expose internal details in errors:
 // ❌ WRONG - Exposes database structure
catch (error) {
  res.status(500).json({ 
    error: error.message // "Duplicate key violation on column 'email'"
  });
}

// ✅ CORRECT - Generic user-facing message
catch (error) {
  logger.error('Contact creation failed', error, { userId, contactData });
  
  if (error.code === 'DUPLICATE_KEY') {
    return res.status(400).json({ 
      error: 'A contact with this email already exists'
    });
  }
  
  res.status(500).json({ 
    error: 'Failed to create contact. Please try again.'
  });
}
Standardized Error Responses
Core provides error types:
 class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

// Usage in plugins
if (!contact) {
  throw new AppError('Contact not found', 404, 'CONTACT_NOT_FOUND');
}

if (!hasPermission) {
  throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
}
Error handling middleware:
 app.use((error, req, res, next) => {
  // Log error details (server-side only)
  logger.error('Request failed', error, {
    userId: req.session?.user?.id,
    path: req.path,
    method: req.method
  });
  
  // Send safe error to client
  res.status(error.statusCode || 500).json({
    error: error.isOperational ? error.message : 'Internal server error',
    code: error.code
  });
});

Security Checklist for Plugin Developers
Mandatory Security Requirements
Every plugin MUST:

 Use requireAuth() middleware on ALL routes
 Validate ALL user input with express-validator
 Use parameterized queries (never string interpolation)
 Verify resource ownership before UPDATE/DELETE
 Sanitize HTML output (prevent XSS)
 Use core services (never direct provider access)
 Include CSRF protection on state-changing routes
 Implement rate limiting on email/notification endpoints
 Log security events via logging service
 Handle errors securely (no internal details exposed)

Every plugin SHOULD:

 Implement field-level validation (not just type checking)
 Use enum validation for status/type fields
 Limit array sizes (prevent memory exhaustion)
 Implement pagination (prevent large result sets)
 Cache expensive queries
 Audit log sensitive operations
 Test with mock adapters
 Document security assumptions

Every plugin MUST NOT:

 Store passwords in plaintext
 Log sensitive data (passwords, tokens, PII)
 Trust client-side validation alone
 Bypass tenant isolation
 Use eval() or similar dynamic code execution
 Include user input in SQL queries
 Allow unlimited file uploads
 Expose stack traces to clients


Common Vulnerabilities & Prevention
SQL Injection
Vulnerability:
 // ❌ Vulnerable to SQL injection
const email = req.body.email; // "' OR '1'='1"
await database.query(`SELECT * FROM contacts WHERE email = '${email}'`);
// Results in: SELECT * FROM contacts WHERE email = '' OR '1'='1'
Prevention:
 // ✅ Parameterized query
await database.query('SELECT * FROM contacts WHERE email = ?', [email]);
Core enforcement: Database adapter rejects non-parameterized queries.

Cross-Site Scripting (XSS)
Vulnerability:
 // User submits: <script>alert('XSS')</script>
// Stored in database, rendered in browser → executes
Prevention:
 // Backend: Sanitize on save
const sanitizeHTML = require('sanitize-html');
data.notes = sanitizeHTML(data.notes);

// Frontend: React escapes by default
<div>{contact.notes}</div> // Safe

Cross-Site Request Forgery (CSRF)
Vulnerability:
html<!-- Attacker's site -->
<form action="https://homebase.example.com/api/contacts/123" method="POST">
  <input type="hidden" name="email" value="attacker@evil.com">
</form>
<script>document.forms[0].submit();</script>
Prevention:
 // Require CSRF token on all state-changing operations
router.post('/contacts', csrfProtection, controller.createContact);

Insecure Direct Object References
Vulnerability:
 // ❌ No ownership check
router.delete('/contacts/:id', async (req, res) => {
  await database.delete('contacts', req.params.id);
  // Attacker can delete any contact by guessing IDs
});
Prevention:
 // ✅ Verify ownership
router.delete('/contacts/:id', async (req, res) => {
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?',
    [req.params.id, req.session.user.id]
  );
  
  if (!contact) {
    return res.status(404).json({ error: 'Not found' });
  }
  
  await database.delete('contacts', req.params.id);
});

Path Traversal
Vulnerability:
 // ❌ User controls file path
const filename = req.params.filename; // "../../etc/passwd"
await storage.download(filename);
Prevention:
 // ✅ Sanitize path
const safePath = storage.sanitizePath(filename);
// Adapter removes "..", leading slashes, etc.
Core enforcement: Storage adapter sanitizes all paths.

Unrestricted File Upload
Vulnerability:
 // ❌ Accept any file type
await storage.upload(req.file, 'uploads/file');
// User uploads malicious.php → remote code execution
Prevention:
 // ✅ Restrict file types and sizes
await storage.upload(req.file, 'uploads/file', {
  allowedTypes: ['image/jpeg', 'image/png'],
  maxSize: 5 * 1024 * 1024
});
Core enforcement: Storage adapter validates file types and sizes.

Security Testing
Automated Security Scanning
npm audit:
npm audit
npm audit fix
Dependency scanning:
npx snyk test
SAST (Static Analysis):
npx eslint . --ext .js,.ts
Manual Security Testing
Test for:

 SQL injection (try common payloads)
 XSS (submit <script> tags in forms)
 CSRF (submit forms from external domain)
 Authorization bypass (access other users' resources)
 File upload exploits (upload .php, .exe files)
 Rate limit bypass (automated requests)
 Session fixation (reuse old session IDs)

Penetration Testing
Before production launch:

Hire security professional
Run automated scanners (OWASP ZAP, Burp Suite)
Test authentication flows
Verify tenant isolation
Check for information disclosure


Security Incident Response
Detection
Monitor for:

Multiple failed login attempts
Unusual API usage patterns
SQL injection attempt patterns in logs
Unauthorized access attempts
Rate limit violations
File upload anomalies

Response Procedure
When security incident detected:

Contain - Block attacker IP, disable compromised accounts
Investigate - Review audit logs, identify breach scope
Notify - Inform affected users (GDPR requirement)
Remediate - Fix vulnerability, restore from backup if needed
Document - Create incident report, update security procedures
Monitor - Watch for follow-up attempts

Breach Notification
GDPR requires notification within 72 hours if:

Personal data compromised
Risk to users' rights and freedoms
Breach affects EU residents


Conclusion
Security is enforced through layered defense:

Middleware - Authentication, rate limiting, CSRF
Adapters - Input validation, SQL injection prevention
Plugins - Authorization, business logic
Database - Row-level security, constraints

Plugins inherit security by using core services correctly.
Key Principles:

Secure by default
Defense in depth
Least privilege
Fail securely
Audit everything


See Also:

CORE_SERVICES_ARCHITECTURE.md - Service adapters
REFACTORING_EXISTING_PLUGINS.md - Adding security to existing code
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Development conventions