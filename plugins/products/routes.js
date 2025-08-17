// plugins/products/routes.js
const express = require('express');
const router = express.Router();

function createProductRoutes(controller, requirePlugin) {
  // All routes are mounted under /api/products via plugin.config.js
  router.get('/', requirePlugin('products'), (req, res) => controller.getAll(req, res));
  router.post('/', requirePlugin('products'), (req, res) => controller.create(req, res));
  router.put('/:id', requirePlugin('products'), (req, res) => controller.update(req, res));
  router.delete('/:id', requirePlugin('products'), (req, res) => controller.delete(req, res));
  return router;
}

module.exports = createProductRoutes;
