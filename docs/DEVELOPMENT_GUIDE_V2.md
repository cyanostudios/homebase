# Development Guide

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
├── vite.config.ts          # Vite (UI build + optional bundle analyzer)
├── package.json            # Single root package (engines: Node >=22.18 <23)
├── client/
│   ├── index.html
│   └── src/
│       ├── core/           # apiFetch, createApiClient, AppContext, pluginRegistry, app/
│       ├── plugins/        # Frontend plugins
│       └── App.tsx         # Renders AppRoutes
├── server/
│   ├── index.ts            # Express entry (prod serves dist/public)
│   └── core/               # ServiceManager, middleware, migrations
├── plugin-loader.js        # Backend plugin discovery (repo root)
├── plugins/                # Backend plugins (model, routes, index.js)
├── config/services.js      # Legacy/env config (see CORE_SERVICES_ARCHITECTURE)
└── docs/
```

**Key points:** one `package.json`, configs at repo root, backend plugins under `plugins/`, frontend under `client/src/plugins/`.

---

## Development Environment Setup

### Prerequisites

- **Node.js** `>=22.18 <23` (see `package.json` → `engines`)
- **PostgreSQL** (local or Neon for dev)
- **Git**

### Installation

```bash
git clone [repository-url] homebase
cd homebase
npm install
node scripts/setup-database.js
cp .env.example .env.local
# Edit DATABASE_URL, SESSION_SECRET, TENANT_PROVIDER, etc.
```

### Environment variables (essentials)

```bash
# Main DB (users, sessions, tenants)
DATABASE_URL=postgresql://user:password@localhost:5432/homebase_dev
SESSION_SECRET=your-secret-key-here

# Tenant resolution (dev often local; prod neon)
TENANT_PROVIDER=local   # or neon + NEON_API_KEY

# Optional: CSRF in dev
ENABLE_CSRF=true

# Files / cups images (prod)
# R2_* — see .env.example
```

Runtime services exposed via `ServiceManager`: see **`CORE_SERVICES_ARCHITECTURE.md`** (not a full storage/email/queue matrix).

### Running the application

```bash
# Both API + UI
npm run dev:all

# Or separate terminals (from repo root)
npm run dev:api   # http://localhost:3002
npm run dev:ui    # http://localhost:3001
```

```bash
curl http://localhost:3002/api/health
curl http://localhost:3002/api/plugins
```

### Quality checks

```bash
npm run check          # tsc
npm run lint           # eslint (flat config: eslint.config.cjs)
npm test               # jest (server/plugins tests)
npm run build          # production UI + API
```

Pre-commit: **lint-staged** runs `eslint --fix --quiet` and Prettier on staged TS/TSX. Pre-push (husky): `tsc` + `jest`.

---

## Cups: import från SvFF-sidor (HTML/PDF)

- **Kod:** `plugins/cups/services/parseCupSource.js` – `parseCupSource({ html, sourceUrl, sourceType })` returnerar normaliserade cup-rader; `detectCupSourceProfile` väljer vilken parser som ska köras (tabell, accordion, år+månad-lista, PDF, m.m.).
- **Östergötland _Sanktionerade cuper_:** profil `svff_yearmonth_list` när värd är `ostergotland.svenskfotboll.se` och sidan innehåller rubriken _Sanktionerade cuper_; **Futsal**-rader importeras inte.
- **Historik och full profil-lista:** `docs/CHANGELOG.md` (§ **2026-04 – Cups: SvFF-import**).
- **Publik cup-sajt:** katalogen `public-cups/` (statisk frontend + `api/cups.php`); listning bygger på API som bara exponerar **synliga** cuper (`visible`). Se samma changelog-avsnitt.

---

## Plugin Development Workflow

### Creating a New Plugin

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

# 2. Create API layer (createApiClient + apiFetch for CSRF)

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
I nuvarande kodbas startas servern från `server/index.ts` och det finns ingen separat `server/app`-export att importera i Supertest.

✅ Rekommenderat:

- **Unit/service-tester** med mock adapters (snabbt och stabilt).
- **Integration via körande server**: starta `npm run dev:api` och testa endpoints via HTTP.

Om ni vill ha Supertest-baserade request-tester:

- Introducera en `createApp()`-factory som returnerar Express-app utan `listen()`.
- Låt `server/index.ts` använda den, och låt tester importera `createApp()`.

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

DEBUG=\* npm run dev

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
Bundle analysis (where JS weight comes from):

```bash
npm run build:ui:analyze
```

Opens no browser automatically; open generated `bundle-stats.html` at repo root. See `docs/FRONTEND_BUNDLE_ANALYSIS.md`.

Code Splitting:
// Lazy load plugin components
const MyPluginList = React.lazy(() => import('./components/MyPluginList'));
Caching:
// Use cache service for expensive queries
const cache = ServiceManager.get('cache');
const items = await cache.wrap('my-plugin:items', async () => {
return await database.query('SELECT _ FROM items', []);
}, 300);
Pagination:
// Limit query results
const items = await database.query(
'SELECT _ FROM items ORDER BY created_at DESC LIMIT ? OFFSET ?',
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
max: 20, // Maximum connections
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

## Development Workflow

### npm run dev startar BARA backend per default

❌ **FEL:**
Körde `npm run dev` och trodde att både backend och frontend skulle starta.

✅ **KORREKT:**

```bash
# Antingen separata terminals:
npm run dev:api  # Backend (port 3002)
npm run dev:ui   # Frontend (port 3001)

# Eller allt i en terminal:
npm run dev:all  # Båda samtidigt med concurrently
```

💡 **Lärdom:** `npm run dev` kör bara `dev:api`, inte frontend. Frontend måste startas separat med `npm run dev:ui`, eller använd `npm run dev:all` för båda.

---

### Login fungerar men UI visar inte - kolla båda servrarna

❌ **FEL:**
Backend fungerar (login returnerar 200) men frontend visar inte inloggningsskärmen eller data.

✅ **KORREKT:**

```bash
# Kolla om båda servrar körs:
lsof -i:3001  # Frontend (Vite)
lsof -i:3002  # Backend (Express)

# Starta båda:
npm run dev:all  # Eller i separata terminals:
npm run dev:api  # Backend
npm run dev:ui   # Frontend
```

💡 **Lärdom:** Vanliga orsaker: 1) Frontend körs inte - `npm run dev` startar bara backend, 2) Port-konflikt - Frontend ska vara på port 3001, backend på 3002, 3) Browser cache - Hårda refresh krävs (Cmd+Shift+R).

---

### @homebase/core måste finnas i dependencies för att plugins ska ladda

❌ **FEL:**
Backend kraschade med "Cannot find module '@homebase/core'" när plugins försökte ladda.

✅ **KORREKT:**

```json
// package.json
{
  "dependencies": {
    "@homebase/core": "file:packages/core"
    // ...
  }
}
```

```bash
npm install  # Installerar lokal dependency
```

💡 **Lärdom:** Plugins använder `require('@homebase/core')` men paketet måste vara installerat som dependency, även om det är ett lokalt paket. Efter att ha lagt till dependency måste `npm install` köras.

---

### Git commit kräver att ESLint/Prettier passerar INNAN commit

❌ **FEL:**

```bash
# Försöker committa direkt utan att fixa ESLint-fel först
git add -A
git commit -m "feat: add new feature"
# ❌ FAILED: husky - pre-commit script failed (code 1)
# ESLint hittade 20 warnings/errors som måste fixas
```

✅ **KORREKT:**

```bash
# 1. KÖR ESLint FÖRST för att se vad som behöver fixas
npm run lint
# Eller för att auto-fixa så mycket som möjligt:
npm run lint -- --fix

# 2. Kolla att inga fel kvarstår
npm run lint

# 3. FÖRST DÅ - committa (husky hooks kommer att passera)
git add -A
git commit -m "feat: add new feature"
# ✅ Success - lint-staged kör ESLint igen men hittar inga fel

# 4. Push
git push
```

💡 **Lärdom:** Projektet använder **husky pre-commit hooks** med **lint-staged** som automatiskt kör ESLint och Prettier på staged filer före varje commit. Om ESLint hittar fel (warnings eller errors) stoppas commit-processen. **Kör alltid `npm run lint` eller `npx lint-staged` INNAN du committar**, fixa alla fel, och committa igen. I `package.json` använder lint-staged `eslint --fix --quiet --no-warn-ignored` (endast **errors** stoppar commit; `@typescript-eslint/no-explicit-any` är **warn** i `eslint.config.cjs`).

---

### Nya tabeller kräver att setup-database.js körs

❌ **FEL:**
Lade till `user_settings`-tabellen i `scripts/setup-database.js` men körde INTE scriptet.

✅ **KORREKT:**

```bash
# Kör setup-database.js för att skapa alla tabeller
node scripts/setup-database.js

# Verifiera att tabellen skapades
psql $DATABASE_URL -c "\dt" | grep user_settings
```

💡 **Lärdom:** När du lägger till nya tabeller i setup-database.js, måste du **ALLTID** köra scriptet för att uppdatera databasen. Bara att ändra koden räcker inte! Om du ser "relation does not exist" fel → tabellen finns inte i databasen.

---

### AUTH-databas vs TENANT-databas - viktigt!

❌ **FEL:**
Försökte skapa plugin-tabeller (invoices, user_files) i AUTH-databasen via setup-database.js.

✅ **KORREKT:**

```bash
# AUTH-databas tabeller (DATABASE_URL):
# - users, sessions, tenants, user_plugin_access, user_settings

# TENANT-databas tabeller (per tenant/user):
# - contacts, notes, tasks, estimates, invoices, user_files

# För att skapa tenant-tabeller, använd migrations i server/migrations/
```

💡 **Lärdom:** Det finns TVÅ databaser: AUTH-databas (users, sessions, tenants) och TENANT-databas (contacts, notes, tasks, etc.). `setup-database.js` skapar tabeller i AUTH-databasen. Plugin-tabeller behöver finnas i TENANT-databasen. Core settings (user_settings) → AUTH-databas. Plugin data (invoices, files) → TENANT-databas.

---

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
REFACTORING_EXISTING_PLUGINS.md - Migrera/refaktorera plugins
UI_AND_UX_STANDARDS_V3.md - UI/UX standards
CHANGELOG.md - Historik över ändringar

```

```
