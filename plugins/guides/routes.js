// plugins/guides/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const {
  body,
  param,
  commonRules,
  validateRequest,
} = require('../../server/core/middleware/validation');
const {
  PLACE_LIFECYCLE_STATUSES,
  masterGuideEditorialStatusBodyRule,
  sourceLanguageBodyRule,
  publicationStatusBodyRule,
  parseLanguage,
} = require('./validation');
const { JOB_TYPES, ITEM_STEPS, CHECKPOINT_MODES } = require('./production/ProductionJobModel');

function languageParamRule() {
  return param('language')
    .exists({ checkFalsy: true })
    .custom((value) => {
      parseLanguage(value);
      return true;
    })
    .withMessage('language must be a valid language code');
}
function createGuidesRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.get('/content-sources', gate, (req, res) => controller.listContentSources(req, res));

  router.put(
    '/content-sources/:sourceKey',
    gate,
    csrfProtection,
    body('enabled').isBoolean().withMessage('enabled must be a boolean'),
    validateRequest,
    (req, res) => controller.updateContentSource(req, res),
  );

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

  router.get('/:id/presentations', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.listPresentations(req, res),
  );

  router.get(
    '/:id/presentations/:language',
    gate,
    commonRules.id('id'),
    languageParamRule(),
    validateRequest,
    (req, res) => controller.getPresentation(req, res),
  );

  router.put(
    '/:id/presentations/:language',
    gate,
    csrfProtection,
    commonRules.id('id'),
    languageParamRule(),
    body('presentationText')
      .optional({ values: 'null' })
      .isString()
      .isLength({ max: 50000 })
      .withMessage('presentationText must not exceed 50000 characters'),
    publicationStatusBodyRule(),
    validateRequest,
    (req, res) => controller.updatePresentation(req, res),
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
