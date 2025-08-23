// templates/plugin-backend-template/index.js
// TEMPLATE: copy this folder to plugins/<your-plugin>/ and then:
// 1) Optionally rename this function to initialize<PluginName>Plugin
// 2) Keep the structure (model/controller/routes/config) identical to Contacts

const TemplateModel = require('./model');
const TemplateController = require('./controller');
const createTemplateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTemplatePlugin(pool, requirePlugin) {
  const model = new TemplateModel(pool);
  const controller = new TemplateController(model);
  const router = createTemplateRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTemplatePlugin;
