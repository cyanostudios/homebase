// plugins/products/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const ProductModel = require('./model');
const ProductController = require('./controller');
const SelloModel = require('./selloModel');
const createProductRoutes = require('./routes');
const config = require('./plugin.config');

function initializeProductsPlugin(context) {
  // V3: Model uses @homebase/core SDK (no pool needed)
  const model = new ProductModel();
  const selloModel = new SelloModel();
  const controller = new ProductController(model, selloModel);
  const router = createProductRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeProductsPlugin;
