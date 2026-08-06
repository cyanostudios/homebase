// plugins/instructions/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createInstructionRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  const parentValidators = [
    commonRules.plainString('title', 1, 255),
    commonRules.plainString('slug', 1, 255),
    body('description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('description must not exceed 50000 characters'),
    body('featuredImageUrl')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 2000 })
      .withMessage('featuredImageUrl must not exceed 2000 characters'),
    commonRules.optionalString('category', 100),
    commonRules.optionalEnum('publicationStatus', ['draft', 'published']),
    body('steps')
      .optional({ values: 'null' })
      .isArray({ max: 200 })
      .withMessage('steps must be an array with at most 200 items'),
    body('steps.*.title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('each step title must be 1-255 characters'),
    body('steps.*.description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('each step description must not exceed 50000 characters'),
    body('steps.*.sequenceOrder')
      .optional()
      .isInt()
      .withMessage('each step sequenceOrder must be an integer'),
    body('steps.*.imageUrl')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 2000 })
      .withMessage('each step imageUrl must not exceed 2000 characters'),
  ];

  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  router.get('/categories', gate, (req, res) => {
    controller.listCategories(req, res);
  });

  router.post(
    '/categories',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 100),
    validateRequest,
    (req, res) => {
      controller.createCategory(req, res);
    },
  );

  router.put(
    '/categories/reorder',
    gate,
    csrfProtection,
    body('orderedIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('orderedIds must be a non-empty array'),
    validateRequest,
    (req, res) => {
      controller.reorderCategories(req, res);
    },
  );

  router.delete(
    '/categories/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => {
      controller.deleteCategory(req, res);
    },
  );

  router.put(
    '/reorder',
    gate,
    csrfProtection,
    body('category')
      .optional({ nullable: true })
      .custom((value) => value === null || value === undefined || typeof value === 'string')
      .withMessage('category must be a string or null'),
    body('orderedIds')
      .isArray({ min: 1, max: 500 })
      .withMessage('orderedIds must be a non-empty array'),
    validateRequest,
    (req, res) => {
      controller.reorder(req, res);
    },
  );

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) => {
    controller.getById(req, res);
  });

  router.post('/', gate, csrfProtection, ...parentValidators, validateRequest, (req, res) => {
    controller.create(req, res);
  });

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    ...parentValidators,
    validateRequest,
    (req, res) => {
      controller.update(req, res);
    },
  );

  // MUST be before '/:id'
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createInstructionRoutes;
