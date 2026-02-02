// plugins/channels/index.js
const ChannelsModel = require('./model');
const ChannelsController = require('./controller');
const createChannelsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeChannelsPlugin(context) {
  // V3: Model no longer needs pool - ServiceManager provides database service
  const model = new ChannelsModel();
  const controller = new ChannelsController(model);
  const router = createChannelsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeChannelsPlugin;
