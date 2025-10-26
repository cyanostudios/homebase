const EstimateModel = require('./model');
const InvoiceModel = require('../invoices/model');
const EstimateController = require('./controller');
const createEstimateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeEstimatesPlugin(pool, requirePlugin) {
  const model = new EstimateModel(pool);
  const invoiceModel = new InvoiceModel(pool); // pass to controller
  const controller = new EstimateController(model, invoiceModel);
  const router = createEstimateRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
    invoiceModel,
  };
}

module.exports = initializeEstimatesPlugin;
