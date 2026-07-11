// plugins/guides/index.js
const GuidesModel = require('./model');
const GuidesController = require('./controller');
const createGuidesRoutes = require('./routes');
const config = require('./plugin.config');
const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');

function initializeGuidesPlugin(context) {
  ensureAudioProvidersRegistered();
  const model = new GuidesModel();
  const controller = new GuidesController(model);
  const router = createGuidesRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeGuidesPlugin;
