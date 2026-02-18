// plugins/contacts/routes.js
// Contacts routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const {
  body,
  commonRules,
  param,
  validateRequest,
} = require('../../server/core/middleware/validation');

function createContactRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  router.post(
    '/',
    gate,
    commonRules.string('companyName', 1, 255),
    commonRules.optionalString('email', 255),
    commonRules.email('email').optional(),
    commonRules.optionalString('phone', 50),
    commonRules.phone('phone').optional(),
    commonRules.optionalString('website', 255),
    commonRules.url('website').optional(),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
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
    (req, res) => controller.update(req, res),
  );

  // DELETE /batch - MUST be before '/:id'
  router.delete(
    '/batch',
    gate,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.get('/:id/time-entries', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getTimeEntries(req, res),
  );

  router.post(
    '/:id/time-entries',
    gate,
    commonRules.id('id'),
    body('seconds').isInt({ min: 0 }).toInt().withMessage('seconds must be a non-negative integer'),
    body('loggedAt')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('loggedAt must be a valid ISO 8601 date'),
    validateRequest,
    (req, res) => controller.createTimeEntry(req, res),
  );

  router.delete(
    '/:id/time-entries/:entryId',
    gate,
    param('id').isInt().withMessage('id must be a valid integer'),
    param('entryId').isInt().withMessage('entryId must be a valid integer'),
    validateRequest,
    (req, res) => controller.deleteTimeEntry(req, res),
  );

  router.delete(
    '/:id',
    gate,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.delete(req, res),
  );

  return router;
}

module.exports = createContactRoutes;
