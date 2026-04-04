// plugins/files/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const {
  ensureStorageProvidersRegistered,
} = require('../../server/core/storage/registerDefaultAdapters');
const FilesModel = require('./model');
const AttachmentModel = require('./attachmentModel');
const FilesService = require('./filesService');
const FilesController = require('./controller');
const createFilesRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFilesPlugin(context) {
  ensureStorageProvidersRegistered();

  const model = new FilesModel();
  const attachmentModel = new AttachmentModel();
  const filesService = new FilesService(model, attachmentModel);
  const controller = new FilesController(model, filesService);
  const router = createFilesRoutes(controller, context);

  // Cloud storage is integrated via routes.js
  return { config, router, model, controller };
}

module.exports = initializeFilesPlugin;
