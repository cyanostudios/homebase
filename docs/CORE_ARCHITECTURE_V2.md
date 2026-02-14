# Core Architecture

## Overview

Homebase core provides the foundation for all plugins through abstraction layers, security enforcement, and automated integration. This architecture enables infinite plugin scaling without core system changes.
Key Principles:

Plugin isolation - Changes in one plugin don't affect others
Security by default - Enforcement at core layer
Service abstraction - Infrastructure swappable via configuration
Zero manual integration - Plugins auto-register and coordinate

System Architecture
┌─────────────────────────────────────────┐
│ Plugin Layer (contacts, notes, etc) │
├─────────────────────────────────────────┤
│ Core Services (database, storage, etc)│
├─────────────────────────────────────────┤
│ Security Middleware (auth, CSRF, etc) │
├─────────────────────────────────────────┤
│ Service Adapters (swappable providers)│
├─────────────────────────────────────────┤
│ Infrastructure (Neon, S3, Redis, etc) │
└─────────────────────────────────────────┘

Core System Structure
client/src/core/
├── api/AppContext.tsx # Authentication + cross-plugin coordination
├── pluginRegistry.ts # Plugin registration system
├── handlers/panelHandlers.ts # Panel coordination logic
├── rendering/panelRendering.tsx # Content rendering
├── keyboard/keyboardHandlers.ts # Universal navigation
├── widgets/ # TopBar widget registry (see terminology below)
│ ├── registry.ts # registerWidget, getTopBarWidgets
│ ├── clock/ # Clock widget
│ ├── pomodoro/ # Pomodoro timer widget
│ └── time-tracking/ # Time tracking skeleton (no persistence yet)
└── ui/ # Core UI components

Terminology: **TopBar Widgets** (core/widgets) are the compact tools in the header (clock, pomodoro, time-tracking). **Dashboard Widgets** are plugin-provided blocks on the dashboard (e.g. pluginRegistry.dashboardWidget). The two are separate; TopBar widgets do not depend on the plugin registry.
├── PanelFooter.tsx
├── PanelTitles.tsx
├── UniversalPanel.tsx
└── ...

server/core/
├── ServiceManager.js # Core service orchestration
├── services/ # Service abstraction layer
│ ├── database/
│ ├── storage/
│ ├── email/
│ ├── queue/
│ ├── cache/
│ └── ...
├── middleware/ # Security middleware
│ ├── auth.js
│ ├── csrf.js
│ ├── validation.js
│ └── rateLimit.js
└── errors/ # Standardized error types
└── AppError.js

AppContext Integration
Core Responsibilities
AppContext manages only essential system-wide concerns:
typescriptinterface AppContextType {
// Authentication
user: User | null;
isAuthenticated: boolean;
login: (email: string, password: string) => Promise<boolean>;
logout: () => Promise<void>;

// Cross-plugin data (read-only)
contacts: Contact[];
notes: Note[];

// Panel coordination
closeOtherPanels: (except?: string) => void;
registerPanelCloseFunction: (pluginName: string, fn: () => void) => void;
unregisterPanelCloseFunction: (pluginName: string) => void;

// Cross-plugin references
getNotesForContact: (contactId: string) => Promise<Note[]>;
getContactsForNote: (noteId: string) => Contact[];
getEstimatesForContact: (contactId: string) => Promise<Estimate[]>;
getTasksForContact: (contactId: string) => Promise<Task[]>;
getTasksWithMentionsForContact: (contactId: string) => Promise<Task[]>;

// Optional plugin navigation (set by plugins when mounted; used by e.g. ContactView)
openNoteForView: ((note: Note) => void) | undefined;
openTaskForView: ((task: Task) => void) | undefined;
openEstimateForView: ((estimate: Estimate) => void) | undefined;
registerNotesNavigation: (fn: ((note: Note) => void) | null) => void;
registerTasksNavigation: (fn: ((task: Task) => void) | null) => void;
registerEstimatesNavigation: (fn: ((estimate: Estimate) => void) | null) => void;

// Data refresh
refreshData: () => Promise<void>;
}

```

**Plugin-aware data loading:** `loadData()` only fetches API data for plugins present in `user.plugins` (contacts, notes, tasks); otherwise empty arrays are used. The getters `getNotesForContact`, `getTasksForContact`, `getTasksWithMentionsForContact`, and `getEstimatesForContact` return empty arrays when the corresponding plugin is not enabled for the user, so cross-plugin views never call APIs for disabled plugins.

**Navigation registration:** Plugins (notes, tasks, estimates) register their "open for view" function with AppContext via `registerNotesNavigation`, `registerTasksNavigation`, and `registerEstimatesNavigation` in a `useEffect`. Use a stable callback (e.g. a ref bridge) so that registration does not trigger setState during render and avoids React warnings. See [PLUGIN_ARCHITECTURE_V3.md](PLUGIN_ARCHITECTURE_V3.md) (Plugin independence).

What AppContext does NOT do:

Plugin-specific business logic
Direct database operations (uses ServiceManager)
File operations (uses StorageService)
Email sending (uses EmailService)

Plugin Registration System
Registry Structure
client/src/core/pluginRegistry.ts:
typescriptexport interface PluginRegistryEntry {
name: string; // Plugin identifier (plural!)
Provider: React.ComponentType<{
children: React.ReactNode;
isAuthenticated: boolean;
onCloseOtherPanels: () => void;
}>;
hook: () => any; // Plugin context hook
panelKey: string; // Panel state key
components: {
List: React.ComponentType;
Form: React.ComponentType<any>;
View: React.ComponentType<any>;
};
}

export const PLUGIN_REGISTRY: PluginRegistryEntry[] = [
{
name: 'contacts',
Provider: ContactProvider,
hook: useContacts,
panelKey: 'isContactPanelOpen',
components: { List: ContactList, Form: ContactForm, View: ContactView }
},
// ... other plugins
];
Dynamic Plugin Loading
App.tsx automatically loads all registered plugins:
typescriptfunction PluginProviders({ children }: { children: React.ReactNode }) {
const { isAuthenticated, closeOtherPanels } = useApp();

return PLUGIN_REGISTRY.reduceRight((acc, plugin) => {
const { Provider, name } = plugin;
return (
<Provider
isAuthenticated={isAuthenticated}
onCloseOtherPanels={() => closeOtherPanels(name)} >
{acc}
</Provider>
);
}, children);
}
Benefits:

Add plugin to registry → automatically loaded
No manual App.tsx changes
Plugins can't interfere with each other
Load order handled automatically

Service Manager Architecture
Central Service Orchestration
server/core/ServiceManager.js:
class ServiceManager {
constructor(config) {
this.services = {
database: this.initService('database', config),
storage: this.initService('storage', config),
email: this.initService('email', config),
queue: this.initService('queue', config),
cache: this.initService('cache', config),
realtime: this.initService('realtime', config),
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

override(serviceName, adapter) {
this.services[serviceName] = adapter;
}
}

module.exports = new ServiceManager(require('../config/services'));
Usage in plugins:
const ServiceManager = require('../../server/core/ServiceManager');
const database = ServiceManager.get('database');
const storage = ServiceManager.get('storage');
const logger = ServiceManager.get('logger');

Security Middleware Stack
Authentication Middleware
// server/core/middleware/auth.js
function requireAuth() {
return (req, res, next) => {
if (!req.session || !req.session.user) {
return res.status(401).json({ error: 'Authentication required' });
}
next();
};
}

function requirePlugin(pluginName) {
return (req, res, next) => {
if (!req.session.user) {
return res.status(401).json({ error: 'Authentication required' });
}

    if (!req.session.user.plugins.includes(pluginName)) {
      return res.status(403).json({ error: 'Plugin access denied' });
    }

    next();

};
}
CSRF Protection
// server/core/middleware/csrf.js
const csrf = require('csurf');

const csrfProtection = csrf({ cookie: true });

// Provide token endpoint
app.get('/api/csrf-token', csrfProtection, (req, res) => {
res.json({ csrfToken: req.csrfToken() });
});
Rate Limiting
// server/core/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
windowMs: 15 _ 60 _ 1000, // 15 minutes
max: 100,
message: 'Too many requests'
});

const strictLimiter = rateLimit({
windowMs: 60 \* 1000, // 1 minute
max: 5
});
Input Validation
// server/core/middleware/validation.js
const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
const errors = validationResult(req);
if (!errors.isEmpty()) {
return res.status(400).json({
error: 'Validation failed',
details: errors.array()
});
}
next();
}

Modular Handler System
Panel Handlers
client/src/core/handlers/panelHandlers.ts:

handleDeleteItem() - Delete confirmation logic
handleSave() - Universal save handler
handleCancel() - Cancel/back navigation
getCloseHandler() - Smart close (view vs form)

Benefits:

Centralized panel logic
Consistent behavior across plugins
Easy to maintain
Security checks in one place

Keyboard Handlers
client/src/core/keyboard/keyboardHandlers.ts:

Space key: Open/close panels
Arrow keys: Navigate table rows
Tab: Focus management
Input protection: Don't interfere with forms

Implementation:
typescriptexport function createKeyboardHandler(pluginContexts: any[]) {
return (e: KeyboardEvent) => {
// Don't interfere with input fields
if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
return;
}

    if (e.code === 'Space') {
      e.preventDefault();
      handleSpaceKey(pluginContexts);
    }

    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      handleArrowKeys(e.code);
    }

};
}

Cross-Plugin Features
@Mentions System
Notes and tasks can reference contacts via @mentions. All mention input and display logic lives in **core**; plugins use core components only. See [MENTIONS_AND_CROSS_PLUGIN_UI.md](MENTIONS_AND_CROSS_PLUGIN_UI.md) for the full reference.

- **Core components:** `MentionTextarea` (form input with @-trigger and dropdown) and `MentionContent` (view with clickable/grayed mentions). Both live under `client/src/core/ui/` and use the shared type from `client/src/core/types/mention.ts`.
- **AppContext** provides `getNotesForContact(contactId)` and `getTasksWithMentionsForContact(contactId)` so ContactView can show "Note mentions" and "Task mentions". Comparisons use `String(mention.contactId) === String(contactId)` to avoid type mismatches between API and state.
- **ContactView** does not import useNotes, useTasks, or useEstimates. It uses only `useApp()` and shows Note/Task/Estimate sections only when both data (e.g. `mentionedInNotes.length > 0`) and the corresponding capability (e.g. `openNoteForView`) exist.

Contact References
Estimates link to contacts:
typescript// AppContext fetches fresh estimate data
getEstimatesForContact: async (contactId: string) => Promise<Estimate[]>

// ContactView shows related estimates
const relatedEstimates = await getEstimatesForContact(contact.id);
Cross-Plugin Navigation
typescript// In ContactView - navigate to estimate
const handleEstimateClick = (estimate) => {
closeContactPanel(); // Close current panel
openEstimateForView(estimate); // Open target panel
};

Universal Panel System
Panel Coordination
Only one panel can be open at a time:
typescript// When opening any panel
onCloseOtherPanels(); // Close all other plugin panels
setIsMyPluginPanelOpen(true); // Open this plugin's panel
Panel Registration:
typescript// In plugin context
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
return () => unregisterPanelCloseFunction('my-plugins');
}, []); // Empty dependency array critical
Smart Close Behavior
typescriptconst getCloseHandler = () => {
if (currentMode === 'view') {
return handleClosePanel; // Direct close
} else {
return handleCancelClick; // Check unsaved changes
}
};
Global Form Functions
Forms integrate with UniversalPanel footer:
typescript// Each plugin registers global functions (plural naming!)
window.submitMyPluginsForm = handleSubmit;
window.cancelMyPluginsForm = handleCancel;

// App.tsx calls these from panel footer
const handleSaveClick = () => {
const submitFunction = window[`submit${currentPlugin.name}Form`];
if (submitFunction) submitFunction();
};

Tenant Isolation
Automatic Isolation
Core database service automatically enforces tenant boundaries:
// Plugin queries without tenant awareness
const contacts = await database.query('SELECT \* FROM contacts WHERE id = ?', [contactId]);

// Core automatically adds: AND user_id = current_user_id
Implementation in DatabaseAdapter:
class DatabaseAdapter {
async query(sql, params, context) {
// Add tenant filter automatically
const modifiedSQL = this.addTenantFilter(sql, context.userId);
return this.pool.query(modifiedSQL, [...params, context.userId]);
}

addTenantFilter(sql, userId) {
// Parse SQL and inject WHERE user_id = ?
// Or use Row-Level Security in PostgreSQL
}
}
Multi-Tenant Architecture
Current implementation:

Railway PostgreSQL: Central authentication + tenant mapping
Neon PostgreSQL: Individual databases per tenant
Complete data isolation
Automatic migrations per tenant database

Performance Optimizations
Context Isolation
Each plugin manages its own state independently:
typescript// Before (Single Context)
AppContext changes → ALL components re-render

// After (Modular Contexts)
ContactContext changes → ONLY contact components re-render
NoteContext changes → ONLY note components re-render
Result: 90% reduction in unnecessary re-renders
Stable Function References
AppContext functions use useCallback to prevent re-renders:
typescriptconst registerPanelCloseFunction = useCallback(
(pluginName: string, closeFunction: () => void) => {
setPanelCloseFunctions(prev => {
const newMap = new Map(prev);
newMap.set(pluginName, closeFunction);
return newMap;
});
},
[] // Empty dependency array for stability
);
Caching Strategy
Core cache service provides standardized caching:
const cache = ServiceManager.get('cache');

// Automatic cache with fallback
const contacts = await cache.wrap('contacts:list', async () => {
return await database.query('SELECT \* FROM contacts', []);
}, 300); // Cache for 5 minutes

Error Handling
Standardized Error Types
server/core/errors/AppError.js:
class AppError extends Error {
constructor(message, statusCode, code) {
super(message);
this.statusCode = statusCode;
this.code = code;
this.isOperational = true;
}
}

// Usage
throw new AppError('Contact not found', 404, 'NOT_FOUND');
throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
Error Handling Middleware
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

```

---

## Plugin Development Workflow

### Backend Plugin

**Structure:**

```

plugins/my-plugin/
├── plugin.config.js # Metadata
├── model.js # Business logic (uses ServiceManager)
├── controller.js # Request handling
├── routes.js # Express routes (with security middleware)
└── index.js # Initialization

```

**Development steps:**

1. Copy template structure
2. Configure plugin metadata
3. Implement model using core services
4. Add security middleware to routes
5. Register in plugin system

### Frontend Plugin

**Structure:**

```

client/src/plugins/my-plugin/
├── types/ # TypeScript interfaces
├── context/ # State management
├── hooks/ # Plugin hook
├── api/ # API calls (with CSRF)
└── components/ # React components
Development steps:

Define TypeScript types
Create API layer with CSRF
Implement context with panel registration
Build responsive components
Register in pluginRegistry.ts

Result: Zero manual core file updates needed

Testing Strategy
Mock Adapters for Testing
const MockDatabaseAdapter = require('./core/services/database/adapters/MockAdapter');

describe('Plugin Tests', () => {
beforeEach(() => {
ServiceManager.override('database', new MockDatabaseAdapter());
});

it('should work with mock database', async () => {
const result = await database.query('SELECT \* FROM items', []);
expect(result).toBeDefined();
});
});
Benefits:

Fast tests (no external dependencies)
Deterministic (no network issues)
Isolated (no shared state)

Mobile-First Responsive Design
All components adapt to screen size:
typescriptconst [isMobileView, setIsMobileView] = useState(false);

useEffect(() => {
const checkScreenSize = () => setIsMobileView(window.innerWidth < 768);
checkScreenSize();
window.addEventListener('resize', checkScreenSize);
return () => window.removeEventListener('resize', checkScreenSize);
}, []);

// Render different layouts based on isMobileView
return isMobileView ? <MobileLayout /> : <DesktopLayout />;

Debugging and Monitoring
Console Logging
Core system includes debug logging:
console.log('closeOtherPanels called, except:', except);
console.log('Available close functions:', Array.from(panelCloseFunctions.keys()));
console.log(`Closing panel for plugin: ${pluginName}`);
Structured Logging
Use logging service for production:
const logger = ServiceManager.get('logger');

logger.info('Operation completed', { userId, itemId });
logger.warn('Deprecated feature used', { feature, userId });
logger.error('Operation failed', error, { context });

Configuration Management
Service Configuration
config/services.js:
module.exports = {
// Service providers (swappable)
DATABASE_PROVIDER: process.env.DB_PROVIDER || 'neon',
STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'r2',
EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend',

// Provider-specific config
database: {
neon: {
connectionString: process.env.DATABASE_URL
}
},
storage: {
r2: {
accountId: process.env.R2_ACCOUNT_ID,
accessKey: process.env.R2_ACCESS_KEY,
bucket: process.env.R2_BUCKET
}
}
};
Change one line → entire infrastructure layer switches

Extension Points
Adding New Core Services

Define service interface
Create adapter(s)
Register in ServiceManager
Add to configuration
Use in plugins

Example - SMS Service:
// 1. Define interface
class SMSService {
async send(to, message) {
throw new Error('Not implemented');
}
}

// 2. Create adapter
class TwilioAdapter extends SMSService {
async send(to, message) {
// Implementation
}
}

// 3. Register in ServiceManager
this.services.sms = this.initService('sms', config);

// 4. Configure
SMS_PROVIDER: 'twilio'

// 5. Use in plugins
const sms = ServiceManager.get('sms');
await sms.send('+46701234567', 'Message');

Architecture Benefits
For Plugin Developers

✅ Focus on business logic, not infrastructure
✅ Security enforced automatically
✅ Testing simplified with mocks
✅ Cross-plugin features work automatically
✅ No manual core updates needed

For System Maintainers

✅ Infrastructure swappable via config
✅ Security centralized and consistent
✅ New plugins don't affect existing code
✅ Performance optimized through isolation
✅ Monitoring and logging standardized

For End Users

✅ Consistent UI/UX across all plugins
✅ Keyboard navigation works everywhere
✅ Mobile-responsive by default
✅ Fast performance (optimized re-renders)
✅ Secure by default

Common Integration Issues
Infinite Re-renders
Cause: Wrong dependencies in useEffect
Fix: Use empty dependency arrays for registration
typescript// ❌ WRONG - Causes infinite loops
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
}, [closeMyPluginPanel]);

// ✅ CORRECT - Empty dependency array
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
return () => unregisterPanelCloseFunction('my-plugins');
}, []);
Panel Coordination Problems
Cause: Missing registration or wrong naming
Fix: Verify registerPanelCloseFunction calls match plugin name
Cross-Plugin Features Broken
Cause: Missing AppContext functions
Fix: Ensure all cross-plugin functions exported from AppContext

Migration Path
From Direct Infrastructure to Core Services
Before:
const db = require('../../server/database');
const results = await db.query('SELECT _ FROM contacts WHERE user_id = ?', [userId]);
After:
const database = ServiceManager.get('database');
const results = await database.query('SELECT _ FROM contacts', []);
// Tenant filtering automatic

```

**Benefits:**

- Infrastructure swappable
- Security enforced
- Testing simplified
- Tenant isolation automatic

---

## Core Implementation Details

### Middleware måste registreras i server/index.ts

❌ **FEL:**

```javascript
// Skapade middleware i server/core/middleware/activityLog.js
// Registrerade den i server/core/middleware/setup.js
// Men server/index.ts använder INTE setupMiddleware() - den registrerar middleware direkt!
// Resultat: Middleware kördes aldrig, inga logs skapades
```

✅ **KORREKT:**

```javascript
// server/index.ts
const { activityLogMiddleware } = require('./core/middleware/activityLog');

// Global rate limiting
app.use('/api', globalLimiter);

// Activity log middleware (after rate limiting, before routes)
app.use(activityLogMiddleware);

// Setup core routes
setupCoreRoutes(app, { pool, authLimiter, requireAuth, pluginLoader });
```

💡 **Lärdom:** `server/index.ts` registrerar middleware direkt, inte via `setupMiddleware()`. När du skapar ny middleware, måste den registreras i `server/index.ts` också, inte bara i `setup.js`.

---

### Activity Log: DELETE requests kräver entity name FÖRE deletion

❌ **FEL:**

```javascript
// Försökte hämta entity name från response efter DELETE
res.json({ message: 'Note deleted successfully' }); // ❌ Inget entity name här!
const entityName = extractEntityName(data, entityType); // ❌ null
```

✅ **KORREKT:**

```javascript
// För DELETE, hämta entity name FÖRE deletion med async closure
const getEntityNameForDelete = (() => {
  let promise = null;
  if (action === 'delete' && entityId && req.tenantPool) {
    promise = req.tenantPool
      .query('SELECT title FROM notes WHERE id = $1', [entityId])
      .then((result) => {
        return result.rows[0]?.title || null;
      });
  }
  return () => promise || Promise.resolve(null);
})();

// I res.on('finish'), vänta på promise
if (action === 'delete') {
  getEntityNameForDelete().then((entityName) => {
    activityLogService.logActivity(req, action, entityType, entityId, entityName, {});
  });
  return;
}
```

💡 **Lärdom:** DELETE responses innehåller bara `{ message: "Deleted successfully" }` - inget entity name. För att logga vad som raderades måste vi hämta namnet FÖRE deletion.

---

### Activity Log: CREATE requests måste hämta entity ID från response

❌ **FEL:**

```javascript
// För POST /api/notes finns inget ID i URL
const entityId = extractEntityId(req.path); // ❌ null för POST
// Loggar utan ID, vilket gör det svårt att spåra vad som skapades
```

✅ **KORREKT:**

```javascript
// I res.on('finish'), hämta ID från response om det saknas
if (!entityId && data && data.id) {
  entityId = data.id; // ✅ Hämta från response för CREATE
}

activityLogService.logActivity(req, action, entityType, entityId, entityName, metadata);
```

💡 **Lärdom:** POST requests har inget ID i URL (t.ex. `POST /api/notes`). Men response innehåller det skapade objektet med ID. För att logga korrekt måste vi hämta ID från response för CREATE-actions.

---

### Activity log tabeller måste skapas per tenant via migration

❌ **FEL:**

```javascript
// Skapade migration i server/migrations/006-activity-log.sql
// Men körde aldrig migrationen på tenant-databaser
// Resultat: Tabellen fanns inte, alla INSERT queries misslyckades tyst
```

✅ **KORREKT:**

```bash
# Kör migration på alla tenant-databaser
npm run migrate:activity-log

# Scriptet hittar alla tenants och kör migrationen på varje
# För LocalTenantProvider: använder schema-per-tenant
# För NeonTenantProvider: använder database-per-tenant
```

💡 **Lärdom:** Activity log tabellen måste finnas i VARJE tenant-databas (eller schema), inte bara i main-databasen. Eftersom varje tenant har sin egen databas/schema måste migrationen köras på alla.

---

### PostgreSQLAdapter.\_addTenantFilter() måste hantera RETURNING-klausuler korrekt

❌ **FEL:**

```javascript
// _addTenantFilter() lade till user_id filter EFTER RETURNING
// DELETE FROM notes WHERE id = ANY($1::int[]) RETURNING id AND user_id = $2
// ❌ SQL syntax error: "argument of AND must be type boolean, not type integer"
```

✅ **KORREKT:**

```javascript
// server/core/services/database/adapters/PostgreSQLAdapter.js
_addTenantFilter(sql, userId) {
  const upperSql = sql.trim().toUpperCase();

  if (upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) {
    const whereIndex = upperSql.indexOf('WHERE');
    if (whereIndex === -1) {
      return `${sql} WHERE user_id = $${this._getParamCount(sql) + 1}`;
    } else {
      if (!upperSql.includes('USER_ID')) {
        // ✅ KORREKT: Hitta RETURNING i original SQL (inte upperSql) för korrekt position
        const returningIndex = sql.toUpperCase().indexOf('RETURNING');
        if (returningIndex !== -1) {
          // ✅ Infoga user_id filter FÖRE RETURNING
          const beforeReturning = sql.substring(0, returningIndex).trim();
          const returningClause = sql.substring(returningIndex);
          const paramNum = this._getParamCount(sql) + 1;
          return `${beforeReturning} AND user_id = $${paramNum} ${returningClause}`;
        } else {
          return `${sql} AND user_id = $${this._getParamCount(sql) + 1}`;
        }
      }
    }
  }
  return sql;
}
```

💡 **Lärdom:** PostgreSQLAdapter lägger automatiskt till `user_id` filter för tenant isolation på alla UPDATE/DELETE queries. Men när SQL innehåller `RETURNING`-klausul måste `user_id`-filtret infogas FÖRE `RETURNING`, inte efter.

**Viktiga detaljer:**

1. Använd `sql.toUpperCase().indexOf('RETURNING')` (inte `upperSql.indexOf()`) för att hitta korrekt position i original SQL-strängen
2. Infoga `AND user_id = $N` FÖRE `RETURNING`, inte efter
3. Behåll `RETURNING`-klausulen oförändrad efter filtret

---

### Debug logging är kritisk för middleware-felsökning

❌ **FEL:**

```javascript
// Middleware kördes tyst, inga logs
// Kunde inte se om den kördes, om den hoppade över requests, eller om den misslyckades
```

✅ **KORREKT:**

```javascript
// Lägg till omfattande debug logging
console.log('[ActivityLog Middleware] Request:', req.method, req.path, {
  hasSession: !!req.session,
  hasUserId: !!req.session?.user?.id,
});

console.log('[ActivityLog Middleware] Will log:', { action, entityType });

console.log('[ActivityLogService] logActivity called:', { action, entityType, entityId });

// I error handling
console.error('[ActivityLogService] ❌ Failed:', {
  message: error.message,
  code: error.code,
  table: error.table, // Viktigt för att se om tabellen saknas
});
```

💡 **Lärdom:** Middleware körs asynkront och kan misslyckas tyst. Utan debug logging är det omöjligt att veta om middleware körs, om den hoppar över requests, eller var den misslyckas. Lägg ALLTID till omfattande debug logging när du skapar middleware.

---

## Conclusion

Homebase core architecture provides:

- **Service Abstraction** - Infrastructure swappable via configuration
- **Security Enforcement** - Multiple layers of protection
- **Plugin Isolation** - Zero conflicts between plugins
- **Automated Integration** - No manual core updates
- **Performance Optimization** - 90% reduction in unnecessary re-renders
- **Developer Experience** - Focus on business logic, not infrastructure

**Result:** Scalable, secure, maintainable plugin platform.

---

**See Also:**

- `CORE_SERVICES_ARCHITECTURE.md` - Service details
- `SECURITY_GUIDELINES.md` - Security layers
- `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` - Plugin conventions
- `BACKEND_PLUGIN_GUIDE_V2.md` - Backend implementation
- `FRONTEND_PLUGIN_GUIDE_V2.md` - Frontend implementation

```

```
