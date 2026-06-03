# Core Services (server)

This directory contains the core infrastructure services for Homebase.

**Canonical architecture doc:** `docs/CORE_SERVICES_ARCHITECTURE.md` (ServiceManager scope, providers). This README is operator-focused (env, csurf, audit).

## Structure

```
server/core/
├── ServiceManager.js          # Central service manager
├── Bootstrap.js               # Core startup helpers
├── routes/                    # Core route setup
│   └── setupCoreRoutes.js
├── errors/
│   └── AppError.js            # Standardized error handling
├── services/
│   ├── database/
│   │   ├── DatabaseService.js  # Base database interface
│   │   └── adapters/
│   │       └── PostgreSQLAdapter.js  # PostgreSQL implementation
│   ├── tenant/
│   │   └── providers/          # Local/Neon tenant providers
│   ├── connection-pool/
│   │   └── providers/          # Pool provider implementations
│   ├── publicShareRouting.js   # Public share route tenant lookup
│   └── logger/
│       ├── LoggerService.js   # Base logger interface
│       └── adapters/
│           └── ConsoleAdapter.js  # Console logger implementation
├── storage/
│   └── localStorageService.js
└── middleware/
    ├── csrf.js                # CSRF protection
    ├── validation.js          # Input validation helpers
    ├── rateLimit.js           # Rate limiting
    └── errorHandler.js        # Error handling middleware
```

## Installation

Install required dependencies:

```bash
npm install csurf express-validator express-rate-limit
```

Note: `csurf` is deprecated but still functional. Consider migrating to `csrf` package in the future.

## Usage

### ServiceManager

```javascript
const ServiceManager = require('./server/core/ServiceManager');

// Get services (automatically initialized with request context)
const database = ServiceManager.get('database', req);
const logger = ServiceManager.get('logger');

// Use database service
const contacts = await database.query(
  'SELECT * FROM contacts WHERE id = $1',
  [contactId],
  // user_id filter automatically added
);
```

### Error Handling

```javascript
const { AppError } = require('./server/core/errors/AppError');

// Throw standardized errors
if (!contact) {
  throw new AppError('Contact not found', 404, AppError.CODES.NOT_FOUND);
}
```

### Validation

```javascript
const { commonRules, validateRequest } = require('./server/core/middleware/validation');

router.post(
  '/contacts',
  [
    requireAuth(),
    commonRules.string('companyName', 1, 255),
    commonRules.email('email'),
    commonRules.optionalString('phone'),
    validateRequest,
  ],
  controller.createContact,
);
```

### CSRF Protection

Active when `ENABLE_CSRF=true`. Uses **session-backed** `csurf` (`cookie: false`) — do not enable
`cookie: true` without `cookie-parser` (causes `misconfigured csrf` → 500).

```javascript
const { csrfProtection, csrfTokenHandler } = require('./server/core/middleware/csrf');

// In server/index.ts (before global rate limiter):
app.get('/api/csrf-token', csrfProtection, csrfTokenHandler);

router.post('/contacts', csrfProtection, controller.createContact);
```

Client: `client/src/core/api/apiFetch.ts`. Production troubleshooting: `docs/RAILWAY_HOMEBASE_SETUP.md` §5.

### Rate Limiting

```javascript
const { globalLimiter, authLimiter } = require('./server/core/middleware/rateLimit');

app.use('/api', globalLimiter); // prod default: 3000 req / 15 min; see RATE_LIMIT_MAX
router.post('/auth/login', authLimiter, authController.login);
```

Skipped from global limiter (stripped and `/api/...` paths): `health`, `csrf-token`, `auth/me`, `auth/login`, `auth/signup`.

## Features

- **Automatic Tenant Isolation**: Database service automatically filters by user_id
- **Parameterized Queries Only**: SQL injection prevention enforced
- **Structured Logging**: Consistent logging format across all services
- **Standardized Errors**: AppError class for consistent error responses
- **Security Middleware**: CSRF, validation, rate limiting built-in

## Configuration

Service configuration is in `config/services.js` and can be overridden via environment variables:

- `DATABASE_PROVIDER` - Database provider (default: 'postgres')
- `LOGGER_PROVIDER` - Logger provider (default: 'console')
- `LOG_LEVEL` - Log level (default: 'info')

### Security-related environment variables

| Variable                                 | Purpose                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SESSION_SECRET`                         | Signing session cookies. **Required** in production (server exits if missing or default).                                |
| `ENABLE_CSRF`                            | Set to `true` to enforce CSRF on protected routes; client should use `apiFetch` (see `client/src/core/api/apiFetch.ts`). |
| `FORCE_RATE_LIMIT`                       | Set to `1` or `true` to apply global and auth rate limits outside production (staging / local testing).                  |
| `FRONTEND_URL`                           | Allowed CORS origin for the SPA in production.                                                                           |
| `PUBLIC_BOOKING_URL` / `PUBLIC_CUPS_URL` | Optional extra CORS origins for public mini-apps.                                                                        |

Public task/note share links resolve the tenant DB via the `public_share_routing` table on the main database (`npm run migrate:public-share-routing`).

### Dependency and upload review

- Run `npm audit` before releases. Typical flags include `axios`, `jspdf` / `html2pdf.js`, `express-rate-limit` (upgrade when a patched minor is available), `dompurify`, and transitive `cookie` via deprecated `csurf` — plan upgrades; avoid `npm audit fix --force` without testing.
- File uploads (`plugins/files/routes.js`): `uploadLimiter`, size cap, MIME allow-list, `path.basename` on stored names, and authenticated `gate` on upload/raw routes (except where intentionally public).
