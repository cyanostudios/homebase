// plugins/matches/index.js
// V3: Uses PluginSDK context
const MatchModel = require('./model');
const MatchController = require('./controller');
const createMatchRoutes = require('./routes');
const config = require('./plugin.config');

function initializeMatchesPlugin(context) {
  const model = new MatchModel();
  const controller = new MatchController(model);
  const router = createMatchRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeMatchesPlugin;
