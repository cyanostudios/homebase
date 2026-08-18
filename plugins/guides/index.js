// plugins/guides/index.js
const GuidesModel = require('./model');
const GuidesController = require('./controller');
const createGuidesRoutes = require('./routes');
const config = require('./plugin.config');
const GuideIngestBridgeService = require('./ingest/GuideIngestBridgeService');
const ProductionOrchestrationService = require('./production/ProductionOrchestrationService');
const ContentSourceSettingsModel = require('./sources/ContentSourceSettingsModel');
const { WorkerService } = require('./production/WorkerService');
const ProductionSettingsModel = require('./production/ProductionSettingsModel');
const { ensureTextProvidersRegistered } = require('./providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('./providers/translation/registerDefaultProviders');
const { ensureContentSourcesRegistered } = require('./sources/registerDefaultSources');
const { ensureAudioProvidersRegistered } = require('./audio/registerDefaultProviders');
const AudioOrchestrationService = require('./audio/AudioOrchestrationService');

let guidesWorker = null;

function initializeGuidesPlugin(context) {
  ensureTextProvidersRegistered();
  ensureTranslationProvidersRegistered();
  ensureContentSourcesRegistered();
  ensureAudioProvidersRegistered();
  const model = new GuidesModel();
  const ingestBridge = new GuideIngestBridgeService(model);
  const contentSourceSettingsModel = new ContentSourceSettingsModel();
  const productionSettingsModel = new ProductionSettingsModel();
  const productionOrchestration = new ProductionOrchestrationService(model, {
    contentSourceSettingsModel,
  });
  const audioOrchestration = new AudioOrchestrationService(model);
  guidesWorker = new WorkerService(productionOrchestration, productionSettingsModel);
  const controller = new GuidesController(
    model,
    ingestBridge,
    productionOrchestration,
    contentSourceSettingsModel,
    audioOrchestration,
    productionSettingsModel,
    guidesWorker,
  );
  const router = createGuidesRoutes(controller, context);

  guidesWorker.start();

  return {
    config,
    router,
    model,
    controller,
    ingestBridge,
    productionOrchestration,
    audioOrchestration,
    productionWorker: guidesWorker,
    productionSettingsModel,
  };
}

function shutdownGuidesProductionWorker() {
  if (guidesWorker) {
    guidesWorker.stop();
    guidesWorker = null;
  }
}

module.exports = initializeGuidesPlugin;
module.exports.shutdownGuidesProductionWorker = shutdownGuidesProductionWorker;
