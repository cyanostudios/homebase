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
  audioStatusBodyRule,
  providerKeyBodyRule,
} = require('./validation');
const { JOB_TYPES, ITEM_STEPS, CHECKPOINT_MODES } = require('./production/ProductionJobModel');

function createGuidesRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.put(
    '/:id/ingest-source',
    gate,
    csrfProtection,
    commonRules.id('id'),
    body('ingestSourceId')
      .optional({ values: 'null' })
      .isString()
      .withMessage('ingestSourceId must be a string id or null'),
    validateRequest,
    (req, res) => controller.setIngestSource(req, res),
  );

  router.get('/:id/source-content', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getSourceContent(req, res),
  );

  router.post(
    '/:id/source-content/refresh',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.refreshSourceContent(req, res),
  );

  router.post(
    '/:id/production-jobs',
    gate,
    csrfProtection,
    commonRules.id('id'),
    body('type')
      .exists({ checkFalsy: true })
      .isIn(JOB_TYPES)
      .withMessage(`type must be one of: ${JOB_TYPES.join(', ')}`),
    body('stopId').optional({ values: 'null' }).isString(),
    body('variantId').optional({ values: 'null' }).isString(),
    body('phases').optional().isArray(),
    body('phases.*').optional().isIn(ITEM_STEPS),
    body('steps').optional().isArray(),
    body('steps.*').optional().isIn(ITEM_STEPS),
    body('checkpointMode').optional().isIn(CHECKPOINT_MODES),
    body('force').optional().isBoolean(),
    body('languages').optional().isArray(),
    body('languages.*').optional().isString(),
    validateRequest,
    (req, res) => controller.createProductionJob(req, res),
  );

  router.get('/:id/production-jobs', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.listProductionJobs(req, res),
  );

  router.get(
    '/:id/production-jobs/:jobId',
    gate,
    commonRules.id('id'),
    commonRules.id('jobId'),
    validateRequest,
    (req, res) => controller.getProductionJob(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/approve-phase',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    body('continue').optional().isBoolean(),
    validateRequest,
    (req, res) => controller.approveProductionJobPhase(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/items/bulk-approve',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    validateRequest,
    (req, res) => controller.bulkApproveProductionJobItems(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/items/:itemId/approve',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    commonRules.id('itemId'),
    validateRequest,
    (req, res) => controller.approveProductionJobItem(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/items/:itemId/reject',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    commonRules.id('itemId'),
    body('reason').optional().isString().isLength({ max: 5000 }),
    validateRequest,
    (req, res) => controller.rejectProductionJobItem(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/items/:itemId/regenerate',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    commonRules.id('itemId'),
    validateRequest,
    (req, res) => controller.regenerateProductionJobItem(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/retry',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    validateRequest,
    (req, res) => controller.retryProductionJob(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/approve',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    validateRequest,
    (req, res) => controller.approveProductionJob(req, res),
  );

  router.post(
    '/:id/production-jobs/:jobId/cancel',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('jobId'),
    validateRequest,
    (req, res) => controller.cancelProductionJob(req, res),
  );

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

  router.post(
    '/:id/stops/:stopId/approve-narrative',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    validateRequest,
    (req, res) => controller.approveStopNarrative(req, res),
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

  router.post(
    '/:id/stops/:stopId/variants/:variantId/approve-content',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.approveVariantContent(req, res),
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

  router.get(
    '/:id/stops/:stopId/variants/:variantId/audio',
    gate,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.getAudio(req, res),
  );

  router.get(
    '/:id/stops/:stopId/variants/:variantId/audio/preview',
    gate,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.previewAudio(req, res),
  );

  router.post(
    '/:id/stops/:stopId/variants/:variantId/audio/generate',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.generateAudio(req, res),
  );

  router.post(
    '/:id/stops/:stopId/variants/:variantId/audio/cancel',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.cancelAudio(req, res),
  );

  router.post(
    '/:id/stops/:stopId/variants/:variantId/audio',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    audioStatusBodyRule(),
    providerKeyBodyRule(),
    body('durationMs')
      .optional({ values: 'null' })
      .isInt({ min: 0 })
      .withMessage('durationMs must be a non-negative integer'),
    body('mimeType')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 100 })
      .withMessage('mimeType must not exceed 100 characters'),
    body('errorMessage')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('errorMessage must not exceed 5000 characters'),
    validateRequest,
    (req, res) => controller.createAudio(req, res),
  );

  router.put(
    '/:id/stops/:stopId/variants/:variantId/audio',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    audioStatusBodyRule(),
    providerKeyBodyRule(),
    body('durationMs')
      .optional({ values: 'null' })
      .isInt({ min: 0 })
      .withMessage('durationMs must be a non-negative integer'),
    body('mimeType')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 100 })
      .withMessage('mimeType must not exceed 100 characters'),
    body('errorMessage')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('errorMessage must not exceed 5000 characters'),
    validateRequest,
    (req, res) => controller.updateAudio(req, res),
  );

  router.delete(
    '/:id/stops/:stopId/variants/:variantId/audio',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('stopId'),
    commonRules.id('variantId'),
    validateRequest,
    (req, res) => controller.deleteAudio(req, res),
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
    body('place').optional({ values: 'null' }).isObject().withMessage('place must be an object'),
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
    body('place').optional({ values: 'null' }).isObject().withMessage('place must be an object'),
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
