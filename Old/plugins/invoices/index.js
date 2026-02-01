const InvoiceModel = require('./model');
const InvoiceController = require('./controller');
const createInvoiceRoutes = require('./routes');
const config = require('./plugin.config');

function initializeInvoicesPlugin(pool, requirePlugin) {
  const model = new InvoiceModel(pool);
  const controller = new InvoiceController(model);
  const router = createInvoiceRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeInvoicesPlugin;
