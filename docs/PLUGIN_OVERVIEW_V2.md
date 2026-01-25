# Plugin Development Overview

## Quick Start

Create complete plugins with CRUD functionality, responsive UI, and keyboard navigation using the fully automated plugin system with security enforcement and service abstraction.

## Key Features

- Core services for all infrastructure (ServiceManager)
- Security middleware on all routes
- CSRF token handling
- Standardized error handling
- Mock adapters for testing
- Plugin SDK (@homebase/core) for stable interfaces

Plugin Development Workflow

1. Backend Plugin
   Copy template:
   cp -r templates/plugin-backend-template plugins/my-plugin
   Configure:
   // plugin.config.js
   module.exports = {
   name: 'my-plugin',
   routeBase: '/api/my-plugin',
   requiredRole: 'user',
   security: {
   rateLimits: {
   global: { windowMs: 15 _ 60 _ 1000, max: 100 }
   }
   }
   };
   Implement model using core services:
   const ServiceManager = require('../../server/core/ServiceManager');
   const database = ServiceManager.get('database');
   const logger = ServiceManager.get('logger');

class MyPluginModel {
async createItem(itemData) {
const result = await database.insert('my_plugin_items', itemData);
logger.info('Item created', { itemId: result.id });
return result;
}
}
Add security to routes:
router.post('/',
requirePlugin('my-plugin'),
csrfProtection,
[
body('title').trim().notEmpty().escape(),
validateRequest
],
controller.createItem
);

2. Frontend Plugin
   Copy template:
   cp -r templates/plugin-frontend-template client/src/plugins/my-plugin
   Create API layer with CSRF:
   class MyPluginApi {
   async getCsrfToken() {
   const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());
   return csrfToken;
   }

async createItem(data) {
return this.request('', {
method: 'POST',
headers: {
'X-CSRF-Token': await this.getCsrfToken()
},
body: JSON.stringify(data)
});
}
}
Implement context with security:
export function MyPluginProvider({ children, isAuthenticated, onCloseOtherPanels }) {
const { registerPanelCloseFunction, unregisterPanelCloseFunction } = useApp();

// Register panel close function
useEffect(() => {
registerPanelCloseFunction('my-plugins', closeMyPluginPanel);
return () => unregisterPanelCloseFunction('my-plugins');
}, []);

// Register global form functions
useEffect(() => {
window.submitMyPluginsForm = handleSubmit;
window.cancelMyPluginsForm = handleCancel;
return () => {
delete window.submitMyPluginsForm;
delete window.cancelMyPluginsForm;
};
}, []);
}

3. UI Components
List component with keyboard navigation:
 <tr
  tabIndex={0}
  data-list-item={JSON.stringify(item)}
  data-plugin-name="my-plugins"
  onClick={() => openMyPluginForView(item)}
  className="hover:bg-blue-50 focus:outline-none cursor-pointer"
>
Form component with validation:
 const MyPluginForm = ({ onSave, onCancel }) => {
  const { validationErrors, clearValidationErrors } = useMyPlugin();

const handleSave = async () => {
clearValidationErrors();
const success = await onSave(formData);
if (!success) {
// Validation errors displayed automatically
}
};
}

4. Registration
   Add to plugin registry:
   // client/src/core/pluginRegistry.ts
   {
   name: 'my-plugins',
   Provider: MyPluginProvider,
   hook: useMyPlugins,
   panelKey: 'isMyPluginPanelOpen',
   components: {
   List: MyPluginList,
   Form: MyPluginForm,
   View: MyPluginView
   },
   navigation: { // REQUIRED for sidebar visibility
   category: 'Main', // or 'Business', 'Tools', etc.
   label: 'My Plugins',
   icon: MyIcon, // Import from lucide-react
   order: 1, // Order within category
   }
   }

   ⚠️ IMPORTANT: After registering a plugin:

   a) Plugin discovery:
   // server/core/config/constants.js
   ✅ AUTOMATED: Plugins are automatically discovered from the filesystem.
   - Only directories with plugin.config.js are included
   - Plugins are validated before being added to available list
   - Some plugins (e.g., read-only like profixio) are excluded from DEFAULT_USER_PLUGINS
     No manual update required in constants.js.

   b) Grant access to superadmin:
   // Run script to add plugin to admin@homebase.se
   // Or manually: INSERT INTO user_plugin_access (user_id, plugin_name, enabled)
   // VALUES ((SELECT id FROM users WHERE email = 'admin@homebase.se'), 'my-plugins', true);

   c) The plugin will automatically appear in sidebar for users who have it enabled

5. Testing
   Backend tests with mock adapters:
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
Frontend tests:
describe('My Plugin Context', () => {
it('should handle CSRF token', async () => {
const api = new MyPluginApi();
const token = await api.getCsrfToken();
expect(token).toBeDefined();
});
});

Automated Benefits
Zero Manual Core File Updates
When conventions are followed exactly, these files automatically support your plugin:

App.tsx - Dynamic plugin detection
panelHandlers.ts - Auto function discovery
panelRendering.tsx - Dynamic props mapping
keyboardHandlers.ts - Plugin-agnostic navigation
PanelTitles.tsx - Config-based titles
PanelFooter.tsx - Dynamic function calls

Automatic Integration Features

✅ Panel opening/closing coordination
✅ Keyboard navigation (Space + Arrow keys)
✅ Form handling and validation
✅ Cross-plugin navigation
✅ Dynamic titles and subtitles
✅ Mobile-responsive rendering
✅ Delete confirmations
✅ Mode transitions (Create → Edit → View)
✅ Security enforcement (auth, CSRF, rate limiting)
✅ Tenant isolation (automatic)

Architecture Benefits
Service Abstraction

Infrastructure swappable - Change providers without code changes
Testing simplified - Mock adapters for fast tests
Security enforced - At adapter level, plugins can't bypass
Deployment flexible - Same code, different infrastructure

Plugin Isolation

Zero conflicts - Plugins don't interfere with each other
Parallel development - Teams work independently
Performance optimized - Only affected components re-render
Easy maintenance - Changes isolated to plugin scope

Security By Default

Multiple layers - Middleware, adapters, business logic
Automatic enforcement - Can't bypass security
Standardized patterns - Same security across all plugins
Audit trail - Built-in logging

Critical Requirements
Backend Security (MANDATORY)
All routes MUST have:
router.post('/',
requirePlugin('my-plugin'), // Authentication
csrfProtection, // CSRF protection
[
body('title').trim().escape(), // Input validation
validateRequest
],
controller.createItem
);
All models MUST use:
const ServiceManager = require('../../server/core/ServiceManager');
const database = ServiceManager.get('database'); // Not direct DB
const logger = ServiceManager.get('logger'); // Not console.log
Frontend Security (MANDATORY)
All mutations MUST include:
headers: {
'X-CSRF-Token': await this.getCsrfToken()
}
All forms MUST have:
// Loading states
const [isSaving, setIsSaving] = useState(false);

// Prevent double submission
if (isSaving) return;

Naming Conventions
Plugin Names

Registry: my-plugins (plural)
Routes: /api/my-plugins
Database: my_plugin_items

Context Properties

Panel open: isMyPluginPanelOpen (plural in name)
Current item: currentMyPluginItem (singular)
Panel mode: panelMode (generic - same for all plugins)
Data array: myPluginItems (plural)

Functions

Open: openMyPluginPanel
Edit: openMyPluginForEdit
View: openMyPluginForView
Close: closeMyPluginPanel
Save: saveMyPlugin
Delete: deleteMyPlugin

Global Functions (PLURAL!)

Submit: window.submitMyPluginsForm
Cancel: window.cancelMyPluginsForm

Common Patterns
File Upload
const storage = ServiceManager.get('storage');

async uploadFile(req, res) {
const fileURL = await storage.upload(
req.file.buffer,
`my-plugin/${itemId}/file.pdf`,
{
allowedTypes: ['application/pdf'],
maxSize: 10 _ 1024 _ 1024
}
);

await database.update('my_plugin_items', itemId, { fileURL });
res.json({ fileURL });
}
Email Notification
const email = ServiceManager.get('email');

async sendNotification(itemId) {
const item = await model.getItemById(itemId);

await email.send({
to: user.email,
subject: `New Item: ${item.title}`,
html: emailTemplate(item)
});

logger.info('Notification sent', { itemId });
}
Bulk Operations
const queue = ServiceManager.get('queue');

async bulkCreate(items) {
const jobId = await queue.add('bulk-create', {
items,
userId: req.session.user.id
});

return { jobId, status: 'queued' };
}

queue.process('bulk-create', async (job) => {
for (const item of job.data.items) {
await model.createItem(item);
}
});
Caching
const cache = ServiceManager.get('cache');

async getItems() {
return await cache.wrap('my-plugin:items', async () => {
return await database.query('SELECT \* FROM items', []);
}, 300); // Cache for 5 minutes
}

Testing Strategy
Unit Tests (Fast)
// Use mock adapters
ServiceManager.override('database', new MockDatabaseAdapter());
ServiceManager.override('storage', new MockStorageAdapter());

// Test business logic
const result = await model.createItem(data);
expect(result).toHaveProperty('id');
Integration Tests (Comprehensive)
// Use real adapters in test environment
const response = await request(app)
.post('/api/my-plugin')
.set('X-CSRF-Token', csrfToken)
.send(data);

expect(response.status).toBe(201);
Security Tests (Critical)
// Test auth required
const response = await request(app).get('/api/my-plugin');
expect(response.status).toBe(401);

// Test CSRF required
const response = await request(app)
.post('/api/my-plugin')
.send(data); // No CSRF token
expect(response.status).toBe(403);

// Test validation
const response = await request(app)
.post('/api/my-plugin')
.set('X-CSRF-Token', token)
.send({ title: '' }); // Invalid
expect(response.status).toBe(400);

Common Issues
Backend
"ServiceManager not found"

Fix: Import from correct path: require('../../server/core/ServiceManager')

"Database query failed"

Fix: Check tenant isolation - don't manually add user_id filter

"CSRF token mismatch"

Fix: Ensure csrfProtection middleware on route

Frontend
"Panel not closing"

Fix: Verify panel registration with correct plugin name

"Global form functions not working"

Fix: Use plural naming: submitMyPluginsForm not submitMyPluginForm

"CSRF error"

Fix: Ensure API layer fetches and includes CSRF token

Success Checklist
Plugin is ready when:

✅ All naming conventions followed exactly
✅ Zero console errors or warnings
✅ All CRUD operations functional
✅ Keyboard navigation works
✅ Mobile/desktop responsive
✅ Panel coordination works
✅ Security middleware on all routes
✅ Input validation implemented
✅ CSRF protection working
✅ Core services used (no direct infrastructure)
✅ Tests passing (unit + integration)
✅ Tenant isolation verified
✅ Plugin registered in pluginRegistry.ts with navigation config
✅ Plugin added to DEFAULT_AVAILABLE_PLUGINS in constants.js
✅ Superadmin has plugin access (admin@homebase.se)
✅ Plugin visible in sidebar for enabled users

Development Best Practices
Backend

✅ Use ServiceManager for ALL infrastructure
✅ Use logger instead of console.log
✅ Throw standardized AppError
✅ No manual tenant filtering
✅ Validate all user input
✅ Audit log sensitive operations

Frontend

✅ Include CSRF token in mutations
✅ Handle loading states
✅ Display user-friendly errors
✅ Sanitize user input
✅ Support keyboard navigation
✅ Implement responsive design

Testing

✅ Use mock adapters for unit tests
✅ Test security requirements
✅ Test edge cases
✅ Test error handling

Conclusion
Modern plugin development:

Service abstraction - Infrastructure swappable
Security enforcement - Multiple layers of protection
Automated integration - Zero manual core updates
Testing simplified - Mock adapters for speed
Deployment flexible - Configuration-driven

Result: Secure, testable, maintainable plugins that integrate automatically.

See Also:

CORE_SERVICES_ARCHITECTURE.md - Service details
SECURITY_GUIDELINES.md - Security requirements
PLUGIN_DEVELOPMENT_STANDARDS_V2.md - Conventions
BACKEND_PLUGIN_GUIDE_V2.md - Backend implementation
FRONTEND_PLUGIN_GUIDE_V2.md - Frontend implementation
REFACTORING_EXISTING_PLUGINS.md - Migration guide
