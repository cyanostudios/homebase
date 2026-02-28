// plugins/invoices/routes.js
// Invoices routes with V2 security (CSRF protection and input validation)
const express = require('express');
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createInvoiceRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const router = express.Router();
  const gate = requirePlugin(config.name); // auth/enablement guard => 'invoices'

  // Core (auth required)
  router.get('/', gate, (req, res) => controller.getInvoices(req, res));
  
  // Number endpoint MUST be before /:id to avoid route conflicts
  router.get('/number/next', gate, (req, res) => controller.getNextInvoiceNumber(req, res));
  
  router.post('/',
    gate,
    csrfProtection,
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.createInvoice(req, res)
  );

  // Public (NO auth) — keep before /:id to avoid conflicts
  router.get('/public/:token', (req, res) => controller.getPublicInvoice(req, res));

  // DELETE /api/invoices/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // Item operations (auth required)
  router.put('/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.updateInvoice(req, res)
  );
  
  router.delete('/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.deleteInvoice(req, res)
  );

  // PDF (auth required)
  router.get('/:id/pdf', gate, (req, res) => controller.generatePDF(req, res));

  // Shares (auth required)
  router.post('/shares',
    gate,
    csrfProtection,
    commonRules.id('invoiceId'),
    commonRules.date('validUntil'),
    validateRequest,
    (req, res) => controller.createShare(req, res)
  );
  
  router.get('/:invoiceId/shares', gate, (req, res) => controller.getShares(req, res));
  
  router.delete('/shares/:shareId',
    gate,
    csrfProtection,
    commonRules.id('shareId'),
    validateRequest,
    (req, res) => controller.revokeShare(req, res)
  );

  return router;
}

module.exports = createInvoiceRoutes;
