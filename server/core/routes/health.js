// server/core/routes/health.js
// Health check and system status endpoint

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const { checkNeonApiForHealth, resolveTenantProvider } = require('../utils/neonApiHealth');

// Store plugin loader instance (set by Bootstrap)
let pluginLoaderInstance = null;

function setPluginLoader(loader) {
  pluginLoaderInstance = loader;
}

async function checkAuthSchema(database) {
  const tables = ['users', 'sessions', 'tenants'];
  const out = {};
  for (const table of tables) {
    try {
      await database.query(`SELECT 1 FROM ${table} LIMIT 1`);
      out[table] = 'ok';
    } catch (err) {
      out[table] = err?.code === '42P01' ? 'missing' : 'error';
      if (err?.message) out[`${table}Error`] = err.message;
    }
  }
  let userCount = null;
  if (out.users === 'ok') {
    try {
      const rows = await database.query('SELECT COUNT(*)::int AS count FROM users');
      const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
      userCount = row?.count ?? null;
    } catch {
      userCount = null;
    }
  }
  const authReady = out.users === 'ok' && out.sessions === 'ok' && out.tenants === 'ok';
  return { authReady, userCount, tables: out };
}

/**
 * Health check endpoint
 * Returns system status, database health, plugin info, and pool statistics
 */
router.get('/health', async (req, res) => {
  try {
    // Get services
    const database = ServiceManager.get('database');
    const connectionPool = ServiceManager.get('connectionPool');

    // Test database connection
    await database.query('SELECT 1');
    const authSchema = await checkAuthSchema(database);
    const tenantProvider = resolveTenantProvider();
    const neonApi = await checkNeonApiForHealth();
    const neonReady = neonApi.status === 'ok' || neonApi.status === 'skipped';

    // Get loaded plugins
    const loadedPlugins = pluginLoaderInstance ? pluginLoaderInstance.getAllPlugins() : [];

    // Get pool statistics
    const poolStats = connectionPool.getPoolStats();

    const fullyHealthy = authSchema.authReady && neonReady;
    const status = fullyHealthy ? 'healthy' : 'degraded';

    res.status(fullyHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      authSchema,
      neonApi,
      environment: process.env.NODE_ENV,
      tenantProvider,
      plugins: loadedPlugins.map((p) => ({ name: p.name, route: p.routeBase })),
      pools: poolStats,
      memory: {
        heapUsed: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
module.exports.setPluginLoader = setPluginLoader;
