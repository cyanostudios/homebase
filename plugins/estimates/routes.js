const express = require('express');

function createEstimateRoutes(controller, requirePlugin) {
  const router = express.Router();
  const gateEstimates = requirePlugin('estimates');
  const gateInvoices = requirePlugin('invoices'); // require invoices access too

  // Regular routes
  router.get('/', gateEstimates, (req, res) => controller.getEstimates(req, res));
  router.post('/', gateEstimates, (req, res) => controller.createEstimate(req, res));
  router.get('/number/next', gateEstimates, (req, res) => controller.getNextEstimateNumber(req, res));

  // Stats (before /:id)
  router.get('/stats/status', gateEstimates, (req, res) => controller.getStatusStats(req, res));
  router.get('/stats/reasons/:status', gateEstimates, (req, res) => controller.getReasonStats(req, res));

  // Public (before /:id)
  router.get('/public/:token', (req, res) => controller.getPublicEstimate(req, res));

  // Convert to invoice (MUST be before /:id)
  router.post('/:id/convert-to-invoice', gateEstimates, gateInvoices, (req, res) => controller.convertToInvoice(req, res));

  // Item ops
  router.get('/:id', gateEstimates, (req, res) => controller.getEstimate(req, res));
  router.put('/:id', gateEstimates, (req, res) => controller.updateEstimate(req, res));
  router.delete('/:id', gateEstimates, (req, res) => controller.deleteEstimate(req, res));

  // PDF
  router.get('/:id/pdf', gateEstimates, (req, res) => controller.generatePDF(req, res));

  // Sharing
  router.post('/shares', gateEstimates, (req, res) => controller.createShare(req, res));
  router.get('/:estimateId/shares', gateEstimates, (req, res) => controller.getShares(req, res));
  router.delete('/shares/:shareId', gateEstimates, (req, res) => controller.revokeShare(req, res));

  return router;
}

module.exports = createEstimateRoutes;
