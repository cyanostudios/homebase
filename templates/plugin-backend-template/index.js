// templates/plugin-backend-template/index.js
// TEMPLATE: copy this folder to plugins/<your-plugin>/ and then:
// 1) Optionally rename this function to initialize<PluginName>Plugin
// 2) Keep the structure (model/controller/routes/config) identical to other plugins
// 3) Uses @homebase/core SDK for service abstraction

const TemplateModel = require('./model');
const TemplateController = require('./controller');
const createTemplateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTemplatePlugin(pool, requirePlugin, csrfProtection, validateRequest) {
  const model = new TemplateModel();
  const controller = new TemplateController(model);
  const router = createTemplateRoutes(controller, requirePlugin, csrfProtection, validateRequest);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTemplatePlugin;
