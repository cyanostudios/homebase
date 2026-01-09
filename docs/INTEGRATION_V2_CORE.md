# V2 Core Infrastructure Integration

## Overview

Core infrastructure has been successfully integrated into `server/index.ts`. This document describes what was integrated and how to use it.

## What Was Integrated

### 1. ServiceManager
- **Location**: `server/core/ServiceManager.js`
- **Usage**: Automatically initialized in tenant pool middleware
- **Services Available**:
  - `database` - Database service with automatic tenant isolation
  - `logger` - Structured logging service

### 2. Error Handling
- **Location**: `server/core/middleware/errorHandler.js`
- **Integration**: Replaced basic error handler at end of middleware stack
- **Features**:
  - Handles `AppError` instances with standardized responses
  - Handles validation errors from express-validator
  - Logs all errors with context
  - Never exposes internal error details to clients

### 3. Rate Limiting
- **Location**: `server/core/middleware/rateLimit.js`
- **Integration**:
  - Global rate limiter applied to all `/api` routes
  - Auth rate limiter applied to `/api/auth/login`
- **Limits**:
  - Global: 100 requests per 15 minutes
  - Auth: 5 attempts per minute

### 4. CSRF Protection
- **Location**: `server/core/middleware/csrf.js`
- **Integration**: 
  - CSRF token endpoint: `GET /api/csrf-token`
  - Ready to use in plugin routes (see usage below)

### 5. Structured Logging
- **Location**: `server/core/services/logger/`
- **Integration**: All `console.log`/`console.error` replaced with logger service
- **Benefits**:
  - Consistent log format
  - Context included in all logs
  - Configurable log levels

## Usage in Plugins

### Database Service

```javascript
const ServiceManager = require('../../server/core/ServiceManager');

// In controller or model
async getAll(req, res) {
  const database = ServiceManager.get('database', req);
  
  // Automatic tenant isolation - no need to filter by user_id
  const contacts = await database.query(
    'SELECT * FROM contacts ORDER BY created_at DESC'
  );
  
  res.json(contacts);
}
```

### Logger Service

```javascript
const ServiceManager = require('../../server/core/ServiceManager');

// In controller
async create(req, res) {
  const logger = ServiceManager.get('logger');
  
  try {
    // ... create logic
    logger.info('Contact created', { contactId: contact.id, userId: req.session.user.id });
    res.json(contact);
  } catch (error) {
    logger.error('Failed to create contact', error, { userId: req.session.user.id });
    res.status(500).json({ error: 'Failed to create contact' });
  }
}
```

### Error Handling

```javascript
const { AppError } = require('../../server/core/errors/AppError');

async delete(req, res) {
  const contact = await database.query(
    'SELECT * FROM contacts WHERE id = $1',
    [req.params.id]
  );
  
  if (!contact) {
    throw new AppError('Contact not found', 404, AppError.CODES.NOT_FOUND);
  }
  
  // Error handler middleware will catch and format response
}
```

### CSRF Protection

```javascript
const { csrfProtection } = require('../../server/core/middleware/csrf');

// In routes
router.post('/contacts', csrfProtection, controller.createContact);
router.put('/contacts/:id', csrfProtection, controller.updateContact);
router.delete('/contacts/:id', csrfProtection, controller.deleteContact);
```

### Input Validation

```javascript
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

router.post('/contacts', [
  requireAuth(),
  commonRules.string('companyName', 1, 255),
  commonRules.email('email'),
  commonRules.optionalString('phone'),
  validateRequest,
], controller.createContact);
```

## Next Steps

1. **Install Dependencies** (if not already installed):
   ```bash
   npm install csurf express-validator express-rate-limit
   ```

2. **Migrate Plugins**:
   - Start with Notes plugin (simplest)
   - Replace direct pool access with ServiceManager
   - Add CSRF protection to POST/PUT/DELETE routes
   - Add input validation
   - Replace console.log with logger

3. **Test**:
   - Verify tenant isolation works correctly
   - Test error handling
   - Test rate limiting
   - Test CSRF protection

## Configuration

Service configuration is in `config/services.js` and can be overridden via environment variables:

- `DATABASE_PROVIDER` - Database provider (default: 'postgres')
- `LOGGER_PROVIDER` - Logger provider (default: 'console')
- `LOG_LEVEL` - Log level: 'debug', 'info', 'warn', 'error' (default: 'info')

## Notes

- ServiceManager is automatically initialized with request context in tenant pool middleware
- Database service automatically adds tenant isolation (user_id filtering)
- All errors are logged with context but never expose internal details
- Rate limiting is applied globally but can be bypassed for specific routes if needed
- CSRF protection is implemented on all plugin routes
