// templates/plugin-backend-template/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');

function createTemplateRoutes(controller, requirePlugin) {
  const gate = requirePlugin(config.name); // auth/enablement guard for this plugin

  // GET /api/<name>
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  // POST /api/<name>
  router.post('/', gate, (req, res) => controller.create(req, res));

  // PUT /api/<name>/:id
  router.put('/:id', gate, (req, res) => controller.update(req, res));

  // DELETE /api/<name>/:id
  router.delete('/:id', gate, (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createTemplateRoutes;
