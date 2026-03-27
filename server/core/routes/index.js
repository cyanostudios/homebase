// server/core/routes/index.js
// Setup all core routes (auth, admin, health, settings, fx)

const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');
const intakeRoutes = require('./intake');
const settingsRoutes = require('./settings');
const activityLogRoutes = require('./activityLog');
const fxRoutes = require('./fx');
const { startCategoryCacheScheduler } = require('../categoryCacheScheduler');
const { startOrderSyncScheduler } = require('../../../plugins/orders/orderSyncScheduler');

/**
 * Setup all core routes
 * @param {Express} app - Express application
 * @param {Object} dependencies - Dependencies (pool, middlewares, etc.)
 */
function setupCoreRoutes(app, dependencies) {
  const { pool, authLimiter, requireAuth, pluginLoader, csrfProtection } = dependencies;

  // Setup route dependencies
  authRoutes.setupAuthRoutes(pool, authLimiter, requireAuth, pluginLoader, csrfProtection);
  adminRoutes.setupAdminRoutes(pool, requireAuth);
  settingsRoutes.setupSettingsRoutes(pool, requireAuth);
  activityLogRoutes.setupActivityLogRoutes(requireAuth);
  fxRoutes.setupFxRoutes(pool, requireAuth);
  healthRoutes.setPluginLoader(pluginLoader);

  // Health check (no auth required)
  app.use('/api', healthRoutes);

  // Intake webhooks (no auth; validated by x-webhook-secret / body.webhook_secret)
  app.use('/api/intake', intakeRoutes);

  // Auth routes (login, signup, logout)
  app.use('/api/auth', authRoutes);

  // Settings routes (requires auth)
  app.use('/api/settings', settingsRoutes);

  // Activity log routes (requires auth)
  app.use('/api/activity-log', activityLogRoutes);

  // FX rates (requires auth) – Riksbanken cache, 4×/dygn
  app.use('/api/fx', fxRoutes);

  // Admin routes (requires superuser)
  app.use('/api/admin', adminRoutes);

  // Start FX scheduler (fetch on startup + every 6h)
  fxRoutes.startFxScheduler(pool);

  // Start category cache scheduler (CDON/Fyndiq/Woo categories, every 4h)
  startCategoryCacheScheduler(pool);

  // Order sync for all tenants with orders plugin (every 15 min, same as SYNC_INTERVAL_MINUTES)
  startOrderSyncScheduler(pool);
}

module.exports = { setupCoreRoutes };
