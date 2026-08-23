// plugins/garments/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');
const { publicEndpointLimiter } = require('../../server/core/middleware/rateLimit');

function optionalTeamIdBody() {
  return body('teamId')
    .optional({ values: 'null' })
    .customSanitizer((value) => {
      if (value === null || value === undefined || value === '') return null;
      return String(value);
    })
    .custom((value) => {
      if (value === null) return true;
      return /^\d+$/.test(String(value));
    })
    .withMessage('teamId must be a numeric id or null');
}

function optionalContactIdBody() {
  return body('contactId')
    .optional({ values: 'null' })
    .customSanitizer((value) => {
      if (value === null || value === undefined || value === '') return null;
      return String(value);
    })
    .custom((value) => {
      if (value === null) return true;
      return /^\d+$/.test(String(value));
    })
    .withMessage('contactId must be a numeric id or null');
}

function checkboxColumnsBody() {
  return body('checkboxColumns')
    .optional()
    .isArray({ max: 50 })
    .withMessage('checkboxColumns must be an array of at most 50 items');
}

function createGarmentsRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  // Public (no auth)
  router.get('/public/:token', publicEndpointLimiter, (req, res, next) =>
    controller.getPublicList(req, res, next),
  );

  // Shares
  router.post(
    '/shares',
    gate,
    csrfProtection,
    commonRules.requiredId('listId'),
    commonRules.requiredDate('validUntil'),
    validateRequest,
    (req, res, next) => controller.createShare(req, res, next),
  );

  router.get('/lists/:id/shares', gate, commonRules.id('id'), validateRequest, (req, res, next) =>
    controller.getShares(req, res, next),
  );

  router.delete(
    '/shares/:shareId',
    gate,
    csrfProtection,
    commonRules.id('shareId'),
    validateRequest,
    (req, res, next) => controller.revokeShare(req, res, next),
  );

  // Inventory
  router.get('/inventory', gate, (req, res, next) => controller.getInventory(req, res, next));

  const inventoryItemBody = [
    commonRules.plainString('articleName', 1, 255),
    commonRules.optionalString('brand', 255),
    body('description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 10000 })
      .withMessage('description must not exceed 10000 characters'),
    commonRules.optionalString('material', 500),
    body('purchasePrice')
      .optional({ values: 'null' })
      .custom((value) => {
        if (value === null || value === undefined || value === '') return true;
        const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
        return !Number.isNaN(num) && num >= 0;
      })
      .withMessage('purchasePrice must be a number >= 0'),
    commonRules.optionalString('currency', 10),
    body('comment')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 2000 })
      .withMessage('comment must not exceed 2000 characters'),
    body('variants').optional().isArray({ max: 100 }).withMessage('variants must be an array'),
  ];

  const variantBody = [
    commonRules.optionalString('sku', 100),
    commonRules.optionalString('color', 100),
    commonRules.optionalString('size', 100),
    body('quantity').optional().isInt({ min: 0 }).withMessage('quantity must be >= 0'),
    body('sortOrder').optional().isInt({ min: 0 }),
  ];

  router.post(
    '/inventory',
    gate,
    csrfProtection,
    ...inventoryItemBody,
    validateRequest,
    (req, res, next) => controller.createInventoryItem(req, res, next),
  );

  router.get('/inventory/:id', gate, commonRules.id('id'), validateRequest, (req, res, next) =>
    controller.getInventoryItem(req, res, next),
  );

  router.put(
    '/inventory/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    ...inventoryItemBody,
    validateRequest,
    (req, res, next) => controller.updateInventoryItem(req, res, next),
  );

  router.delete(
    '/inventory/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res, next) => controller.deleteInventoryItem(req, res, next),
  );

  router.post(
    '/inventory/:id/variants',
    gate,
    csrfProtection,
    commonRules.id('id'),
    ...variantBody,
    validateRequest,
    (req, res, next) => controller.createInventoryVariant(req, res, next),
  );

  router.put(
    '/inventory/:id/variants/:variantId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('variantId'),
    ...variantBody,
    validateRequest,
    (req, res, next) => controller.updateInventoryVariant(req, res, next),
  );

  router.patch(
    '/inventory/:id/variants/:variantId/quantity',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('variantId'),
    body('quantity').isInt({ min: 0 }).withMessage('quantity must be >= 0'),
    validateRequest,
    (req, res, next) => controller.updateInventoryVariantQuantity(req, res, next),
  );

  router.delete(
    '/inventory/:id/variants/:variantId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res, next) => controller.deleteInventoryVariant(req, res, next),
  );

  // Lists
  router.get('/lists', gate, (req, res, next) => controller.getLists(req, res, next));

  router.get(
    '/lists/for-contact/:contactId',
    gate,
    commonRules.id('contactId'),
    validateRequest,
    (req, res, next) => controller.getListsForContact(req, res, next),
  );

  router.post(
    '/lists',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 255),
    optionalTeamIdBody(),
    checkboxColumnsBody(),
    validateRequest,
    (req, res, next) => controller.createList(req, res, next),
  );

  router.get('/lists/:id', gate, commonRules.id('id'), validateRequest, (req, res, next) =>
    controller.getList(req, res, next),
  );

  router.put(
    '/lists/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    optionalTeamIdBody(),
    checkboxColumnsBody(),
    validateRequest,
    (req, res, next) => controller.updateList(req, res, next),
  );

  router.delete(
    '/lists/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res, next) => controller.deleteList(req, res, next),
  );

  // Persons
  router.get('/lists/:id/persons', gate, commonRules.id('id'), validateRequest, (req, res, next) =>
    controller.getPersons(req, res, next),
  );

  router.post(
    '/lists/:id/persons',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    commonRules.optionalString('shirtSize', 50),
    commonRules.optionalString('shortsSize', 50),
    commonRules.optionalString('socksSize', 50),
    commonRules.optionalString('jerseyNumber', 20),
    commonRules.optionalString('jerseyName', 100),
    commonRules.optionalString('initials', 20),
    body('comment')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 2000 })
      .withMessage('comment must not exceed 2000 characters'),
    body('checkboxValues').optional().isObject(),
    body('sortOrder').optional().isInt({ min: 0 }),
    optionalContactIdBody(),
    validateRequest,
    (req, res, next) => controller.createPerson(req, res, next),
  );

  router.put(
    '/lists/:id/persons/:personId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('personId'),
    commonRules.plainString('name', 1, 255),
    commonRules.optionalString('shirtSize', 50),
    commonRules.optionalString('shortsSize', 50),
    commonRules.optionalString('socksSize', 50),
    commonRules.optionalString('jerseyNumber', 20),
    commonRules.optionalString('jerseyName', 100),
    commonRules.optionalString('initials', 20),
    body('comment')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 2000 })
      .withMessage('comment must not exceed 2000 characters'),
    body('checkboxValues').optional().isObject(),
    body('sortOrder').optional().isInt({ min: 0 }),
    optionalContactIdBody(),
    validateRequest,
    (req, res, next) => controller.updatePerson(req, res, next),
  );

  router.delete(
    '/lists/:id/persons/:personId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('personId'),
    validateRequest,
    (req, res, next) => controller.deletePerson(req, res, next),
  );

  return router;
}

module.exports = createGarmentsRoutes;
