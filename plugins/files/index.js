// plugins/files/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const FilesModel = require('./model');
const FilesController = require('./controller');
const createFilesRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFilesPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
  const model = new FilesModel();
  const controller = new FilesController(model);
  const router = createFilesRoutes(controller, context);

  // Cloud storage is integrated via routes.js
  return { config, router, model, controller };
}

module.exports = initializeFilesPlugin;
