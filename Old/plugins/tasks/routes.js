// plugins/tasks/routes.js
const express = require('express');
const router = express.Router();

function createTaskRoutes(controller, requirePlugin) {
  // GET /api/tasks
  router.get('/', requirePlugin('tasks'), (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/tasks
  router.post('/', requirePlugin('tasks'), (req, res) => {
    controller.create(req, res);
  });

  // PUT /api/tasks/:id
  router.put('/:id', requirePlugin('tasks'), (req, res) => {
    controller.update(req, res);
  });

  // DELETE /api/tasks/:id
  router.delete('/:id', requirePlugin('tasks'), (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createTaskRoutes;