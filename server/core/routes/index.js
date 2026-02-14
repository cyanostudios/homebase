// server/core/routes/index.js
// Setup all core routes (auth, admin, health, team). Settings + activity-log are in plugins/settings.

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');
const teamRoutes = require('./team');

/**
 * Setup all core routes
 * @param {Express} app - Express application
 * @param {Object} dependencies - Dependencies (pool, middlewares, etc.)
 */
function setupCoreRoutes(app, dependencies) {
  const { pool, authLimiter, requireAuth, pluginLoader } = dependencies;

  authRoutes.setupAuthRoutes(pool, authLimiter, requireAuth, pluginLoader);
  adminRoutes.setupAdminRoutes(pool, requireAuth);
  teamRoutes.setupTeamRoutes(requireAuth, pool);
  healthRoutes.setPluginLoader(pluginLoader);

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/team', teamRoutes);
}

module.exports = { setupCoreRoutes };
