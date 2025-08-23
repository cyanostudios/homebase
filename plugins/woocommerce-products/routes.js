// plugins/woocommerce/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');

function createTemplateRoutes(controller, requirePlugin) {
  const gate = requirePlugin(config.name); // auth/enablement guard

  // ---- Settings ----
  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));
  router.put('/settings', gate, (req, res) => controller.putSettings(req, res));

  // ---- Connection test ----
  router.post('/test', gate, (req, res) => controller.testConnection(req, res));

  // ---- Batch export ----
  router.post('/products/export', gate, (req, res) => controller.exportProducts(req, res));

  // ---- Template parity CRUD (optional) ----
  router.get('/', gate, (req, res) => controller.getAll(req, res));
  router.post('/', gate, (req, res) => controller.create(req, res));
  router.put('/:id', gate, (req, res) => controller.update(req, res));
  router.delete('/:id', gate, (req, res) => controller.delete(req, res));

  return router;
}

module.exports = createTemplateRoutes;
