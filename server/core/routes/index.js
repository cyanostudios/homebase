// server/core/routes/index.js
// Setup all core routes (auth, admin, health). Settings + activity-log are in plugins/settings.

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');

/**
 * Setup all core routes
 * @param {Express} app - Express application
 * @param {Object} dependencies - Dependencies (pool, middlewares, etc.)
 */
function setupCoreRoutes(app, dependencies) {
  const { pool, authLimiter, requireAuth, pluginLoader } = dependencies;

  // Setup route dependencies
  authRoutes.setupAuthRoutes(pool, authLimiter, requireAuth, pluginLoader);
  adminRoutes.setupAdminRoutes(pool, requireAuth);
  healthRoutes.setPluginLoader(pluginLoader);

  // Health check (no auth required)
  app.use('/api', healthRoutes);

  // Auth routes (login, signup, logout)
  app.use('/api/auth', authRoutes);

  // Settings and activity-log are served by plugins/settings at /api/settings and /api/settings/activity-log

  // Admin routes (requires superuser)
  app.use('/api/admin', adminRoutes);
}

module.exports = { setupCoreRoutes };
