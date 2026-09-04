// plugins/invoices/routes.js
// Invoices routes with V2 security (CSRF protection and input validation)
const express = require('express');
const { body } = require('express-validator');
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');
const { publicEndpointLimiter } = require('../../server/core/middleware/rateLimit');

function createInvoiceRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const router = express.Router();
  const gate = requirePlugin(config.name); // auth/enablement guard => 'invoices'

  // Core (auth required)
  router.get('/', gate, (req, res) => controller.getInvoices(req, res));

  // Number endpoint MUST be before /:id to avoid route conflicts
  router.get('/number/next', gate, (req, res) => controller.getNextInvoiceNumber(req, res));

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    commonRules.optionalString('orderNumber', 100),
    commonRules.optionalString('deliveryMethod', 100),
    validateRequest,
    (req, res) => controller.createInvoice(req, res),
  );

  // Public (NO auth) — keep before /:id to avoid conflicts
  router.get('/public/:token', publicEndpointLimiter, (req, res) =>
    controller.getPublicInvoice(req, res),
  );
  router.get('/public/:token/pdf', publicEndpointLimiter, (req, res) =>
    controller.generatePublicPDF(req, res),
  );

  // DELETE /api/invoices/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // Payments (before generic /:id mutations that could conflict)
  router.get(
    '/:invoiceId/payments',
    gate,
    commonRules.id('invoiceId'),
    validateRequest,
    (req, res) => controller.getPayments(req, res),
  );
  router.post(
    '/:invoiceId/payments',
    gate,
    csrfProtection,
    commonRules.id('invoiceId'),
    body('amount').isFloat({ gt: 0 }).withMessage('amount must be a number greater than 0'),
    body('paidOn')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('paidOn must be a valid date'),
    commonRules.optionalString('reference', 255),
    validateRequest,
    (req, res) => controller.createPayment(req, res),
  );
  router.delete(
    '/payments/:paymentId',
    gate,
    csrfProtection,
    commonRules.id('paymentId'),
    validateRequest,
    (req, res) => controller.deletePayment(req, res),
  );

  // Item operations (auth required)
  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('contactName', 0, 255).optional(),
    commonRules.optionalString('notes', 5000),
    commonRules.optionalString('orderNumber', 100),
    commonRules.optionalString('deliveryMethod', 100),
    validateRequest,
    (req, res) => controller.updateInvoice(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.deleteInvoice(req, res),
  );

  // PDF (auth required)
  router.get('/:id/pdf', gate, (req, res) => controller.generatePDF(req, res));

  // Shares (auth required) — body fields use requiredId/date (not param id)
  router.post(
    '/shares',
    gate,
    csrfProtection,
    commonRules.requiredId('invoiceId'),
    commonRules.date('validUntil'),
    validateRequest,
    (req, res) => controller.createShare(req, res),
  );

  router.get('/:invoiceId/shares', gate, (req, res) => controller.getShares(req, res));

  router.delete(
    '/shares/:shareId',
    gate,
    csrfProtection,
    commonRules.id('shareId'),
    validateRequest,
    (req, res) => controller.revokeShare(req, res),
  );

  return router;
}

module.exports = createInvoiceRoutes;
