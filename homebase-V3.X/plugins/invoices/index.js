// plugins/invoices/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const InvoiceModel = require('./model');
const InvoiceController = require('./controller');
const createInvoiceRoutes = require('./routes');
const config = require('./plugin.config');

function initializeInvoicesPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
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
