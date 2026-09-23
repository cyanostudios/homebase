// server/core/routes/index.js
// Setup all core routes (auth, admin, health, team). Settings + activity-log are in plugins/settings.

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const cronRoutes = require('./cron');
const healthRoutes = require('./health');
const teamRoutes = require('./team');
const organizationRoutes = require('./organization');
const defaultTextsRoutes = require('./defaultTexts');

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
  organizationRoutes.setupOrganizationRoutes(requireAuth, pool);
  defaultTextsRoutes.setupDefaultTextsRoutes(requireAuth, pool);
  healthRoutes.setPluginLoader(pluginLoader);

  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/cron', cronRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/organization', organizationRoutes);
  app.use('/api/default-texts', defaultTextsRoutes);
}

module.exports = { setupCoreRoutes };
