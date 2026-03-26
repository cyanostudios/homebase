// plugin-loader.js
require('./server/core/polyfills/nodeWebGlobals').applyNodeWebGlobalsPolyfill();

const fs = require('fs');
const path = require('path');
const ServiceManager = require('./server/core/ServiceManager');
const { requireTenantRole } = require('./server/core/middleware/authorization');

class PluginLoader {
  constructor(pool, requirePlugin, requireAuth) {
    this.pool = pool; // Kept for backward compatibility if needed, but should rely on ServiceManager
    this.requirePlugin = requirePlugin;
    this.requireAuth = requireAuth || null;
    this.loadedPlugins = new Map();
  }

  loadPlugins(app) {
    // Check both locations for plugins (root and server/plugins)
    const possibleDirs = [
      path.join(__dirname, 'plugins'),
      path.join(__dirname, 'server', 'plugins'),
    ];

    let pluginsDir = null;
    for (const dir of possibleDirs) {
      if (fs.existsSync(dir)) {
        pluginsDir = dir;
        break;
      }
    }

    if (!pluginsDir) {
      console.log('📁 No plugins directory found, skipping plugin loading');
      return;
    }

    const pluginDirs = fs.readdirSync(pluginsDir).filter((dir) => {
      const pluginPath = path.join(pluginsDir, dir);
      return fs.statSync(pluginPath).isDirectory();
    });

    console.log(`🔌 Loading ${pluginDirs.length} plugins...`);

    pluginDirs.forEach((pluginName) => {
      try {
        this.loadPlugin(app, pluginName, pluginsDir);
      } catch (error) {
        console.error(`❌ Failed to load plugin '${pluginName}':`, error.message);
      }
    });

    console.log(`✅ Successfully loaded ${this.loadedPlugins.size} plugins`);
  }

  loadPlugin(app, pluginName, baseDir) {
    const pluginPath = path.join(baseDir, pluginName);

    // Check if plugin has required files
    const requiredFiles = ['index.js', 'plugin.config.js'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(pluginPath, file))) {
        throw new Error(`Missing required file: ${file}`);
      }
    }

    // Create Plugin Context (SDK)
    // This abstracts the underlying infrastructure
    const context = {
      // Access to Core Services
      services: {
        logger: ServiceManager.get('logger'),
        database: ServiceManager.get('database'), // Tenant-aware database service
        // Add more core services as they become available
      },
      // Database Helpers (Legacy support -> to be deprecated)
      pool: this.pool,
      // Metadata
      pluginName: pluginName,
      // Middleware
      middleware: {
        requirePlugin: this.requirePlugin,
        requireAuth: this.requireAuth,
        requireTenantRole,
      },
    };

    // Load plugin
    const initializePlugin = require(pluginPath);

    // Support both old signature (pool, requirePlugin) and new (context)
    let plugin;
    if (initializePlugin.length === 1) {
      // New Signature: (context) => ...
      plugin = initializePlugin(context);
    } else {
      // Old Signature: (pool, requirePlugin) => ...
      console.warn(
        `⚠️ Plugin '${pluginName}' is using legacy signature. Please update to use PluginSDK.`,
      );
      plugin = initializePlugin(this.pool, this.requirePlugin);
    }

    if (!plugin.config || !plugin.router) {
      throw new Error('Plugin must export config and router');
    }

    // Register routes
    app.use(plugin.config.routeBase, plugin.router);

    // Store loaded plugin
    this.loadedPlugins.set(pluginName, plugin);

    console.log(`🟢 Loaded plugin: ${plugin.config.name} (${plugin.config.routeBase})`);
  }

  getPlugin(name) {
    return this.loadedPlugins.get(name);
  }

  getAllPlugins() {
    return Array.from(this.loadedPlugins.values()).map((plugin) => plugin.config);
  }

  isPluginLoaded(name) {
    return this.loadedPlugins.has(name);
  }
}

module.exports = PluginLoader;
