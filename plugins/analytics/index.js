const AnalyticsModel = require('./model');
const AnalyticsController = require('./controller');
const createAnalyticsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeAnalyticsPlugin(context) {
  const model = new AnalyticsModel();
  const controller = new AnalyticsController(model);
  const router = createAnalyticsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeAnalyticsPlugin;
