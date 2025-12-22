# Development Guide V2

## Project Overview

Homebase is a modular plugin-based platform with service abstraction architecture. The system enables parallel team development with zero conflicts while maintaining enterprise-grade security and performance.

---

## Architecture Philosophy

### Modular Service System
- **Service Abstraction** - Infrastructure swappable via configuration
- **Plugin Isolation** - Each plugin manages its own state independently
- **Security By Default** - Enforcement at multiple layers
- **Zero Conflicts** - Teams can develop plugins in parallel

### Key Benefits
- Infrastructure changes don't require code changes
- Security enforced automatically through core services
- New plugins integrate automatically
- Testing simplified with mock adapters

---

## Tech Stack

### Frontend
- **React 18** + TypeScript + Vite
- **Modular Contexts** - Plugin-specific state management
- **Responsive Design** - Mobile-first with conditional rendering
- **Universal Keyboard Navigation** - Space + Arrow keys

### Backend  
- **Express.js** + PostgreSQL
- **ServiceManager** - Core service orchestration
- **Plugin-loader** - Automatic plugin discovery
- **Security Middleware** - Authentication, CSRF, rate limiting

### Infrastructure
- **Development:** PostgreSQL with session store
- **Production:** Railway + Neon databases
- **Storage:** Configurable (local, S3, R2, Scaleway)
- **Email:** Configurable (SMTP, SendGrid, Resend)

---

## Project Structure
```
homebase/
├── vite.config.ts          # Vite configuration (ROOT)
├── tailwind.config.ts      # Tailwind CSS configuration (ROOT)
├── package.json            # All dependencies (ROOT)
├── tsconfig.json           # TypeScript configuration (ROOT)
├── client/
│   ├── index.html          # HTML entry point
│   └── src/                # React application
│       ├── core/           # Core system files
│       ├── plugins/        # Plugin implementations
│       └── App.tsx         # Main application
├── server/                 # Express.js backend
│   ├── core/              # Core services and middleware
│   │   ├── ServiceManager.js
│   │   ├── services/      # Service adapters
│   │   ├── middleware/    # Security middleware
│   │   └── errors/        # Error types
│   └── app.js
├── plugins/                # Backend plugin implementations
├── config/                 # Configuration files
│   └── services.js        # Service provider configuration
└── docs/                   # Documentation
Key Points:

Single package.json manages all dependencies
All configs in ROOT for proper path resolution
No separate frontend package management


Development Environment Setup
Prerequisites

Node.js 18+
PostgreSQL
Git

Installation
# Clone repository
git clone [repository-url]
cd homebase

# Install ALL dependencies from ROOT
npm install

# Setup development database
node scripts/setup-database.js

# Environment configuration
cp .env.example .env.local
# Edit DATABASE_URL and service provider settings
Environment Variables
Required variables:
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/homebase_dev

# Session
SESSION_SECRET=your-secret-key-here

# Service Providers (optional - defaults to local/dev)
DB_PROVIDER=postgres
STORAGE_PROVIDER=local
EMAIL_PROVIDER=smtp
Production variables:
# Database
DATABASE_URL=your-neon-connection-string

# Service Providers
DB_PROVIDER=neon
STORAGE_PROVIDER=r2
EMAIL_PROVIDER=resend

# Provider-specific config
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_BUCKET=...
RESEND_API_KEY=...

Running the Application
Development Terminal Setup
# Terminal 1: Frontend development server (from ROOT)
npx vite

# Terminal 2: Backend API server (from ROOT)
npm run dev

# Terminal 3: Commands and testing (from ROOT)
# Available for git, database, testing commands
CRITICAL: Always run commands from project root directory.
Development URLs

Frontend: http://localhost:3001
Backend API: http://localhost:3002
Health Check: curl http://localhost:3002/api/health


Service Configuration
Configuring Service Providers
config/services.js:
const env = process.env.NODE_ENV || 'development';

const configs = {
  development: {
    DATABASE_PROVIDER: 'postgres',
    STORAGE_PROVIDER: 'local',
    EMAIL_PROVIDER: 'smtp',
    QUEUE_PROVIDER: 'memory',
    CACHE_PROVIDER: 'memory',
    
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
    DATABASE_PROVIDER: process.env.DB_PROVIDER || 'neon',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'r2',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',
    
    // Provider-specific configurations
  }
};

module.exports = configs[env];
Switching providers:

Update DATABASE_PROVIDER in config
Add provider credentials to .env.local
Restart server
No code changes needed


Plugin Development Workflow
Creating a New Plugin
Backend (5-10 min):
# Copy backend template
cp -r templates/plugin-backend-template plugins/my-plugin
cd plugins/my-plugin

# Configure
# 1. Update plugin.config.js (name, routeBase)
# 2. Define database schema in model.js
# 3. Implement business logic using ServiceManager
# 4. Add security middleware to routes.js
Frontend (10-15 min):
# Copy frontend template
cp -r templates/plugin-frontend-template client/src/plugins/my-plugin

# Implement
# 1. Define TypeScript types
# 2. Create API layer with CSRF handling
# 3. Implement context with panel registration
# 4. Build responsive components
Registration (2 min):
// Add to client/src/core/pluginRegistry.ts
{
  name: 'my-plugin',
  Provider: MyPluginProvider,
  hook: useMyPlugin,
  panelKey: 'isMyPluginPanelOpen',
  components: { List, Form, View }
}
Testing:
# Backend tests
npm test plugins/my-plugin

# Frontend tests
npm test client/src/plugins/my-plugin

# Integration tests
npm run test:integration

Database Management
Creating Migrations
// migrations/XXX_create_my_plugin.js
module.exports = {
  up: async (database) => {
    await database.query(`
      CREATE TABLE my_plugin_items (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      )
    `);
  },
  
  down: async (database) => {
    await database.query('DROP TABLE IF EXISTS my_plugin_items');
  }
};
Running Migrations
# Run pending migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Reset database (WARNING: deletes all data)
npm run migrate:reset

Testing
Unit Tests
Backend:
const ServiceManager = require('../../server/core/ServiceManager');
const MockDatabaseAdapter = require('../../server/core/services/database/adapters/MockAdapter');

describe('My Plugin Model', () => {
  beforeEach(() => {
    ServiceManager.override('database', new MockDatabaseAdapter());
  });
  
  it('should create item', async () => {
    const item = await model.createItem({ title: 'Test' });
    expect(item).toHaveProperty('id');
  });
});
Frontend:
import { renderHook, act } from '@testing-library/react-hooks';
import { useMyPlugin } from './useMyPlugin';

describe('useMyPlugin', () => {
  it('should open panel in create mode', () => {
    const { result } = renderHook(() => useMyPlugin());
    act(() => result.current.openMyPluginPanel(null));
    expect(result.current.panelMode).toBe('create');
  });
});
Integration Tests
const request = require('supertest');
const app = require('../../server/app');

describe('My Plugin API', () => {
  it('should require authentication', async () => {
    const response = await request(app).get('/api/my-plugin');
    expect(response.status).toBe(401);
  });
  
  it('should create item with CSRF token', async () => {
    const { csrfToken } = await request(app)
      .get('/api/csrf-token')
      .then(r => r.body);
    
    const response = await request(app)
      .post('/api/my-plugin')
      .set('X-CSRF-Token', csrfToken)
      .send({ title: 'Test' });
    
    expect(response.status).toBe(201);
  });
});

Security Best Practices
Backend Security Checklist

 All routes use requirePlugin() middleware
 POST/PUT/DELETE routes use CSRF protection
 Input validation with express-validator
 Rate limiting on sensitive endpoints
 Ownership verification on UPDATE/DELETE
 Use ServiceManager for all infrastructure
 Standardized error handling with AppError
 Audit logging for sensitive operations

Frontend Security Checklist

 CSRF token included in all mutations
 Input sanitization before display
 Error handling for all API calls
 Loading states prevent double submissions
 No sensitive data in console logs
 Proper error messages (no internal details)


Debugging
Backend Debugging
# Enable debug logging
DEBUG=* npm run dev

# Watch for file changes
npm run dev:watch

# Check database queries
DEBUG=database npm run dev
Frontend Debugging
# React DevTools
# Install browser extension

# Check component re-renders
# React DevTools > Profiler

# Network tab
# Browser DevTools > Network > Filter by XHR
Common Issues
"Could not resolve @/core/api/AppContext"

Cause: Running Vite from wrong directory
Fix: Run npx vite from project root, not client/

"Database connection failed"

Cause: PostgreSQL not running or wrong credentials
Fix:

Start PostgreSQL
Verify DATABASE_URL in .env.local
Run node scripts/setup-database.js



"CSRF token mismatch"

Cause: CSRF token not included or expired
Fix: Ensure frontend fetches fresh token and includes in headers


Deployment
Production Build
# Build frontend
npm run build

# Test production build locally
npm run preview

# Build includes:
# - Minified JavaScript
# - Optimized CSS
# - Source maps (for debugging)
Environment Setup
Production checklist:

 Set NODE_ENV=production
 Configure production database (Neon)
 Configure storage provider (R2, S3, Scaleway)
 Configure email provider (Resend, SendGrid)
 Set strong SESSION_SECRET
 Enable HTTPS
 Configure CORS if needed
 Setup error tracking (Sentry)
 Configure logging service
 Setup backups

Railway Deployment
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs

Performance Optimization
Frontend Optimization
Code Splitting:
// Lazy load plugin components
const MyPluginList = React.lazy(() => import('./components/MyPluginList'));
Caching:
// Use cache service for expensive queries
const cache = ServiceManager.get('cache');
const items = await cache.wrap('my-plugin:items', async () => {
  return await database.query('SELECT * FROM items', []);
}, 300);
Pagination:
// Limit query results
const items = await database.query(
  'SELECT * FROM items ORDER BY created_at DESC LIMIT ? OFFSET ?',
  [pageSize, offset]
);
Backend Optimization
Database Indexing:
sql-- Add indexes for frequently queried fields
CREATE INDEX idx_user_id ON my_plugin_items(user_id);
CREATE INDEX idx_created_at ON my_plugin_items(created_at);
Connection Pooling:
// Configured in database adapter
{
  max: 20,           // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

Monitoring
Logging
const logger = ServiceManager.get('logger');

logger.info('Operation completed', { userId, itemId });
logger.warn('Deprecated feature used', { feature });
logger.error('Operation failed', error, { context });
Error Tracking
Sentry integration:
// Configure in production
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production'
  });
}
Health Checks
// GET /api/health
{
  status: 'ok',
  database: 'connected',
  uptime: 12345,
  version: '1.0.0'
}

Best Practices
Code Organization

Keep components focused and single-purpose
Use TypeScript interfaces for all data structures
Implement proper error boundaries
Add loading states for async operations

Security

Never trust client input
Validate all user data server-side
Use parameterized queries (never string interpolation)
Implement rate limiting on sensitive endpoints
Log security events

Performance

Cache expensive queries
Use pagination for large datasets
Optimize database queries (use indexes)
Minimize re-renders (React.memo, useMemo)

Testing

Write unit tests for business logic
Write integration tests for APIs
Test with mock adapters for speed
Test edge cases and error conditions


Troubleshooting
Development Environment
Frontend not loading:

Check both terminals are running
Verify accessing http://localhost:3001
Check browser console for errors
Ensure no port conflicts

Backend errors:

Check PostgreSQL is running
Verify DATABASE_URL is correct
Check server logs for details
Verify all environment variables set

Plugin not appearing:

Check plugin registered in pluginRegistry.ts
Verify plugin enabled for user in database
Check console for loading errors
Verify all required files exist


Conclusion
Development workflow:

✅ Service abstraction enables flexible infrastructure
✅ Security enforced at multiple layers
✅ Plugin isolation prevents conflicts
✅ Testing simplified with mock adapters
✅ Deployment streamlined with configuration

Follow these practices for efficient, secure development.

See Also:

CORE_SERVICES_ARCHITECTURE.md - Service details
SECURITY_GUIDELINES.md - Security requirements
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Plugin conventions
BACKEND_PLUGIN_GUIDE_V2.md - Backend development
FRONTEND_PLUGIN_GUIDE_V2.md - Frontend development