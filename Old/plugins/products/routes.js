// plugins/products/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');

function createProductRoutes(controller, requirePlugin) {
  const gate = requirePlugin(config.name);

  // NEW: bulk delete (MUST be before '/:id')
  router.delete('/batch', gate, (req, res) => controller.bulkDelete(req, res));
  
  // All routes are mounted under /api/products via plugin.config.js
  router.get('/', gate, (req, res) => controller.getAll(req, res));
  router.post('/', gate, (req, res) => controller.create(req, res));


  router.put('/:id', gate, (req, res) => controller.update(req, res));
  router.delete('/:id', gate, (req, res) => controller.delete(req, res));

  // (valfritt) behåll gammal route om något fortfarande använder den
  // router.post('/bulk-delete', gate, (req, res) => controller.bulkDelete(req, res));

  return router;
}

module.exports = createProductRoutes;
