// plugins/contacts/index.js
const ContactModel = require('./model');
const ContactController = require('./controller');
const createContactRoutes = require('./routes');
const config = require('./plugin.config');

function initializeContactsPlugin(pool, requirePlugin) {
  const model = new ContactModel(pool);
  const controller = new ContactController(model);
  const router = createContactRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeContactsPlugin;