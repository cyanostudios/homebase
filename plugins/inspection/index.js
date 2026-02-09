// plugins/inspection/index.js
const createInspectionRoutes = require('./routes');
const config = require('./plugin.config');

function initializeInspectionPlugin(context) {
  const router = createInspectionRoutes(context);

  return {
    config,
    router,
  };
}

module.exports = initializeInspectionPlugin;
