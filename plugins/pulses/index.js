// plugins/pulses/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const createPulseRoutes = require('./routes');
const config = require('./plugin.config');

function initializePulsePlugin(context) {
  const router = createPulseRoutes(context);

  return {
    config,
    router,
  };
}

module.exports = initializePulsePlugin;
