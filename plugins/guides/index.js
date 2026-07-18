// plugins/guides/index.js
const GuidesModel = require('./model');
const GuidesController = require('./controller');
const createGuidesRoutes = require('./routes');
const config = require('./plugin.config');
const GuideIngestBridgeService = require('./ingest/GuideIngestBridgeService');
const ProductionOrchestrationService = require('./production/ProductionOrchestrationService');
const ContentSourceSettingsModel = require('./sources/ContentSourceSettingsModel');
const { WorkerService } = require('./production/WorkerService');
const { ensureTextProvidersRegistered } = require('./providers/text/registerDefaultProviders');
const {
  ensureTranslationProvidersRegistered,
} = require('./providers/translation/registerDefaultProviders');
const { ensureContentSourcesRegistered } = require('./sources/registerDefaultSources');

let guidesWorker = null;

function initializeGuidesPlugin(context) {
  ensureTextProvidersRegistered();
  ensureTranslationProvidersRegistered();
  ensureContentSourcesRegistered();
  const model = new GuidesModel();
  const ingestBridge = new GuideIngestBridgeService(model);
  const contentSourceSettingsModel = new ContentSourceSettingsModel();
  const productionOrchestration = new ProductionOrchestrationService(model, {
    contentSourceSettingsModel,
  });
  const controller = new GuidesController(
    model,
    ingestBridge,
    productionOrchestration,
    contentSourceSettingsModel,
  );
  const router = createGuidesRoutes(controller, context);

  guidesWorker = new WorkerService(productionOrchestration);
  guidesWorker.start();

  return {
    config,
    router,
    model,
    controller,
    ingestBridge,
    productionOrchestration,
    productionWorker: guidesWorker,
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
