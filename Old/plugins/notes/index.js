// plugins/notes/index.js
const NoteModel = require('./model');
const NoteController = require('./controller');
const createNoteRoutes = require('./routes');
const config = require('./plugin.config');

function initializeNotesPlugin(pool, requirePlugin) {
  const model = new NoteModel(pool);
  const controller = new NoteController(model, pool); // Pass pool to controller
  const router = createNoteRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeNotesPlugin;