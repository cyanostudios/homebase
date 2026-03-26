const TemplateModel = require('./model');
const TemplateController = require('./controller');
const createTemplateRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTemplatePlugin(pool, requirePlugin, csrfProtection, validateRequest) {
  const model = new TemplateModel(pool);
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
