// plugins/notes/routes.js
const express = require('express');
const router = express.Router();

function createNoteRoutes(controller, requirePlugin) {
  // GET /api/notes
  router.get('/', requirePlugin('notes'), (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/notes
  router.post('/', requirePlugin('notes'), (req, res) => {
    controller.create(req, res);
  });

  // PUT /api/notes/:id
  router.put('/:id', requirePlugin('notes'), (req, res) => {
    controller.update(req, res);
  });

  // DELETE /api/notes/:id
  router.delete('/:id', requirePlugin('notes'), (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createNoteRoutes;