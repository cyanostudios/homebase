Overview
Homebase core provides abstraction layers for all infrastructure dependencies. Plugins interact with interfaces, not implementations. This enables deployment flexibility, vendor independence, and simplified plugin development.
Core Principle: Build once, deploy anywhere.

Abstraction Philosophy
The Adapter Pattern
Core services use the Adapter Pattern to separate interface from implementation:
Plugin Code
↓
Core Service Interface (what to do)
↓
Service Adapter (how to do it)
↓
External Provider (S3, Redis, SendGrid, etc.)
Benefits:

Vendor Independence - Switch providers without changing plugin code
Environment Flexibility - Different implementations per environment (dev/staging/prod)
Testing Simplicity - Mock adapters for unit tests
Cost Optimization - Choose providers based on scale and budget
Compliance - EU providers for GDPR, self-hosted for sensitive data

Configuration-Driven Architecture
Infrastructure decisions made in one configuration file, not scattered across codebase:
// config/services.js
module.exports = {
DATABASE_PROVIDER: 'neon', // or 'postgres', 'cockroachdb'
STORAGE_PROVIDER: 'r2', // or 's3', 'local', 'scaleway'
EMAIL_PROVIDER: 'resend', // or 'sendgrid', 'smtp'
QUEUE_PROVIDER: 'bullmq', // or 'postgres', 'sqs'
CACHE_PROVIDER: 'redis', // or 'memory', 'dragonfly'
REALTIME_PROVIDER: 'socketio', // or 'pusher', 'ably'
};
Change one line → entire infrastructure layer switches.

Core Services

1. Database Service
   Interface:
   interface DatabaseService {
   query(sql: string, params: any[]): Promise<any[]>;
   transaction(callback: (client) => Promise<void>): Promise<void>;
   insert(table: string, data: object): Promise<object>;
   update(table: string, id: string, data: object): Promise<object>;
   delete(table: string, id: string): Promise<void>;
   }
   Available Adapters:

NeonAdapter - Cloud PostgreSQL (current default)
PostgreSQLAdapter - Self-hosted PostgreSQL
CockroachDBAdapter - Distributed SQL
SQLiteAdapter - Development/testing only

Plugin Usage:
const { database } = useCoreServices();

// Tenant isolation automatic
const contacts = await database.query(
'SELECT \* FROM contacts WHERE id = ?',
[contactId]
);
// Core automatically adds: AND user_id = current_user_id
Adapter Responsibilities:

Tenant isolation (automatic user_id filtering)
Connection pooling
Query parameterization (SQL injection protection)
Error standardization
Audit logging

Plugin Responsibilities:

Define table schemas
Write business logic queries
Handle business-level errors

2. Storage Service
   Interface:
   interface StorageService {
   upload(file: Buffer, path: string, options?: UploadOptions): Promise<string>;
   download(path: string): Promise<Buffer>;
   delete(path: string): Promise<void>;
   getPublicURL(path: string): string;
   getSignedURL(path: string, expiresIn: number): string;
   }

interface UploadOptions {
public?: boolean;
contentType?: string;
maxSize?: number;
allowedTypes?: string[];
}
Available Adapters:

LocalFileSystemAdapter - Development only (not production)
S3Adapter - AWS S3
R2Adapter - Cloudflare R2 (cost-effective)
ScalewayAdapter - EU-based (GDPR compliance)
MinIOAdapter - Self-hosted S3-compatible

Plugin Usage:
const { storage } = useCoreServices();

const url = await storage.upload(fileBuffer, 'contacts/photos/avatar.jpg', {
public: true,
maxSize: 5 _ 1024 _ 1024, // 5MB
allowedTypes: ['image/jpeg', 'image/png']
});

// url = "https://cdn.example.com/contacts/photos/avatar.jpg"
Adapter Responsibilities:

File type validation
Size limit enforcement
Virus scanning (optional)
Path sanitization (prevent directory traversal)
CDN integration
Metadata extraction

Plugin Responsibilities:

Define file organization structure
Specify validation rules per use case
Handle file references in database

CRITICAL: Never use local filesystem in production - files will be lost on container restart.

3. Email Service
   Interface:
   interface EmailService {
   send(options: EmailOptions): Promise<void>;
   sendBulk(recipients: string[], options: EmailOptions): Promise<void>;
   sendTemplate(templateId: string, to: string, data: object): Promise<void>;
   }

interface EmailOptions {
to: string | string[];
from?: string;
subject: string;
text?: string;
html?: string;
attachments?: Attachment[];
}
Available Adapters:

ResendAdapter - Modern, developer-friendly
SendGridAdapter - Enterprise-grade
PostmarkAdapter - Transactional focus
SMTPAdapter - Self-hosted email server
SESAdapter - AWS Simple Email Service

Plugin Usage:
const { email } = useCoreServices();

await email.send({
to: contact.email,
subject: 'Welcome to the Festival',
html: welcomeEmailTemplate(contact)
});
Adapter Responsibilities:

Rate limiting (prevent spam)
Bounce handling
Unsubscribe management
Delivery tracking
Template rendering (if supported)

Plugin Responsibilities:

Email content and design
Recipient list management
Trigger conditions (when to send)

4. Queue Service
   Interface:
   interface QueueService {
   add(jobType: string, data: object, options?: JobOptions): Promise<string>;
   process(jobType: string, handler: (job) => Promise<void>): void;
   getStatus(jobId: string): Promise<JobStatus>;
   cancel(jobId: string): Promise<void>;
   }

interface JobOptions {
priority?: number;
delay?: number;
attempts?: number;
backoff?: number;
}
Available Adapters:

BullMQAdapter - Redis-based (production standard)
PostgresQueueAdapter - Database-based (pg-boss)
SQSAdapter - AWS Simple Queue Service
MemoryAdapter - Development only (not persistent)

Plugin Usage:
const { queue } = useCoreServices();

// Queue bulk email job
const jobId = await queue.add('send-bulk-email', {
recipients: volunteerEmails,
subject: 'Schedule Update',
body: emailContent
}, {
priority: 5,
attempts: 3
});

// Process jobs
queue.process('send-bulk-email', async (job) => {
await sendBulkEmails(job.data);
});
Adapter Responsibilities:

Job persistence
Retry logic with exponential backoff
Job prioritization
Progress tracking
Dead letter queue (failed jobs)

Plugin Responsibilities:

Define job types
Implement job handlers
Handle job-specific errors

Use Cases:

Bulk email sending
Data import/export
Report generation
Scheduled tasks
Long-running operations

5. Cache Service
   Interface:
   interface CacheService {
   get(key: string): Promise<any>;
   set(key: string, value: any, ttl?: number): Promise<void>;
   delete(key: string): Promise<void>;
   invalidate(pattern: string): Promise<void>;
   wrap(key: string, fetcher: () => Promise<any>, ttl?: number): Promise<any>;
   }
   Available Adapters:

RedisAdapter - Industry standard
DragonflyAdapter - Redis-compatible, higher performance
MemoryAdapter - Development/single-instance only
MemcachedAdapter - Lightweight alternative

Plugin Usage:
const { cache } = useCoreServices();

// Automatic cache with fallback
const contacts = await cache.wrap('contacts:list:user:123', async () => {
return await database.query('SELECT \* FROM contacts WHERE user_id = ?', [userId]);
}, 300); // Cache for 5 minutes

// Manual cache management
await cache.set('contact:456', contactData, 3600);
const contact = await cache.get('contact:456');
Adapter Responsibilities:

TTL enforcement
Memory management
Serialization/deserialization
Pattern-based invalidation

Plugin Responsibilities:

Define cache keys (use namespacing: plugin:resource:id)
Set appropriate TTL per resource type
Invalidate cache on updates

Best Practices:

Cache expensive queries (joins, aggregations)
Use short TTL for frequently changing data
Invalidate on create/update/delete operations
Use consistent key naming: plugin:resource:identifier

6. Realtime Service
   Interface:
   interface RealtimeService {
   emit(channel: string, event: string, data: object): void;
   subscribe(channel: string, callback: (event, data) => void): void;
   unsubscribe(channel: string): void;
   broadcast(event: string, data: object): void;
   }
   Available Adapters:

SocketIOAdapter - Self-hosted WebSocket
PusherAdapter - Cloud WebSocket service
AblyAdapter - Enterprise realtime platform
PollingAdapter - Fallback for environments without WebSocket

Plugin Usage:
const { realtime } = useCoreServices();

// Emit update to specific channel
realtime.emit('events:festival-123', 'assignment.updated', {
shiftId: '456',
volunteerId: '789'
});

// Subscribe to updates
realtime.subscribe('events:festival-123', (event, data) => {
if (event === 'assignment.updated') {
refreshSchedule();
}
});
Adapter Responsibilities:

Connection management
Channel authorization
Message delivery guarantees
Reconnection handling
Scaling across multiple servers

Plugin Responsibilities:

Define channel naming (use namespacing)
Determine what events to emit
Handle received events in UI

Channel Naming Convention:

plugin:resource:id - Specific resource updates
plugin:tenant:id - Tenant-wide updates
plugin:global - System-wide broadcasts

7. Search Service
   Interface:
   interface SearchService {
   index(collection: string, id: string, document: object): Promise<void>;
   search(collection: string, query: string, options?: SearchOptions): Promise<SearchResult[]>;
   delete(collection: string, id: string): Promise<void>;
   suggest(collection: string, query: string, field: string): Promise<string[]>;
   }

interface SearchOptions {
filters?: object;
sort?: string;
limit?: number;
offset?: number;
}
Available Adapters:

PostgresFullTextAdapter - Built-in PostgreSQL search
MeilisearchAdapter - Fast, typo-tolerant
TypesenseAdapter - Open-source alternative
AlgoliaAdapter - Cloud search (premium)

Plugin Usage:
const { search } = useCoreServices();

// Index contact on creation
await search.index('contacts', contact.id, {
companyName: contact.companyName,
email: contact.email,
phone: contact.phone
});

// Search
const results = await search.search('contacts', userQuery, {
filters: { user_id: currentUserId },
limit: 20
});
Adapter Responsibilities:

Document indexing
Query parsing
Relevance ranking
Typo tolerance
Faceted search (filters)

Plugin Responsibilities:

Define searchable fields
Update index on data changes
Present search results

8. Logging Service
   Interface:
   interface LoggingService {
   info(message: string, context?: object): void;
   warn(message: string, context?: object): void;
   error(message: string, error: Error, context?: object): void;
   debug(message: string, context?: object): void;
   }
   Available Adapters:

ConsoleAdapter - Development only
FileAdapter - Simple production logging
SentryAdapter - Error tracking and monitoring
LogtailAdapter - Betterstack logging
CloudWatchAdapter - AWS logging

Plugin Usage:
const { logger } = useCoreServices();

logger.info('Contact created', { contactId: contact.id, userId: user.id });
logger.error('Failed to send email', error, { contactId, emailType: 'welcome' });
Adapter Responsibilities:

Log aggregation
Error tracking
Performance monitoring
Alert triggering
Log retention

Plugin Responsibilities:

Log meaningful events
Include context (IDs, user info)
Use appropriate log levels

Log Levels:

debug - Development only, verbose
info - Normal operations, audit trail
warn - Recoverable errors, deprecations
error - Failures requiring investigation

Service Manager
Core provides a central Service Manager that initializes and provides all services:
// server/core/ServiceManager.js
class ServiceManager {
constructor(config) {
this.services = {
database: this.initService('database', config),
storage: this.initService('storage', config),
email: this.initService('email', config),
queue: this.initService('queue', config),
cache: this.initService('cache', config),
realtime: this.initService('realtime', config),
search: this.initService('search', config),
logger: this.initService('logger', config)
};
}

initService(name, config) {
const provider = config[`${name.toUpperCase()}_PROVIDER`];
const AdapterClass = require(`./services/${name}/adapters/${provider}`);
return new AdapterClass(config[name][provider]);
}

get(serviceName) {
return this.services[serviceName];
}
}

module.exports = new ServiceManager(require('../config/services'));
Plugins access services via:
const serviceManager = require('../../server/core/ServiceManager');
const database = serviceManager.get('database');
const storage = serviceManager.get('storage');

```

---

## Creating New Adapters

### Adapter Structure
```

server/core/services/
├── storage/
│ ├── StorageService.js # Interface definition
│ └── adapters/
│ ├── LocalAdapter.js
│ ├── S3Adapter.js
│ ├── R2Adapter.js
│ └── ScalewayAdapter.js
Adapter Template
// server/core/services/storage/adapters/R2Adapter.js
const StorageService = require('../StorageService');

class R2Adapter extends StorageService {
constructor(config) {
super();
this.client = this.initializeR2Client(config);
this.bucket = config.bucket;
this.publicURL = config.publicURL;
}

async upload(file, path, options = {}) {
// Validation (enforced by adapter)
this.validateFile(file, options);

    // Upload to R2
    await this.client.putObject({
      Bucket: this.bucket,
      Key: path,
      Body: file,
      ContentType: options.contentType,
      ACL: options.public ? 'public-read' : 'private'
    });

    // Return public URL
    return `${this.publicURL}/${path}`;

}

async download(path) {
const response = await this.client.getObject({
Bucket: this.bucket,
Key: path
});
return response.Body;
}

async delete(path) {
await this.client.deleteObject({
Bucket: this.bucket,
Key: path
});
}

getPublicURL(path) {
return `${this.publicURL}/${path}`;
}

getSignedURL(path, expiresIn) {
return this.client.getSignedUrl('getObject', {
Bucket: this.bucket,
Key: path,
Expires: expiresIn
});
}

validateFile(file, options) {
if (options.maxSize && file.length > options.maxSize) {
throw new Error('File exceeds maximum size');
}

    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      throw new Error('File type not allowed');
    }

}
}

module.exports = R2Adapter;
Interface Definition:
// server/core/services/storage/StorageService.js
class StorageService {
async upload(file, path, options) {
throw new Error('Method not implemented');
}

async download(path) {
throw new Error('Method not implemented');
}

async delete(path) {
throw new Error('Method not implemented');
}

getPublicURL(path) {
throw new Error('Method not implemented');
}

getSignedURL(path, expiresIn) {
throw new Error('Method not implemented');
}
}

module.exports = StorageService;

Configuration Management
Environment-Specific Configs
// config/services.js
const env = process.env.NODE_ENV || 'development';

const configs = {
development: {
DATABASE_PROVIDER: 'postgres',
STORAGE_PROVIDER: 'local',
EMAIL_PROVIDER: 'smtp',
QUEUE_PROVIDER: 'memory',
CACHE_PROVIDER: 'memory',
REALTIME_PROVIDER: 'socketio',

    database: {
      postgres: {
        host: 'localhost',
        port: 5432,
        database: 'homebase_dev'
      }
    },
    storage: {
      local: {
        path: './uploads'
      }
    }

},

production: {
DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || 'neon',
STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'r2',
EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
QUEUE_PROVIDER: process.env.QUEUE_PROVIDER || 'bullmq',
CACHE_PROVIDER: process.env.CACHE_PROVIDER || 'redis',
REALTIME_PROVIDER: process.env.REALTIME_PROVIDER || 'pusher',

    database: {
      neon: {
        connectionString: process.env.DATABASE_URL
      }
    },
    storage: {
      r2: {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKey: process.env.R2_ACCESS_KEY,
        secretKey: process.env.R2_SECRET_KEY,
        bucket: process.env.R2_BUCKET,
        publicURL: process.env.R2_PUBLIC_URL
      }
    }

}
};

module.exports = configs[env];

Extension Points
Adding New Services
To add a new core service (e.g., SMS):

Define interface:

// server/core/services/sms/SMSService.js
class SMSService {
async send(to, message) {
throw new Error('Method not implemented');
}
}

Create adapter:

// server/core/services/sms/adapters/TwilioAdapter.js
class TwilioAdapter extends SMSService {
async send(to, message) {
// Implementation
}
}

Register in ServiceManager:

this.services.sms = this.initService('sms', config);

Add to config:

SMS_PROVIDER: 'twilio',
sms: {
twilio: { accountSid, authToken }
}

Use in plugins:

const { sms } = useCoreServices();
await sms.send('+46701234567', 'Your shift starts in 1 hour');

Multi-Tenant Considerations
Automatic Tenant Isolation
Core services automatically enforce tenant boundaries:
Database Service:
// Plugin queries without tenant awareness
const contacts = await database.query('SELECT \* FROM contacts');

// Core automatically rewrites to:
// SELECT \* FROM contacts WHERE user_id = current_user_id
Storage Service:
// Plugin uploads without tenant path
await storage.upload(file, 'avatar.jpg');

// Core automatically namespaces:
// tenant-123/avatar.jpg
Cache Service:
// Plugin caches without tenant key
await cache.set('contacts', data);

// Core automatically namespaces:
// tenant:123:contacts
Tenant-Aware Adapters
Adapters receive tenant context from middleware:
class DatabaseAdapter {
async query(sql, params, tenantId) {
// Add tenant filter automatically
const modifiedSQL = this.addTenantFilter(sql, tenantId);
return this.pool.query(modifiedSQL, [...params, tenantId]);
}

addTenantFilter(sql, tenantId) {
// Parse SQL and inject WHERE user_id = ?
// Or use Row-Level Security in PostgreSQL
}
}

Best Practices
For Plugin Developers
DO:

✅ Use core services for all infrastructure operations
✅ Rely on adapters for security enforcement
✅ Define business logic, not infrastructure logic
✅ Trust tenant isolation from core
✅ Use standardized error handling
✅ Log through logging service, not console.log

DON'T:

❌ Direct database connections (use database service)
❌ Direct file system access (use storage service)
❌ Manual tenant filtering (core handles it)
❌ Hardcoded provider APIs (use adapters)
❌ Skip validation (adapters enforce it)

For Core Developers
DO:

✅ Keep interfaces stable (breaking changes affect all plugins)
✅ Enforce security in adapters (plugins can't bypass)
✅ Provide clear error messages
✅ Document adapter requirements
✅ Version interfaces (allow gradual migration)

DON'T:

❌ Expose provider-specific features in interface
❌ Allow plugins to bypass adapters
❌ Break backward compatibility without migration path
❌ Let adapters have plugin-specific logic

Testing with Adapters
Mock Adapters
Create mock adapters for testing:
// server/core/services/storage/adapters/MockAdapter.js
class MockStorageAdapter extends StorageService {
constructor() {
super();
this.files = new Map();
}

async upload(file, path) {
this.files.set(path, file);
return `mock://storage/${path}`;
}

async download(path) {
return this.files.get(path);
}

async delete(path) {
this.files.delete(path);
}

getPublicURL(path) {
return `mock://storage/${path}`;
}
}
Test configuration:
// config/services.test.js
module.exports = {
DATABASE_PROVIDER: 'sqlite',
STORAGE_PROVIDER: 'mock',
EMAIL_PROVIDER: 'mock',
QUEUE_PROVIDER: 'memory',
CACHE_PROVIDER: 'memory'
};
Benefits:

Fast tests (no external dependencies)
Deterministic (no network issues)
Isolated (no shared state)
Simple (predictable behavior)

Migration Strategy
From Direct Calls to Core Services
Before:
// Direct PostgreSQL
const db = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE*URL });
const contacts = await pool.query('SELECT * FROM contacts WHERE user*id = ?', [userId]);
After:
// Core service
const { database } = require('../../server/core/ServiceManager');
const contacts = await database.query('SELECT * FROM contacts WHERE id = ?', [contactId]);
// Tenant filtering automatic
Migration Steps:

Replace direct imports with ServiceManager
Remove manual tenant filtering
Remove connection management
Update error handling to use standardized errors
Test with mock adapters first
Deploy with same provider (no infrastructure change)
Later: switch providers via config

Conclusion
Core services provide:

Abstraction - Plugins don't care about implementation
Flexibility - Switch providers without code changes
Security - Enforcement at adapter level
Simplicity - Plugins focus on business logic
Testing - Mock adapters for fast tests
Multi-tenant - Automatic isolation

Result: Plugins become portable, secure, and simple to develop.

See Also:

SECURITY_GUIDELINES.md - Security enforcement in adapters
REFACTORING_EXISTING_PLUGINS.md - Migrating to core services
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Plugin conventions
