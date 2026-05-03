// templates/plugin-backend-template/index.js
// V3: PluginSDK context — see plugin-loader.js (single-argument initializer).
const TemplateModel = require('./model');
const TemplateController = require('./controller');
const createTemplateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTemplatePlugin(context) {
  const model = new TemplateModel();
  const controller = new TemplateController(model);
  const router = createTemplateRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTemplatePlugin;
