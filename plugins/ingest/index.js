// plugins/ingest/index.js
const IngestModel = require('./model');
const IngestController = require('./controller');
const createIngestRoutes = require('./routes');
const config = require('./plugin.config');
const ingestService = require('./services/ingestService');

function initializeIngestPlugin(context) {
  const model = new IngestModel();
  const controller = new IngestController(model);
  const router = createIngestRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
    /** For other plugins: require via plugin-loader getPlugin('ingest') or direct path */
    ingestService,
  };
}

module.exports = initializeIngestPlugin;
