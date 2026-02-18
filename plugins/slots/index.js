// plugins/kiosk/index.js
// V3: Uses PluginSDK context
const KioskModel = require('./model');
const KioskController = require('./controller');
const createKioskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeKioskPlugin(context) {
  const model = new KioskModel();
  const controller = new KioskController(model);
  const router = createKioskRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeKioskPlugin;
