// plugins/estimates/index.js
const EstimateModel = require('./model');
const EstimateController = require('./controller');
const createEstimateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeEstimatesPlugin(pool, requirePlugin) {
  const model = new EstimateModel(pool);
  const controller = new EstimateController(model);
  const router = createEstimateRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeEstimatesPlugin;