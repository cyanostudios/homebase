// plugins/files/index.js
const FilesModel = require('./model');
const FilesController = require('./controller');
const createFilesRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFilesPlugin(pool, requirePlugin) {
  const model = new FilesModel(pool);
  const controller = new FilesController(model);
  const router = createFilesRoutes(controller, requirePlugin);

  return { config, router, model, controller };
}

module.exports = initializeFilesPlugin;
