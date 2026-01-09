// plugins/notes/index.js
// Notes plugin initialization (V2 - uses ServiceManager)
const NoteModel = require('./model');
const NoteController = require('./controller');
const createNoteRoutes = require('./routes');
const config = require('./plugin.config');

function initializeNotesPlugin(pool, requirePlugin) {
  // V2: Model and controller no longer need pool - ServiceManager provides database service
  const model = new NoteModel();
  const controller = new NoteController(model);
  const router = createNoteRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeNotesPlugin;