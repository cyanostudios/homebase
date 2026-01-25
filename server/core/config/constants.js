// server/core/config/constants.js
// Centralized constants for the core server
const fs = require('fs');
const path = require('path');

// Plugins that should NOT be enabled by default for new users
// (e.g., read-only plugins, experimental plugins, or plugins requiring special setup)
const DEFAULT_DISABLED_PLUGINS = ['profixio'];

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

const AVAILABLE_PLUGINS = getAvailablePlugins();

// Default enabled plugins for new users (excludes plugins in DEFAULT_DISABLED_PLUGINS)
const DEFAULT_USER_PLUGINS = AVAILABLE_PLUGINS.filter(
  (plugin) => !DEFAULT_DISABLED_PLUGINS.includes(plugin),
);

module.exports = {
  // User Roles
  USER_ROLES: {
    USER: 'user',
    SUPERUSER: 'superuser',
  },

  // Default Plugins
  // Dynamically populated from filesystem (validated: must have plugin.config.js)
  DEFAULT_AVAILABLE_PLUGINS: AVAILABLE_PLUGINS,

  // Default Enabled Plugins for New Users
  // Excludes plugins in DEFAULT_DISABLED_PLUGINS (e.g., read-only or experimental plugins)
  DEFAULT_USER_PLUGINS: DEFAULT_USER_PLUGINS,

  // Database Defaults
  DB_DEFAULTS: {
    POOL_MAX: 10,
    IDLE_TIMEOUT: 30000,
    CONNECTION_TIMEOUT: 2000,
  },
};
