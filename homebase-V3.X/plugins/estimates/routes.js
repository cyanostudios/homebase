// plugins/estimates/routes.js
// Estimates routes with V2 security (CSRF protection and input validation)
const express = require('express');
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createEstimateRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name); // auth/enablement guard
  const router = express.Router();

  // Regular estimate routes (require authentication via gate middleware)
  router.get('/', gate, (req, res) => controller.getEstimates(req, res));

  router.post(
    '/',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.createEstimate(req, res),
  );

  router.get('/number/next', gate, (req, res) => controller.getNextEstimateNumber(req, res));

  // Statistics routes (must come before /:id to avoid conflicts)
  router.get('/stats/status', gate, (req, res) => controller.getStatusStats(req, res));
  router.get('/stats/reasons/:status', gate, (req, res) => controller.getReasonStats(req, res));

  // Public routes (no authentication required) - MOVED BEFORE /:id to prevent conflicts
  router.get('/public/:token', (req, res) => controller.getPublicEstimate(req, res));

  // DELETE /api/estimates/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    // /* csrfProtection, */ // Temporarily disabled
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.get('/:id', gate, (req, res) => controller.getEstimate(req, res));

  router.put(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.updateEstimate(req, res),
  );

  router.delete(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.deleteEstimate(req, res),
  );

  // PDF generation route (requires authentication)
  router.get('/:id/pdf', gate, (req, res) => controller.generatePDF(req, res));

  // Sharing routes (protected - require authentication)
  router.post(
    '/shares',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.requiredId('estimateId'),
    commonRules.date('validUntil'),
    validateRequest,
    (req, res) => controller.createShare(req, res),
  );

  router.get('/:estimateId/shares', gate, (req, res) => controller.getShares(req, res));

  router.delete(
    '/shares/:shareId',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('shareId'),
    validateRequest,
    (req, res) => controller.revokeShare(req, res),
  );

  return router;
}

module.exports = createEstimateRoutes;
