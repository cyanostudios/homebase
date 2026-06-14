// plugins/requests/index.js
const express = require('express');
const { Pool } = require('pg');
const RequestModel = require('./model');
const RequestController = require('./controller');
const createRequestRoutes = require('./routes');
const config = require('./plugin.config');
const ServiceManager = require('../../server/core/ServiceManager');

let publicRequestsPool = null;

async function initPublicRequestsPool() {
  const userId = process.env.PUBLIC_REQUESTS_USER_ID;

  if (!userId) {
    console.warn('⚠️  PUBLIC_REQUESTS_USER_ID not set - public request form disabled');
    return null;
  }

  try {
    const tenantService = ServiceManager.get('tenant');
    const connectionString = await tenantService.getTenantConnection(parseInt(userId));

    const pool = new Pool({ connectionString });

    await pool.query('SELECT 1');
    console.log(`✅ Public requests pool initialized for user ${userId}`);

    return pool;
  } catch (error) {
    console.error('❌ Failed to initialize public requests pool:', error.message);
    return null;
  }
}

async function shutdownPublicRequestsPool() {
  if (!publicRequestsPool) {
    return;
  }
  try {
    await publicRequestsPool.end();
  } catch (e) {
    console.warn('requests: pool.end() during shutdown', e?.message || e);
  }
  publicRequestsPool = null;
}

function initializeRequestsPlugin(context) {
  const model = new RequestModel();
  const controller = new RequestController(model);

  initPublicRequestsPool()
    .then((pool) => {
      publicRequestsPool = pool;
    })
    .catch((err) => {
      console.error('Failed to init public requests pool:', err);
    });

  // Outer router: attach pool middleware first, then mount sub-router with all routes
  const outerRouter = express.Router();

  outerRouter.use((req, res, next) => {
    req.publicRequestsPool = publicRequestsPool;
    next();
  });

  const innerRouter = createRequestRoutes(controller, context);
  outerRouter.use('/', innerRouter);

  return {
    config,
    router: outerRouter,
    model,
    controller,
  };
}

module.exports = initializeRequestsPlugin;
module.exports.shutdownPublicRequestsPool = shutdownPublicRequestsPool;
