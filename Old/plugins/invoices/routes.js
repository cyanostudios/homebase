const express = require('express');
const config = require('./plugin.config');

function createInvoiceRoutes(controller, requirePlugin) {
  const router = express.Router();
  const gate = requirePlugin(config.name); // auth/enablement guard => 'invoices'

  // Core (auth required)
  router.get('/', gate, (req, res) => controller.getInvoices(req, res));
  router.post('/', gate, (req, res) => controller.createInvoice(req, res));
  router.get('/number/next', gate, (req, res) => controller.getNextInvoiceNumber(req, res));

  // Public (NO auth) — keep before /:id to avoid conflicts
  router.get('/public/:token', (req, res) => controller.getPublicInvoice(req, res));

  // Item operations (auth required)
  router.put('/:id', gate, (req, res) => controller.updateInvoice(req, res));
  router.delete('/:id', gate, (req, res) => controller.deleteInvoice(req, res));

  // PDF (auth required)
  router.get('/:id/pdf', gate, (req, res) => controller.generatePDF(req, res));

  // Shares (auth required)
  router.post('/shares', gate, (req, res) => controller.createShare(req, res));
  router.get('/:invoiceId/shares', gate, (req, res) => controller.getShares(req, res));
  router.delete('/shares/:shareId', gate, (req, res) => controller.revokeShare(req, res));

  return router;
}

module.exports = createInvoiceRoutes;
