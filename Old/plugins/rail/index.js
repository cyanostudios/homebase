const createRoutes = require('./routes');
const controller = require('./controller');
const config = require('./plugin.config');

function initializeRailPlugin(pool, requirePlugin) {
  const router = createRoutes(controller, requirePlugin);
  return {
    config,
    router,
    controller,
  };
}

module.exports = initializeRailPlugin;
