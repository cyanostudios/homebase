// plugins/fyndiq-products/index.js
// V3: Uses PluginSDK context signature

const FyndiqProductsModel = require('./model');
const FyndiqProductsController = require('./controller');
const createFyndiqProductsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFyndiqProductsPlugin(context) {
  const model = new FyndiqProductsModel();
  const controller = new FyndiqProductsController(model);
  const router = createFyndiqProductsRoutes(controller, context);

  return { config, router, model, controller };
}

module.exports = initializeFyndiqProductsPlugin;

