// plugins/guides/index.js
const GuidesModel = require('./model');
const GuidesController = require('./controller');
const createGuidesRoutes = require('./routes');
const config = require('./plugin.config');
const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');
const AudioOrchestrationService = require('./audio/AudioOrchestrationService');

function initializeGuidesPlugin(context) {
  ensureAudioProvidersRegistered();
  const model = new GuidesModel();
  const audioOrchestration = new AudioOrchestrationService(model);
  const controller = new GuidesController(model, audioOrchestration);
  const router = createGuidesRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
    audioOrchestration,
  };
}

module.exports = initializeGuidesPlugin;
