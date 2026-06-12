// server/core/routes/health.js
// Health check and system status endpoint

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const { isSystemEmailConfigured } = require('../services/auth/PasswordResetService');
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

async function checkPasswordResetSchema(database) {
  try {
    await database.query('SELECT 1 FROM password_reset_tokens LIMIT 1');
    return { table: 'ok' };
  } catch (err) {
    return {
      table: err?.code === '42P01' ? 'missing' : 'error',
    };
  }
}

function isSuperuser(req) {
  return req.session?.user?.role === 'superuser';
}

/**
 * Health check endpoint
 * Public callers receive minimal status; superusers receive full diagnostics.
 */
router.get('/health', async (req, res) => {
  try {
    const database = ServiceManager.get('database');
    await database.query('SELECT 1');

    if (!isSuperuser(req)) {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }

    const connectionPool = ServiceManager.get('connectionPool');
    const authSchema = await checkAuthSchema(database);
    const passwordReset = await checkPasswordResetSchema(database);
    const systemEmail = {
      configured: isSystemEmailConfigured(),
      provider: process.env.RESEND_API_KEY
        ? 'resend'
        : process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
          ? 'smtp'
          : null,
    };
    const tenantProvider = resolveTenantProvider();
    const neonApi = await checkNeonApiForHealth();
    const neonReady = neonApi.status === 'ok' || neonApi.status === 'skipped';
    const loadedPlugins = pluginLoaderInstance ? pluginLoaderInstance.getAllPlugins() : [];
    const poolStats = connectionPool.getPoolStats();
    const fullyHealthy = authSchema.authReady && neonReady;
    const status = fullyHealthy ? 'healthy' : 'degraded';

    res.status(fullyHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      authSchema,
      passwordReset,
      systemEmail,
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
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
module.exports.setPluginLoader = setPluginLoader;
