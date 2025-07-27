const express = require('express');

function createEstimateRoutes(controller, requirePlugin) {
  const router = express.Router();

  // Regular estimate routes (require authentication via requirePlugin middleware)
  router.get('/', requirePlugin('estimates'), (req, res) => controller.getEstimates(req, res));
  router.post('/', requirePlugin('estimates'), (req, res) => controller.createEstimate(req, res));
  router.get('/number/next', requirePlugin('estimates'), (req, res) => controller.getNextEstimateNumber(req, res));
  router.get('/:id', requirePlugin('estimates'), (req, res) => controller.getEstimate(req, res));
  router.put('/:id', requirePlugin('estimates'), (req, res) => controller.updateEstimate(req, res));
  router.delete('/:id', requirePlugin('estimates'), (req, res) => controller.deleteEstimate(req, res));

  // PDF generation route (requires authentication)
  router.get('/:id/pdf', requirePlugin('estimates'), (req, res) => controller.generatePDF(req, res));

  // Sharing routes (protected - require authentication)
  router.post('/shares', requirePlugin('estimates'), (req, res) => controller.createShare(req, res));
  router.get('/:estimateId/shares', requirePlugin('estimates'), (req, res) => controller.getShares(req, res));
  router.delete('/shares/:shareId', requirePlugin('estimates'), (req, res) => controller.revokeShare(req, res));

  // Public routes (no authentication required)
  router.get('/public/:token', (req, res) => controller.getPublicEstimate(req, res));

  return router;
}

module.exports = createEstimateRoutes;