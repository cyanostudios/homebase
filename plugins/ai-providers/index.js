const { AIProviderSettingsModel } = require('./model');
const { AIProviderRouter } = require('./AIProviderRouter');
const AIProvidersController = require('./controller');
const createAIProvidersRoutes = require('./routes');
const config = require('./plugin.config');

function initializeAIProvidersPlugin(context) {
  const model = new AIProviderSettingsModel();
  const router = new AIProviderRouter({ settingsModel: model });
  const controller = new AIProvidersController(model);
  const expressRouter = createAIProvidersRoutes(controller, context);

  return {
    config,
    router: expressRouter,
    model,
    controller,
    aiProviderRouter: router,
  };
}

module.exports = initializeAIProvidersPlugin;
