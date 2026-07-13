// plugins/guides/index.js
const GuidesModel = require('./model');
const GuidesController = require('./controller');
const createGuidesRoutes = require('./routes');
const config = require('./plugin.config');
const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');
const AudioOrchestrationService = require('./audio/AudioOrchestrationService');
const GuideIngestBridgeService = require('./ingest/GuideIngestBridgeService');
const ProductionOrchestrationService = require('./production/ProductionOrchestrationService');
const { ensureTextProvidersRegistered } = require('./providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('./providers/translation/registerDefaultProviders');

function initializeGuidesPlugin(context) {
  ensureAudioProvidersRegistered();
  ensureTextProvidersRegistered();
  ensureTranslationProvidersRegistered();
  const model = new GuidesModel();
  const audioOrchestration = new AudioOrchestrationService(model);
  const ingestBridge = new GuideIngestBridgeService(model);
  const productionOrchestration = new ProductionOrchestrationService(model);
  const controller = new GuidesController(
    model,
    audioOrchestration,
    ingestBridge,
    productionOrchestration,
  );
  const router = createGuidesRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
    audioOrchestration,
    ingestBridge,
    productionOrchestration,
  };
}

module.exports = initializeGuidesPlugin;
