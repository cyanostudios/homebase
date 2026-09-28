// server/core/config/constants.js
// Centralized constants for the core server
const fs = require('fs');
const path = require('path');

// Plugins not auto-granted on signup (enable per tenant: set-tenant-plugins --enable=mail).
// `tenants` is platform-admin only (code allowlist) — never grant via signup or AVAILABLE list.
const DEFAULT_DISABLED_PLUGINS = ['mail', 'tenants'];

// Dynamically discover available plugins
// Only includes directories that contain a valid plugin.config.js file
const getAvailablePlugins = () => {
  const plugins = new Set();

  // Helper to check if a directory is a valid plugin
  const isValidPlugin = (pluginPath) => {
    const configPath = path.join(pluginPath, 'plugin.config.js');
    return fs.existsSync(configPath);
  };

  // Check main plugins directory (../../../plugins from server/core/config/constants.js)
  // Structure: root/server/core/config/constants.js -> root/plugins
  const pluginsDir = path.join(__dirname, '../../../plugins');
  if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => isValidPlugin(path.join(pluginsDir, dirent.name)))
      .forEach((dirent) => plugins.add(dirent.name));
  }

  // Check server-internal plugins directory (root/server/plugins)
  const serverPluginsDir = path.join(__dirname, '../../plugins');
  if (fs.existsSync(serverPluginsDir)) {
    fs.readdirSync(serverPluginsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .filter((dirent) => isValidPlugin(path.join(serverPluginsDir, dirent.name)))
      .forEach((dirent) => plugins.add(dirent.name));
  }

  return Array.from(plugins).sort(); // Sort for consistent ordering
};

const ALL_DISCOVERED_PLUGINS = getAvailablePlugins();

const AVAILABLE_PLUGINS = ALL_DISCOVERED_PLUGINS.filter(
  (plugin) => !DEFAULT_DISABLED_PLUGINS.includes(plugin),
);

// Signup always grants Main-category plugins + files (Tools). Extra plugins: set-tenant-plugins.
const DEFAULT_USER_PLUGINS = ['contacts', 'notes', 'tasks', 'requests', 'files'];

module.exports = {
  // User Roles (platform-level)
  USER_ROLES: {
    USER: 'user',
    SUPERUSER: 'superuser',
  },

  // Tenant Roles (per-tenant: User, Editor, Admin)
  TENANT_ROLES: {
    USER: 'user',
    EDITOR: 'editor',
    ADMIN: 'admin',
  },

  // All plugins on disk (including DEFAULT_DISABLED_PLUGINS) — for superuser nav
  ALL_DISCOVERED_PLUGINS,

  // Default Plugins
  // Dynamically populated from filesystem (validated: must have plugin.config.js)
  DEFAULT_AVAILABLE_PLUGINS: AVAILABLE_PLUGINS,

  // Default enabled plugins for new signups (Main + files). Extra plugins via set-tenant-plugins.
  DEFAULT_USER_PLUGINS: DEFAULT_USER_PLUGINS,

  // Database Defaults
  DB_DEFAULTS: {
    POOL_MAX: 10,
    IDLE_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 2000,
  },
};

// Re-export platform tenants admin allowlist helpers for convenience
Object.assign(module.exports, require('./platformTenantsAdmin'));
