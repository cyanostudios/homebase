// plugins/clubdesk/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createClubdeskRoutes(
  controller,
  context,
  priceListController,
  siteContentController,
  swishProfileController,
  infoContactController,
) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  // --- Site content (Info page cards): BEFORE /:id ---
  if (siteContentController) {
    router.get('/site-content', gate, (req, res) => {
      siteContentController.getAll(req, res);
    });

    router.put(
      '/site-content',
      gate,
      csrfProtection,
      body('cards')
        .isArray({ min: 1, max: 3 })
        .withMessage('cards must be an array with 1-3 items'),
      body('cards.*.cardKey')
        .isString()
        .isIn(['home', 'info', 'swish'])
        .withMessage('cardKey must be home, info, or swish'),
      body('cards.*.content')
        .optional({ values: 'null' })
        .isString()
        .isLength({ max: 100000 })
        .withMessage('content must not exceed 100000 characters'),
      body('cards.*.meta')
        .optional({ nullable: true })
        .isObject()
        .withMessage('meta must be an object'),
      body('cards.*.meta.title')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 255 })
        .withMessage('meta.title must not exceed 255 characters'),
      validateRequest,
      (req, res) => {
        siteContentController.putBatch(req, res);
      },
    );

    router.put(
      '/site-content/:cardKey',
      gate,
      csrfProtection,
      body('content')
        .optional({ values: 'null' })
        .isString()
        .isLength({ max: 100000 })
        .withMessage('content must not exceed 100000 characters'),
      body('meta').optional({ nullable: true }).isObject().withMessage('meta must be an object'),
      body('meta.title')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 255 })
        .withMessage('meta.title must not exceed 255 characters'),
      validateRequest,
      (req, res) => {
        siteContentController.putOne(req, res);
      },
    );
  }

  // --- Swish profiles (BEFORE /:id) ---
  if (swishProfileController) {
    router.get('/swish-profiles', gate, (req, res) => {
      swishProfileController.getAll(req, res);
    });

    router.post(
      '/swish-profiles',
      gate,
      csrfProtection,
      body('payee')
        .isString()
        .trim()
        .isLength({ min: 1, max: 32 })
        .withMessage('payee is required'),
      body('message')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 50 })
        .withMessage('message must not exceed 50 characters'),
      body('priceListIds')
        .optional({ values: 'null' })
        .isArray({ max: 500 })
        .withMessage('priceListIds must be an array'),
      body('priceListIds.*')
        .optional()
        .isInt({ min: 1 })
        .withMessage('each priceListId must be a positive integer'),
      validateRequest,
      (req, res) => {
        swishProfileController.create(req, res);
      },
    );

    router.get('/swish-profiles/:id', gate, commonRules.id('id'), validateRequest, (req, res) => {
      swishProfileController.getById(req, res);
    });

    router.put(
      '/swish-profiles/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      body('payee')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 32 })
        .withMessage('payee must be 1-32 characters'),
      body('message')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 50 })
        .withMessage('message must not exceed 50 characters'),
      body('priceListIds')
        .optional({ values: 'null' })
        .isArray({ max: 500 })
        .withMessage('priceListIds must be an array'),
      body('priceListIds.*')
        .optional()
        .isInt({ min: 1 })
        .withMessage('each priceListId must be a positive integer'),
      validateRequest,
      (req, res) => {
        swishProfileController.update(req, res);
      },
    );

    router.delete(
      '/swish-profiles/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      validateRequest,
      (req, res) => {
        swishProfileController.remove(req, res);
      },
    );
  }

  // --- Info contacts (BEFORE /:id) ---
  if (infoContactController) {
    router.get('/info-contacts', gate, (req, res) => {
      infoContactController.getAll(req, res);
    });

    router.post(
      '/info-contacts',
      gate,
      csrfProtection,
      body('contactId').isInt({ min: 1 }).withMessage('contactId must be a positive integer'),
      body('blurb')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 500 })
        .withMessage('blurb must not exceed 500 characters'),
      validateRequest,
      (req, res) => {
        infoContactController.create(req, res);
      },
    );

    router.put(
      '/info-contacts/reorder',
      gate,
      csrfProtection,
      body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array'),
      body('orderedIds.*')
        .isInt({ min: 1 })
        .withMessage('each orderedId must be a positive integer'),
      validateRequest,
      (req, res) => {
        infoContactController.reorder(req, res);
      },
    );

    router.get('/info-contacts/:id', gate, commonRules.id('id'), validateRequest, (req, res) => {
      infoContactController.getById(req, res);
    });

    router.put(
      '/info-contacts/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      body('contactId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('contactId must be a positive integer'),
      body('blurb')
        .optional({ values: 'falsy' })
        .isString()
        .isLength({ max: 500 })
        .withMessage('blurb must not exceed 500 characters'),
      validateRequest,
      (req, res) => {
        infoContactController.update(req, res);
      },
    );

    router.delete(
      '/info-contacts/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      validateRequest,
      (req, res) => {
        infoContactController.remove(req, res);
      },
    );
  }

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
    body('featured').optional().isBoolean().withMessage('featured must be a boolean'),
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

  const priceListValidators = [
    commonRules.plainString('title', 1, 255),
    commonRules.plainString('slug', 1, 255),
    body('description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('description must not exceed 50000 characters'),
    commonRules.optionalEnum('publicationStatus', ['draft', 'published']),
    body('featured').optional().isBoolean().withMessage('featured must be a boolean'),
    body('currency')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 10 })
      .withMessage('currency must not exceed 10 characters'),
    body('items')
      .optional({ values: 'null' })
      .isArray({ max: 200 })
      .withMessage('items must be an array with at most 200 items'),
    body('items.*.title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('each item title must be 1-255 characters'),
    body('items.*.description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('each item description must not exceed 50000 characters'),
    body('items.*.price')
      .optional()
      .isFloat({ min: 0, max: 9999999999.99 })
      .withMessage('each item price must be a number between 0 and 9999999999.99'),
    body('items.*.sequenceOrder')
      .optional()
      .isInt()
      .withMessage('each item sequenceOrder must be an integer'),
    body('items.*.category')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 100 })
      .withMessage('each item category must not exceed 100 characters'),
  ];

  // --- Price lists: ALL /price-lists* routes BEFORE /:id ---
  if (priceListController) {
    router.get('/price-lists', gate, (req, res) => {
      priceListController.getAll(req, res);
    });

    router.post(
      '/price-lists',
      gate,
      csrfProtection,
      ...priceListValidators,
      validateRequest,
      (req, res) => {
        priceListController.create(req, res);
      },
    );

    router.put(
      '/price-lists/reorder',
      gate,
      csrfProtection,
      body('orderedIds')
        .isArray({ min: 1, max: 500 })
        .withMessage('orderedIds must be a non-empty array'),
      validateRequest,
      (req, res) => {
        priceListController.reorder(req, res);
      },
    );

    // MUST be before '/price-lists/:id'
    router.delete(
      '/price-lists/batch',
      gate,
      csrfProtection,
      ...commonRules.requiredArray('ids', 500),
      validateRequest,
      (req, res) => priceListController.bulkDelete(req, res),
    );

    router.get(
      '/price-lists/:id/categories',
      gate,
      commonRules.id('id'),
      validateRequest,
      (req, res) => {
        priceListController.listCategories(req, res);
      },
    );

    router.post(
      '/price-lists/:id/categories',
      gate,
      csrfProtection,
      commonRules.id('id'),
      commonRules.plainString('name', 1, 100),
      validateRequest,
      (req, res) => {
        priceListController.createCategory(req, res);
      },
    );

    router.put(
      '/price-lists/:id/categories/reorder',
      gate,
      csrfProtection,
      commonRules.id('id'),
      body('orderedIds')
        .isArray({ min: 1, max: 500 })
        .withMessage('orderedIds must be a non-empty array'),
      validateRequest,
      (req, res) => {
        priceListController.reorderCategories(req, res);
      },
    );

    router.delete(
      '/price-lists/:id/categories/:categoryId',
      gate,
      csrfProtection,
      commonRules.id('id'),
      commonRules.id('categoryId'),
      body('moveToCategory')
        .optional({ nullable: true })
        .custom((value) => value === null || value === undefined || typeof value === 'string')
        .withMessage('moveToCategory must be a string or null'),
      validateRequest,
      (req, res) => {
        priceListController.deleteCategory(req, res);
      },
    );

    router.put(
      '/price-lists/:id/items/reorder',
      gate,
      csrfProtection,
      commonRules.id('id'),
      body('category')
        .optional({ nullable: true })
        .custom((value) => value === null || value === undefined || typeof value === 'string')
        .withMessage('category must be a string or null'),
      body('orderedIds')
        .isArray({ min: 1, max: 500 })
        .withMessage('orderedIds must be a non-empty array'),
      validateRequest,
      (req, res) => {
        priceListController.reorderItems(req, res);
      },
    );

    router.get('/price-lists/:id', gate, commonRules.id('id'), validateRequest, (req, res) => {
      priceListController.getById(req, res);
    });

    router.put(
      '/price-lists/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      ...priceListValidators,
      validateRequest,
      (req, res) => {
        priceListController.update(req, res);
      },
    );

    router.delete(
      '/price-lists/:id',
      gate,
      csrfProtection,
      commonRules.id('id'),
      validateRequest,
      (req, res) => {
        priceListController.delete(req, res);
      },
    );
  }

  // --- Guides ---
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
    body('moveToCategory')
      .optional({ nullable: true })
      .custom((value) => value === null || value === undefined || typeof value === 'string')
      .withMessage('moveToCategory must be a string or null'),
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

  // MUST be before '/:id'
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
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

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) => {
    controller.delete(req, res);
  });

  return router;
}

module.exports = createClubdeskRoutes;
