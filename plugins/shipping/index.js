const ShippingModel = require('./model');
const ShippingController = require('./controller');
const createShippingRoutes = require('./routes');
const config = require('./plugin.config');

function initializeShippingPlugin(context) {
  const model = new ShippingModel();
  const controller = new ShippingController(model);
  const router = createShippingRoutes(controller, context);

  return { config, router, model, controller };
}

module.exports = initializeShippingPlugin;
