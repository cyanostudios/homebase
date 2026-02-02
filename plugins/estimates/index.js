// plugins/estimates/index.js
const EstimateModel = require('./model');
const EstimateController = require('./controller');
const createEstimateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeEstimatesPlugin(context) {
  // V2: Model and controller no longer need pool - ServiceManager provides database service
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