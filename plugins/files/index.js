// plugins/files/index.js
const FilesModel = require('./model');
const FilesController = require('./controller');
const createFilesRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFilesPlugin(pool, requirePlugin) {
  // V2: Model and controller no longer need pool - ServiceManager provides database service
  const model = new FilesModel();
  const controller = new FilesController(model);
  const router = createFilesRoutes(controller, requirePlugin);

  return { config, router, model, controller };
}

module.exports = initializeFilesPlugin;
