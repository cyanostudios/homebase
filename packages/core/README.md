# @homebase/core

**Homebase Plugin SDK** - Stable interfaces for building Homebase plugins.

## Overview

This package provides a stable, versioned API for plugins to interact with the Homebase core system. Plugins should **only** import from `@homebase/core`, never directly from server internals.

## Installation

```bash
npm install @homebase/core
```

## Usage

```javascript
const { Logger, Database, Router } = require('@homebase/core');

// In your plugin
class MyPlugin {
  constructor() {
    this.logger = Logger.get();
    this.db = Database.get();
  }

  async getData(req) {
    this.logger.info('Fetching tenant-scoped data');
    const db = Database.get(req);
    return await db.query('SELECT * FROM my_table WHERE category = $1', ['default']);
  }
}
```

## API Reference

### Logger

Structured logging interface.

```javascript
const logger = Logger.get();

logger.info('Message', { key: 'value' });
logger.error('Error message', error, { context: 'data' });
logger.warn('Warning', { userId: 1 });
logger.debug('Debug info', { details: 'here' });
```

### Database

Database query interface with automatic tenant isolation.

```javascript
const db = Database.get(req); // Pass request for tenant context

// Query inside the active tenant context
const results = await db.query('SELECT * FROM items WHERE category = $1', ['electronics']);

// Transaction support
await db.transaction(async (client) => {
  await client.query('INSERT INTO orders ...');
  await client.query('UPDATE inventory ...');
});
```

### Router

Express router wrapper for plugin routes.

```javascript
const router = Router.create();

router.get('/items', async (req, res) => {
  const db = Database.get(req);
  const items = await db.query('SELECT * FROM items');
  res.json({ items });
});

module.exports = router;
```

### Context

Access request context (user, tenant, session).

```javascript
const { Context } = require('@homebase/core');

const userId = Context.getUserId(req);
const tenantId = Context.getTenantId(req);
const isAdmin = Context.isAdmin(req);
```

## Versioning

This SDK follows semantic versioning:

- **Major**: Breaking changes to interfaces
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes

Plugins should specify compatible SDK versions in `package.json`:

```json
{
  "dependencies": {
    "@homebase/core": "^1.0.0"
  }
}
```

## Best Practices

1. **Always use SDK interfaces** - Never import from `../../server/core`
2. **Handle errors gracefully** - SDK methods throw standardized errors
3. **Log important operations** - Use Logger for debugging and monitoring
4. **Respect tenant isolation** - Database routes queries to the active tenant context
5. **Version your plugins** - Specify SDK version compatibility

## Migration from Direct Imports

**Before:**

```javascript
const ServiceManager = require('../../server/core/ServiceManager');
const logger = ServiceManager.get('logger');
```

**After:**

```javascript
const { Logger } = require('@homebase/core');
const logger = Logger.get();
```

## Support

For issues or questions, see the [main documentation](../../docs/PLUGIN_DEVELOPMENT_STANDARDS_V2.md).
