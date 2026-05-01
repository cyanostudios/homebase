// plugins/contacts/index.js
// V3: PluginSDK context
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
