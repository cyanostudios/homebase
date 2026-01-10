# Architecture Refactor: Core + Plugins

## 🎯 Goal

Refactor backend into strictly modular "Core + Plugins" architecture where Core is the foundation (pipes, wiring) and Plugins are flexible rooms.

## ✅ Sprint 1: Foundation (COMPLETED)

### What We Built

#### 1. TenantService Interface

**Location**: `server/core/services/tenant/`

Abstract interface for multi-tenancy strategies with two implementations:

- **NeonTenantProvider** - Database-per-tenant using Neon projects
- **LocalTenantProvider** - Schema-per-tenant in local Postgres

**Methods**:

- `createTenant(userId, userEmail)` - Create new tenant database/schema
- `deleteTenant(userId)` - Delete tenant database/schema
- `getTenantConnection(userId)` - Get connection string
- `listTenants()` - List all tenants
- `tenantExists(userId)` - Check if tenant exists
- `getTenantMetadata(userId)` - Get tenant metadata

**Switch Provider**:

```bash
# Use Neon (production)
TENANT_PROVIDER=neon
NEON_API_KEY=your-key

# Use Local (development)
TENANT_PROVIDER=local
```

#### 2. ConnectionPoolService Interface

**Location**: `server/core/services/connection-pool/`

Abstract interface for connection pool management:

- **PostgresPoolProvider** - Direct pg.Pool management with automatic cleanup

**Features**:

- Pool caching and reuse
- Automatic cleanup of inactive pools (24h idle)
- Graceful shutdown support
- Pool statistics and monitoring

**Methods**:

- `getTenantPool(connectionString)` - Get or create pool
- `closeTenantPool(connectionString)` - Close specific pool
- `closeAllPools()` - Close all pools (shutdown)
- `getPoolStats()` - Get pool statistics
- `cleanupInactivePools()` - Manual cleanup trigger

**Switch Provider**:

```bash
# Use Postgres (default)
POOL_PROVIDER=postgres
POOL_MAX_SIZE=10
POOL_IDLE_TIMEOUT=30000
POOL_MAX_AGE=86400000
```

#### 3. Updated ServiceManager

**Location**: `server/core/ServiceManager.js`

Now dynamically loads providers based on environment variables:

```javascript
// Initialize services
ServiceManager.initialize();

// Get services
const tenant = ServiceManager.get('tenant');
const connectionPool = ServiceManager.get('connectionPool');
const database = ServiceManager.get('database');
const logger = ServiceManager.get('logger');

// Graceful shutdown
await ServiceManager.shutdown();
```

#### 4. Configuration

**Location**: `config/services.js`

Environment-specific configurations:

```javascript
// Development (uses local for no Neon API key)
TENANT_PROVIDER = local;
POOL_PROVIDER = postgres;

// Production (uses Neon)
TENANT_PROVIDER = neon;
POOL_PROVIDER = postgres;
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      ServiceManager                          │
│                    (Dependency Injection)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼──────┐ ┌───▼────────┐ ┌─▼──────────────┐
        │ TenantService│ │ PoolService│ │ DatabaseService│
        └───────┬──────┘ └───┬────────┘ └─┬──────────────┘
                │            │             │
        ┌───────┴──────┐ ┌───┴────────┐   │
        │   Providers  │ │  Providers │   │
        ├──────────────┤ ├────────────┤   │
        │ • Neon       │ │ • Postgres │   │
        │ • Local      │ │ • PgBouncer│   │
        │ • Supabase   │ │ • Supabase │   │
        │ • Shared     │ └────────────┘   │
        └──────────────┘                  │
                                          │
                    ┌─────────────────────┘
                    │
            ┌───────▼────────┐
            │    Plugins     │
            ├────────────────┤
            │ • Contacts     │
            │ • Tasks        │
            │ • Notes        │
            │ • Invoices     │
            │ • Estimates    │
            │ • Files        │
            └────────────────┘
```

---

## 🔄 How to Switch Providers

### Development → Production

**Before** (Development):

```bash
# .env.local
TENANT_PROVIDER=local
DATABASE_URL=postgresql://localhost/homebase
```

**After** (Production):

```bash
# .env (Railway)
TENANT_PROVIDER=neon
NEON_API_KEY=your-production-key
DATABASE_URL=postgresql://railway-host/homebase
```

**Result**: Zero code changes! Just environment variables.

---

## 🧪 Testing Provider Switching

Run tests:

```bash
npm test server/core/services/__tests__/ProviderSwitching.test.js
```

Manual test:

```bash
# Test with local provider
TENANT_PROVIDER=local npm run dev

# Test with neon provider
TENANT_PROVIDER=neon NEON_API_KEY=xxx npm run dev
```

---

## 📝 Next Steps (Sprint 2)

### Phase 2: Clean the Entry Point

1. **Create Bootstrap.js**
   - Move all initialization logic from `server/index.ts`
   - Minimal entry point

2. **Extract Core Routes**
   - `server/core/routes/auth.js` - Login, Signup, Logout
   - `server/core/routes/admin.js` - Admin endpoints
   - `server/core/routes/health.js` - Health check

3. **Update server/index.ts**

   ```typescript
   const Bootstrap = require('./core/Bootstrap');

   const app = Bootstrap.createApp();
   app.listen(PORT);

   process.on('SIGTERM', () => Bootstrap.shutdown());
   ```

---

## 🎁 Benefits Achieved

### ✅ Modularity

- Swap database provider with one env var
- Add new providers without touching core
- Plugins don't know about implementation details

### ✅ Development Experience

- No Neon API key needed for local dev
- Faster tests with local schemas
- Easy to mock providers

### ✅ Production Flexibility

- Switch from Neon to Supabase in minutes
- Self-hosted option with LocalTenantProvider
- Independent scaling of services

### ✅ Maintainability

- Clear separation of concerns
- Each provider is self-contained
- Easy to add new multi-tenancy strategies

---

## 📚 File Structure

```
server/
├── core/
│   ├── ServiceManager.js                    # Central orchestration
│   ├── services/
│   │   ├── tenant/
│   │   │   ├── TenantService.js            # Interface
│   │   │   └── providers/
│   │   │       ├── NeonTenantProvider.js   # Neon implementation
│   │   │       └── LocalTenantProvider.js  # Local implementation
│   │   ├── connection-pool/
│   │   │   ├── ConnectionPoolService.js    # Interface
│   │   │   └── providers/
│   │   │       └── PostgresPoolProvider.js # Postgres implementation
│   │   ├── database/
│   │   │   ├── DatabaseService.js
│   │   │   └── adapters/
│   │   │       └── PostgreSQLAdapter.js
│   │   └── logger/
│   │       ├── LoggerService.js
│   │       └── adapters/
│   │           └── ConsoleAdapter.js
│   └── __tests__/
│       └── ProviderSwitching.test.js
├── index.ts                                 # Entry point (to be minimized)
└── neon-service.ts                          # DEPRECATED (use NeonTenantProvider)

config/
└── services.js                              # Environment-specific configs
```

---

## 🚀 Deployment

### Railway (Current Setup)

```bash
# Environment Variables
TENANT_PROVIDER=neon
NEON_API_KEY=xxx
POOL_PROVIDER=postgres
DATABASE_URL=postgresql://...
```

### Self-Hosted

```bash
# Environment Variables
TENANT_PROVIDER=local
POOL_PROVIDER=postgres
DATABASE_URL=postgresql://localhost/homebase
```

### Hybrid (Auth on Railway, Tenants Self-Hosted)

```bash
# Mix and match providers
TENANT_PROVIDER=local
DATABASE_URL=postgresql://railway.../auth
```

---

## 📖 Documentation

- [Core Services Architecture](docs/CORE_SERVICES_ARCHITECTURE.md)
- [Plugin Development Guide](docs/PLUGIN_DEVELOPMENT.md)
- [Adding New Providers](docs/ADDING_PROVIDERS.md)

---

**Status**: ✅ Sprint 1 + Sprint 2 + Phase 3 Complete  
**Next**: Production deployment & monitoring  
**Date**: 2026-01-10

---

## ✅ Phase 3: Full Route Extraction (COMPLETED)

### What We Built

#### 1. Extracted Auth Routes

**Location**: `server/core/routes/auth.js`

All authentication logic moved to dedicated module:

- POST `/login` - User authentication
- POST `/logout` - Session destruction
- POST `/signup` - User registration with tenant creation
- GET `/me` - Current user info

**Benefits**:

- ✅ Clean separation of concerns
- ✅ Easy to test in isolation
- ✅ Reusable across different entry points

#### 2. Extracted Admin Routes

**Location**: `server/core/routes/admin.js`

All admin operations moved to dedicated module:

- POST `/update-role` - Change user roles
- GET `/tenants` - List all tenants
- POST `/switch-tenant` - Switch to another tenant
- DELETE `/tenants/:userId` - Delete tenant entry
- DELETE `/users/:userId` - Delete user completely

**Benefits**:

- ✅ Superuser middleware centralized
- ✅ All admin logic in one place
- ✅ Easy to add new admin features

#### 3. Minimized server/index.ts

**Before**: 659 lines  
**After**: 186 lines  
**Reduction**: 473 lines (72% smaller!)

**What remains in index.ts**:

- Express setup
- Middleware configuration
- Plugin loader initialization
- Route mounting
- Server startup

**What moved out**:

- All auth routes → `core/routes/auth.js`
- All admin routes → `core/routes/admin.js`
- Pool management → `ConnectionPoolService`
- Tenant creation → `TenantService`

---

## 📊 Final Architecture

```
server/index.ts (186 lines)
    ↓
Bootstrap.initializeServices()
    ↓
ServiceManager
    ├── TenantService (Neon/Local)
    ├── ConnectionPoolService (Postgres)
    ├── DatabaseService
    └── LoggerService
    ↓
setupCoreRoutes(app, dependencies)
    ├── /api/health → health.js
    ├── /api/auth/* → auth.js (4 routes)
    └── /api/admin/* → admin.js (5 routes)
    ↓
Plugin Loader
    └── Dynamic plugin routes
```

---

## 🎯 Complete Benefits Summary

| Metric                 | Before      | After     | Improvement       |
| ---------------------- | ----------- | --------- | ----------------- |
| **server/index.ts**    | 659 lines   | 186 lines | -72%              |
| **Manual pool code**   | 80+ lines   | 0 lines   | Removed           |
| **Hardcoded Neon**     | Yes         | No        | Provider-agnostic |
| **Route organization** | Mixed       | Separated | Clean modules     |
| **Testability**        | Hard        | Easy      | Isolated modules  |
| **Provider switching** | Manual code | Env var   | One line change   |

---

## 🚀 How to Use

### Switch Tenant Provider

```bash
# Development (local schemas)
TENANT_PROVIDER=local

# Production (Neon projects)
TENANT_PROVIDER=neon
NEON_API_KEY=your-key
```

### Switch Pool Provider

```bash
# Default Postgres pooling
POOL_PROVIDER=postgres
POOL_MAX_SIZE=10
POOL_MAX_AGE=86400000
```

### Add New Provider

1. Create `server/core/services/tenant/providers/YourProvider.js`
2. Extend `TenantService` class
3. Implement required methods
4. Set `TENANT_PROVIDER=your` in env

---

**Status**: ✅ Complete Modular Architecture Implemented  
**Date**: 2026-01-10
