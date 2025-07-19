// plugins/estimates/routes.js
const express = require('express');
const router = express.Router();

function createEstimateRoutes(controller, requirePlugin) {
  // GET /api/estimates
  router.get('/', requirePlugin('estimates'), (req, res) => {
    controller.getAll(req, res);
  });

  // GET /api/estimates/next-number
  router.get('/next-number', requirePlugin('estimates'), (req, res) => {
    controller.getNextNumber(req, res);
  });

  // POST /api/estimates
  router.post('/', requirePlugin('estimates'), (req, res) => {
    controller.create(req, res);
  });

  // PUT /api/estimates/:id
  router.put('/:id', requirePlugin('estimates'), (req, res) => {
    controller.update(req, res);
  });

  // DELETE /api/estimates/:id
  router.delete('/:id', requirePlugin('estimates'), (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createEstimateRoutes;