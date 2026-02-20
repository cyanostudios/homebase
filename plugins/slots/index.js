// plugins/slots/index.js
// V3: Uses PluginSDK context
const SlotsModel = require('./model');
const SlotsController = require('./controller');
const createSlotsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeSlotsPlugin(context) {
  const model = new SlotsModel();
  const controller = new SlotsController(model);
  const router = createSlotsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeSlotsPlugin;
