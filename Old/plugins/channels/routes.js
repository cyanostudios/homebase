// plugins/channels/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');

function createChannelsRoutes(controller, requirePlugin) {
  const gate = requirePlugin(config.name); // auth/enablement guard

  // Read-only summaries
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  // Read single product↔channel mapping
  router.get('/map', gate, (req, res) => controller.getProductMap(req, res));

  // Per-product enable/disable (safe SELECT→INSERT/UPDATE)
  // Body: { productId: string, channel: string, enabled: boolean }
  router.put('/map', gate, (req, res) => controller.setProductEnabled(req, res));

  // Non-MVP endpoints kept for parity (return 501 from controller)
  router.post('/', gate, (req, res) => controller.create(req, res));
  router.put('/:id', gate, (req, res) => controller.update(req, res));
  router.delete('/:id', gate, (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createChannelsRoutes;
