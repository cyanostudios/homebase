// plugins/guides/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');
const {
  PLACE_LIFECYCLE_STATUSES,
  guideStopEditorialStatusBodyRule,
  masterGuideEditorialStatusBodyRule,
  sourceLanguageBodyRule,
  variantTypeBodyRule,
  languageBodyRule,
  publicationStatusBodyRule,
} = require('./validation');

function createGuidesRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.get('/:id/stops', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getStops(req, res),
  );

  router.put(
    '/:id/stops/reorder',
    gate,
    csrfProtection,
    commonRules.id('id'),
    body('stopIds').isArray({ min: 1 }).withMessage('stopIds must be a non-empty array'),
    body('stopIds.*').isString().withMessage('stopIds must contain string ids'),
    validateRequest,
    (req, res) => controller.reorderStops(req, res),
  );

  router.post(
    '/:id/stops',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('title', 1, 255),
    body('canonicalNarrative')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('canonicalNarrative must not exceed 50000 characters'),
    guideStopEditorialStatusBodyRule(),
    validateRequest,
    (req, res) => controller.createStop(req, res),
  );

  router.get(
    '/:id/stops/:stopId',
    gate,
    commonRules.id('id'),
    commonRules.id('stopId'),
    validateRequest,
    (req, res) => controller.getStopById(req, res),
  );

  router.put(
    '/:id/stops/:stopId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    body('title')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('title must be between 1 and 255 characters'),
    body('canonicalNarrative')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('canonicalNarrative must not exceed 50000 characters'),
    guideStopEditorialStatusBodyRule(),
    validateRequest,
    (req, res) => controller.updateStop(req, res),
  );

  router.delete(
    '/:id/stops/:stopId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    validateRequest,
    (req, res) => controller.deleteStop(req, res),
  );

  router.get(
    '/:id/stops/:stopId/variants',
    gate,
    commonRules.id('id'),
    commonRules.id('stopId'),
    validateRequest,
    (req, res) => controller.getVariants(req, res),
  );

  router.post(
    '/:id/stops/:stopId/variants',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    variantTypeBodyRule({ required: true }),
    languageBodyRule({ required: true }),
    body('presentationText')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('presentationText must not exceed 50000 characters'),
    publicationStatusBodyRule(),
    validateRequest,
    (req, res) => controller.createVariant(req, res),
  );

  router.get(
    '/:id/stops/:stopId/variants/:variantId',
    gate,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.getVariantById(req, res),
  );

  router.put(
    '/:id/stops/:stopId/variants/:variantId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    body('presentationText')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('presentationText must not exceed 50000 characters'),
    publicationStatusBodyRule(),
    validateRequest,
    (req, res) => controller.updateVariant(req, res),
  );

  router.delete(
    '/:id/stops/:stopId/variants/:variantId',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.deleteVariant(req, res),
  );

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('displayName', 1, 255),
    body('shortIntro')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('shortIntro must not exceed 5000 characters'),
    body('geographicReference')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 255 })
      .withMessage('geographicReference must not exceed 255 characters'),
    commonRules.optionalEnum('lifecycleStatus', PLACE_LIFECYCLE_STATUSES),
    sourceLanguageBodyRule(),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('displayName', 1, 255),
    body('shortIntro')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('shortIntro must not exceed 5000 characters'),
    body('geographicReference')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 255 })
      .withMessage('geographicReference must not exceed 255 characters'),
    commonRules.optionalEnum('lifecycleStatus', PLACE_LIFECYCLE_STATUSES),
    sourceLanguageBodyRule(),
    masterGuideEditorialStatusBodyRule(),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createGuidesRoutes;
