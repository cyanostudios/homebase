const { Pool } = require('pg');
const PublicCupsModel = require('./model');
const PublicCupsController = require('./controller');
const config = require('./plugin.config');
const ServiceManager = require('../../server/core/ServiceManager');

let publicCupsPool = null;

async function initPublicCupsPool() {
  const userId = process.env.PUBLIC_CUPS_USER_ID || process.env.PUBLIC_BOOKING_USER_ID;

  if (!userId) {
    console.warn(
      'PUBLIC_CUPS_USER_ID not set (and no PUBLIC_BOOKING_USER_ID fallback) - public cups disabled',
    );
    return null;
  }

  try {
    const tenantService = ServiceManager.get('tenant');
    const connectionString = await tenantService.getTenantConnection(parseInt(userId, 10));
    const pool = new Pool({ connectionString });
    await pool.query('SELECT 1');
    console.log(`Public cups pool initialized for user ${userId}`);
    return pool;
  } catch (error) {
    console.error('Failed to initialize public cups pool:', error.message);
    return null;
  }
}

function initializePublicCupsPlugin() {
  const model = new PublicCupsModel();
  const controller = new PublicCupsController(model);

  initPublicCupsPool()
    .then((pool) => {
      publicCupsPool = pool;
    })
    .catch((err) => {
      console.error('Failed to init public cups pool:', err);
    });

  const express = require('express');
  const router = express.Router();

  router.use((req, res, next) => {
    req.publicCupsPool = publicCupsPool;
    next();
  });

  router.get('/', (req, res) => controller.getCups(req, res));

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializePublicCupsPlugin;
