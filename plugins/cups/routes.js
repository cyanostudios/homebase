const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createCupsRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 255),
    commonRules.optionalString('organizer', 255),
    commonRules.optionalString('location', 255),
    commonRules.date('start_date').optional(),
    commonRules.date('end_date').optional(),
    commonRules.optionalString('categories', 1000),
    commonRules.optionalString('description', 20000),
    commonRules.optionalUrl('registration_url', 2000),
    commonRules.optionalUrl('source_url', 2000),
    commonRules.optionalString('source_type', 50),
    commonRules.optionalInteger('ingest_source_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalInteger('ingest_run_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalString('external_id', 255),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    commonRules.optionalString('organizer', 255),
    commonRules.optionalString('location', 255),
    commonRules.date('start_date').optional(),
    commonRules.date('end_date').optional(),
    commonRules.optionalString('categories', 1000),
    commonRules.optionalString('description', 20000),
    commonRules.optionalUrl('registration_url', 2000),
    commonRules.optionalUrl('source_url', 2000),
    commonRules.optionalString('source_type', 50),
    commonRules.optionalInteger('ingest_source_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalInteger('ingest_run_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalString('external_id', 255),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  router.post(
    '/import-from-ingest/:sourceId',
    gate,
    csrfProtection,
    commonRules.id('sourceId'),
    validateRequest,
    (req, res) => controller.importFromIngest(req, res),
  );

  router.post(
    '/:id/restore',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.restore(req, res),
  );

  return router;
}

module.exports = createCupsRoutes;
