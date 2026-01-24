// server/core/config/constants.js
// Centralized constants for the core server

module.exports = {
    // User Roles
    USER_ROLES: {
        USER: 'user',
        SUPERUSER: 'superuser',
    },

    // Default Plugins
    // These are the plugins that exist in the core system or are officially supported.
    // Removed: woocommerce-products, products, rail (not core/valid)
    DEFAULT_AVAILABLE_PLUGINS: [
        'contacts',
        'notes',
        'estimates',
        'tasks',
        'invoices',
        'files',
        'channels',
    ],

    // Default Enabled Plugins for New Users
    DEFAULT_USER_PLUGINS: [
        'contacts',
        'notes',
        'tasks',
        'estimates',
        'invoices',
        'files',
    ],

    // Database Defaults
    DB_DEFAULTS: {
        POOL_MAX: 10,
        IDLE_TIMEOUT: 30000,
        CONNECTION_TIMEOUT: 2000,
    }
};
