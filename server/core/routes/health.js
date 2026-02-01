// server/core/routes/health.js
// Health check and system status endpoint

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');

// Store plugin loader instance (set by Bootstrap)
let pluginLoaderInstance = null;

function setPluginLoader(loader) {
  pluginLoaderInstance = loader;
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
    
    // Get loaded plugins
    const loadedPlugins = pluginLoaderInstance ? pluginLoaderInstance.getAllPlugins() : [];
    
    // Get pool statistics
    const poolStats = connectionPool.getPoolStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      environment: process.env.NODE_ENV,
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
