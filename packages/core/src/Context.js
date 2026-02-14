// packages/core/src/Context.js
// Request context utilities for plugins

/**
 * Context utilities for accessing request information
 */
class Context {
  /**
   * Get current user ID from request
   * @param {Object} req - Express request
   * @returns {number|null} User ID
   */
  static getUserId(req) {
    return req.session?.user?.id || null;
  }

  /**
   * Get current tenant user ID (may differ from logged-in user if admin switched)
   * @param {Object} req - Express request
   * @returns {number|null} Tenant user ID
   */
  static getTenantUserId(req) {
    return req.session?.currentTenantUserId || req.session?.user?.id || null;
  }

  /**
   * Get user email
   * @param {Object} req - Express request
   * @returns {string|null} User email
   */
  static getUserEmail(req) {
    return req.session?.user?.email || null;
  }

  /**
   * Get user role (platform-level)
   * @param {Object} req - Express request
   * @returns {string|null} User role
   */
  static getUserRole(req) {
    return req.session?.user?.role || null;
  }

  /**
   * Get tenant role (per-tenant: user, editor, admin)
   * @param {Object} req - Express request
   * @returns {string|null} Tenant role
   */
  static getTenantRole(req) {
    return req.session?.tenantRole || null;
  }

  /**
   * Check if user has at least the given tenant role (hierarchy: user < editor < admin)
   * @param {Object} req - Express request
   * @param {string} role - 'user' | 'editor' | 'admin'
   * @returns {boolean}
   */
  static hasTenantRoleAtLeast(req, role) {
    const order = { user: 0, editor: 1, admin: 2 };
    const userRole = req.session?.tenantRole || 'user';
    return (order[userRole] ?? -1) >= (order[role] ?? 0);
  }

  /**
   * Check if user is admin/superuser
   * @param {Object} req - Express request
   * @returns {boolean} True if admin
   */
  static isAdmin(req) {
    return req.session?.user?.role === 'superuser';
  }

  /**
   * Check if user has access to plugin
   * @param {Object} req - Express request
   * @param {string} pluginName - Plugin name
   * @returns {boolean} True if has access
   */
  static hasPluginAccess(req, pluginName) {
    const plugins = req.session?.user?.plugins || [];
    return plugins.includes(pluginName);
  }

  /**
   * Get all user plugins
   * @param {Object} req - Express request
   * @returns {Array<string>} Plugin names
   */
  static getUserPlugins(req) {
    return req.session?.user?.plugins || [];
  }

  /**
   * Get tenant connection string
   * @param {Object} req - Express request
   * @returns {string|null} Connection string
   */
  static getTenantConnectionString(req) {
    return req.session?.tenantConnectionString || null;
  }

  /**
   * Get full user object
   * @param {Object} req - Express request
   * @returns {Object|null} User object
   */
  static getUser(req) {
    return req.session?.user || null;
  }

  /**
   * Check if user is authenticated
   * @param {Object} req - Express request
   * @returns {boolean} True if authenticated
   */
  static isAuthenticated(req) {
    return !!req.session?.user;
  }
}

module.exports = Context;
