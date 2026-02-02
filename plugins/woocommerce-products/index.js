// plugins/woocommerce-products/index.js
const WooCommerceModel = require('./model');
const WooCommerceController = require('./controller');
const createWooCommerceRoutes = require('./routes');
const config = require('./plugin.config');

function initializeWooCommerceProductsPlugin(context) {
  // V3: Model no longer needs pool - ServiceManager provides database service
  const model = new WooCommerceModel();
  const controller = new WooCommerceController(model);
  const router = createWooCommerceRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeWooCommerceProductsPlugin;
