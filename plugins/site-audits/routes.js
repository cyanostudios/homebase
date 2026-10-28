// plugins/site-audits/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');
const { validateAuditUrl } = require('./services/urlGuard');

function urlRule() {
  return body('url')
    .trim()
    .isLength({ min: 1, max: 2048 })
    .withMessage('url must be between 1 and 2048 characters')
    .custom((value) => {
      const check = validateAuditUrl(value);
      if (!check.ok) {
        throw new Error(check.error);
      }
      return true;
    });
}

function competitorUrlRule() {
  return body('competitorUrl')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => (value === null || value === undefined ? '' : String(value).trim()))
    .isLength({ max: 2048 })
    .withMessage('competitorUrl must not exceed 2048 characters')
    .custom((value) => {
      if (!value) return true;
      const check = validateAuditUrl(value);
      if (!check.ok) {
        throw new Error(check.error);
      }
      return true;
    });
}

function createSiteAuditRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  const mutateValidators = [
    commonRules.plainString('name', 1, 255),
    urlRule(),
    competitorUrlRule(),
  ];

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.post('/', gate, csrfProtection, ...mutateValidators, validateRequest, (req, res) =>
    controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    ...mutateValidators,
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  // MUST be registered before '/:id' so "batch" is never matched as an :id value.
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // MUST be registered before the bare '/:id' routes below for the same reason.
  router.post(
    '/:id/runs',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.startRun(req, res),
  );

  router.get('/:id/runs', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.listRuns(req, res),
  );

  router.get(
    '/:id/runs/:runId',
    gate,
    commonRules.id('id'),
    commonRules.id('runId'),
    validateRequest,
    (req, res) => controller.getRun(req, res),
  );

  router.post(
    '/:id/runs/:runId/cancel',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.id('runId'),
    validateRequest,
    (req, res) => controller.cancelRun(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createSiteAuditRoutes;
