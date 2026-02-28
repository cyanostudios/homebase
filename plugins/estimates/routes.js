// plugins/estimates/routes.js
// Estimates routes with V2 security (CSRF protection and input validation)
const express = require('express');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createEstimateRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const router = express.Router();

  // Regular estimate routes (require authentication via requirePlugin middleware)
  router.get('/', requirePlugin('estimates'), (req, res) => controller.getEstimates(req, res));
  
  router.post('/', 
    requirePlugin('estimates'),
    csrfProtection,
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.createEstimate(req, res)
  );
  
  router.get('/number/next', requirePlugin('estimates'), (req, res) => controller.getNextEstimateNumber(req, res));
  
  // Statistics routes (must come before /:id to avoid conflicts)
  router.get('/stats/status', requirePlugin('estimates'), (req, res) => controller.getStatusStats(req, res));
  router.get('/stats/reasons/:status', requirePlugin('estimates'), (req, res) => controller.getReasonStats(req, res));
  
  // Public routes (no authentication required) - MOVED BEFORE /:id to prevent conflicts
  router.get('/public/:token', (req, res) => controller.getPublicEstimate(req, res));

  // DELETE /api/estimates/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    requirePlugin('estimates'),
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.get('/:id', requirePlugin('estimates'), (req, res) => controller.getEstimate(req, res));
  
  router.put('/:id',
    requirePlugin('estimates'),
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.updateEstimate(req, res)
  );
  
  router.delete('/:id',
    requirePlugin('estimates'),
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.deleteEstimate(req, res)
  );

  // PDF generation route (requires authentication)
  router.get('/:id/pdf', requirePlugin('estimates'), (req, res) => controller.generatePDF(req, res));

  // Sharing routes (protected - require authentication)
  router.post('/shares',
    requirePlugin('estimates'),
    csrfProtection,
    commonRules.id('estimateId'),
    commonRules.date('validUntil'),
    validateRequest,
    (req, res) => controller.createShare(req, res)
  );
  
  router.get('/:estimateId/shares', requirePlugin('estimates'), (req, res) => controller.getShares(req, res));
  
  router.delete('/shares/:shareId',
    requirePlugin('estimates'),
    csrfProtection,
    commonRules.id('shareId'),
    validateRequest,
    (req, res) => controller.revokeShare(req, res)
  );

  return router;
}

module.exports = createEstimateRoutes;
