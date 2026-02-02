// server/core/routes/index.js
// Setup all core routes (auth, admin, health, settings)

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');
const settingsRoutes = require('./settings');
const activityLogRoutes = require('./activityLog');

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
  settingsRoutes.setupSettingsRoutes(pool, requireAuth);
  activityLogRoutes.setupActivityLogRoutes(requireAuth);
  healthRoutes.setPluginLoader(pluginLoader);

  // Health check (no auth required)
  app.use('/api', healthRoutes);

  // Auth routes (login, signup, logout)
  app.use('/api/auth', authRoutes);

  // Settings routes (requires auth)
  app.use('/api/settings', settingsRoutes);

  // Activity log routes (requires auth)
  app.use('/api/activity-log', activityLogRoutes);

  // Admin routes (requires superuser)
  app.use('/api/admin', adminRoutes);
}

module.exports = { setupCoreRoutes };
