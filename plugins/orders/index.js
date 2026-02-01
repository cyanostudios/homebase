// plugins/orders/index.js
// Orders plugin initialization (V3 signature)

const OrdersModel = require('./model');
const OrdersController = require('./controller');
const createOrdersRoutes = require('./routes');
const config = require('./plugin.config');

function initializeOrdersPlugin(context) {
  const model = new OrdersModel();
  const controller = new OrdersController(model);
  const router = createOrdersRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeOrdersPlugin;

