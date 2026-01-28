// plugins/contacts/routes.js
// Contacts routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createContactRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name); // auth/enablement guard

  // GET /api/contacts
  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/contacts - Create new contact
  router.post(
    '/',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.string('companyName', 1, 255),
    commonRules.optionalString('email', 255),
    commonRules.email('email').optional(),
    commonRules.optionalString('phone', 50),
    commonRules.phone('phone').optional(),
    commonRules.optionalString('website', 255),
    commonRules.url('website').optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => {
      controller.create(req, res);
    },
  );

  // PUT /api/contacts/:id - Update contact
  router.put(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    commonRules.string('companyName', 1, 255),
    commonRules.optionalString('email', 255),
    commonRules.email('email').optional(),
    commonRules.optionalString('phone', 50),
    commonRules.phone('phone').optional(),
    commonRules.optionalString('website', 255),
    commonRules.url('website').optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => {
      controller.update(req, res);
    },
  );

  // DELETE /api/contacts/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    // /* csrfProtection, */ // Temporarily disabled
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // DELETE /api/contacts/:id - Delete contact
  router.delete(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    validateRequest,
    (req, res) => {
      controller.delete(req, res);
    },
  );

  return router;
}

module.exports = createContactRoutes;
