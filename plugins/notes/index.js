// plugins/notes/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const NoteModel = require('./model');
const NoteController = require('./controller');
const createNoteRoutes = require('./routes');
const config = require('./plugin.config');

function initializeNotesPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
  const model = new NoteModel();
  const controller = new NoteController(model);
  const router = createNoteRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeNotesPlugin;