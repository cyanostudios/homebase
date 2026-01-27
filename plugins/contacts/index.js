// plugins/contacts/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const ContactModel = require('./model');
const ContactController = require('./controller');
const createContactRoutes = require('./routes');
const config = require('./plugin.config');

function initializeContactsPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
  const model = new ContactModel();
  const controller = new ContactController(model);
  const router = createContactRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeContactsPlugin;