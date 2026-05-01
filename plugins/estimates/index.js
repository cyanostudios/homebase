// plugins/estimates/index.js
// V3: PluginSDK context
const EstimateModel = require('./model');
const EstimateController = require('./controller');
const createEstimateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeEstimatesPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
  const model = new EstimateModel();
  const controller = new EstimateController(model);
  const router = createEstimateRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeEstimatesPlugin;
