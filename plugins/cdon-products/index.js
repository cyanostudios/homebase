// plugins/cdon-products/index.js
// V3: Uses PluginSDK context signature

const CdonProductsModel = require('./model');
const CdonProductsController = require('./controller');
const createCdonProductsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeCdonProductsPlugin(context) {
  const model = new CdonProductsModel();
  const controller = new CdonProductsController(model);
  const router = createCdonProductsRoutes(controller, context);

  return { config, router, model, controller };
}

module.exports = initializeCdonProductsPlugin;

