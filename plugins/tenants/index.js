// plugins/tenants/index.js
const TenantsModel = require('./model');
const TenantsController = require('./controller');
const createTenantsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTenantsPlugin(context) {
  const pool = context.pool;
  if (!pool) {
    throw new Error('Tenants plugin requires context.pool (main DB)');
  }

  const logger = context.services?.logger;
  const model = new TenantsModel(pool);
  const controller = new TenantsController(model, logger);
  const router = createTenantsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTenantsPlugin;
