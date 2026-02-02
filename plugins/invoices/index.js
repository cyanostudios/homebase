const InvoiceModel = require('./model');
const InvoiceController = require('./controller');
const createInvoiceRoutes = require('./routes');
const config = require('./plugin.config');

function initializeInvoicesPlugin(context) {
  // V2: Model and controller no longer need pool - ServiceManager provides database service
  const model = new InvoiceModel();
  const controller = new InvoiceController(model);
  const router = createInvoiceRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeInvoicesPlugin;
