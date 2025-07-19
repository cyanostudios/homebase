# Plugin Architecture Guide v2

## Purpose

This guide outlines a modular plugin architecture for the backend of your Node.js + Express application. The goal is to increase maintainability, scalability, and extensibility by organizing each plugin as an independent module.

## Why Modular Plugins?

### 1. Maintainability

* Easier to debug or extend a single plugin without affecting others.
* Cleaner separation of concerns.

### 2. Scalability

* Teams can work on different plugins in parallel.
* Codebase becomes manageable even with many features.

### 3. Extensibility

* Easy to add/remove plugins per customer.
* Only load what is needed for each deployment.

## Plugin Structure Template

Each plugin resides in its own folder inside `plugins/`:

```bash
plugins/
  contacts/
    routes.js
    controller.js
    model.js
    index.js
    plugin.config.js
  notes/
    routes.js
    controller.js
    model.js
    index.js
    plugin.config.js
```

### `plugin.config.js`

Defines metadata and access control per plugin:

```js
module.exports = {
  name: 'contacts',
  routeBase: '/api/contacts',
  requiredRole: 'user', // optional - restrict access per role
};
```

### `index.js`

Main entry point per plugin:

```js
const express = require('express');
const controller = require('./controller');
const router = require('./routes');

module.exports = {
  router,
  controller,
};
```

### `routes.js` (example)

Defines plugin routes:

```js
const express = require('express');
const router = express.Router();
const controller = require('./controller');
const requirePlugin = require('../../middleware/requirePlugin');

router.get('/', requirePlugin('contacts'), controller.getAll);
router.post('/', requirePlugin('contacts'), controller.create);

module.exports = router;
```

### `server.js` or `plugin-loader.js`

Dynamic plugin loader setup:

```js
const fs = require('fs');
const path = require('path');

function loadPlugins(app) {
  const pluginDirs = fs.readdirSync(path.join(__dirname, 'plugins'));

  pluginDirs.forEach((pluginName) => {
    const pluginPath = path.join(__dirname, 'plugins', pluginName);
    const config = require(path.join(pluginPath, 'plugin.config.js'));
    const { router } = require(pluginPath);
    app.use(config.routeBase, router);
  });
}

module.exports = loadPlugins;
```

In your main `server.js`, call:

```js
const loadPlugins = require('./plugin-loader');
loadPlugins(app);
```

## Dependencies

Ensure the following dependencies are installed:

* `express`
* `fs`, `path`
* Middleware like `requirePlugin` for access control

## Security Integration

Combine this setup with authentication middleware (`requireAuth`, `requirePlugin`) to restrict access to plugin routes per user role.

## Optional: Visual Structure

```text
server.js
plugin-loader.js
plugins/
├── contacts/
│   ├── controller.js
│   ├── index.js
│   ├── model.js
│   ├── plugin.config.js
│   └── routes.js
├── notes/
│   └── ...
```

## Summary

This architecture:

* Keeps each plugin self-contained
* Dynamically loads only required functionality
* Enables easier scaling for multi-customer setups

## Next Steps for New Teams

* Follow this guide to create new plugins.
* Adapt existing plugins into this structure.
* Use this as a base to document shared middleware, context, and database structure.

Let me know if you want code templates, a migration checklist, or integration help.
