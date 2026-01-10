// server/core/routes/index.js
// Setup all core routes (auth, admin, health)

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
  authRoutes.setupAuthRoutes(pool, authLimiter, requireAuth);
  adminRoutes.setupAdminRoutes(pool, requireAuth);
  healthRoutes.setPluginLoader(pluginLoader);

  // Health check (no auth required)
  app.use('/api', healthRoutes);

  // Auth routes (login, signup, logout)
  app.use('/api/auth', authRoutes);

  // Admin routes (requires superuser)
  app.use('/api/admin', adminRoutes);
}

module.exports = { setupCoreRoutes };
