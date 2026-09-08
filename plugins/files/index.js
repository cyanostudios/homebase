// plugins/files/index.js
// V3: PluginSDK context
const {
  ensureStorageProvidersRegistered,
} = require('../../server/core/storage/registerDefaultAdapters');
const FilesModel = require('./model');
const AttachmentModel = require('./attachmentModel');
const FilesService = require('./filesService');
const FilesController = require('./controller');
const CloudStorageModel = require('./cloudStorageModel');
const CloudStorageController = require('./cloudStorageController');
const createFilesRoutes = require('./routes');
const config = require('./plugin.config');

function initializeFilesPlugin(context) {
  ensureStorageProvidersRegistered();

  const model = new FilesModel();
  const attachmentModel = new AttachmentModel();
  const filesService = new FilesService(model, attachmentModel);
  const controller = new FilesController(model, filesService);
  const cloudStorageModel = new CloudStorageModel();
  const cloudStorageController = new CloudStorageController(cloudStorageModel);
  const router = createFilesRoutes(controller, context, { cloudStorageController });

  return { config, router, model, controller };
}

module.exports = initializeFilesPlugin;
