// plugins/contacts/routes.js
// Contacts routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
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

  // Contact lists (must be before /:id routes)
  const listsRouter = express.Router();
  listsRouter.get('/', gate, (req, res) => controller.getLists(req, res));
  listsRouter.post(
    '/',
    gate,
    csrfProtection,
    commonRules.string('name', 1, 255),
    validateRequest,
    (req, res) => controller.createList(req, res),
  );
  listsRouter.get('/:id/contacts', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getListContacts(req, res),
  );
  listsRouter.post(
    '/:id/contacts',
    gate,
    csrfProtection,
    commonRules.id('id'),
    body('contactIds').isArray().withMessage('contactIds must be an array'),
    validateRequest,
    (req, res) => controller.addContactsToList(req, res),
  );
  listsRouter.delete(
    '/:id/contacts/:contactId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('contactId'),
    validateRequest,
    (req, res) => controller.removeContactFromList(req, res),
  );
  listsRouter.put(
    '/:id',
    gate,
    commonRules.id('id'),
    commonRules.string('name', 1, 255),
    validateRequest,
    (req, res) => controller.renameList(req, res),
  );
  listsRouter.delete('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.deleteList(req, res),
  );
  router.use('/lists', listsRouter);

  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.string('companyName', 1, 255),
    commonRules.optionalString('email', 255),
    commonRules.email('email').optional(),
    commonRules.optionalString('phone', 50),
    commonRules.phone('phone').optional(),
    commonRules.optionalUrl('website', 2048),
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
    commonRules.optionalUrl('website', 2048),
    commonRules.optionalString('notes', 5000),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  // DELETE /batch - MUST be before '/:id'
  router.delete(
    '/batch',
    gate,
    csrfProtection,
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
    csrfProtection,
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
    csrfProtection,
    param('id').isInt().withMessage('id must be a valid integer'),
    param('entryId').isInt().withMessage('entryId must be a valid integer'),
    validateRequest,
    (req, res) => controller.deleteTimeEntry(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createContactRoutes;
