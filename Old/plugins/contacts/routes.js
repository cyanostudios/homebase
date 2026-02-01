// plugins/contacts/routes.js
const express = require('express');
const router = express.Router();

function createContactRoutes(controller, requirePlugin) {
  // GET /api/contacts
  router.get('/', requirePlugin('contacts'), (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/contacts
  router.post('/', requirePlugin('contacts'), (req, res) => {
    controller.create(req, res);
  });

  // PUT /api/contacts/:id
  router.put('/:id', requirePlugin('contacts'), (req, res) => {
    controller.update(req, res);
  });

  // DELETE /api/contacts/:id
  router.delete('/:id', requirePlugin('contacts'), (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createContactRoutes;