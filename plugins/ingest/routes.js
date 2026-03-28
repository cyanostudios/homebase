// plugins/ingest/routes.js
const express = require('express');
const { body, query } = require('express-validator');

const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

const SOURCE_TYPES = ['html', 'pdf', 'json', 'xml', 'other'];
const sourceTypeRule = body('sourceType')
  .isIn(SOURCE_TYPES)
  .withMessage(`sourceType must be one of: ${SOURCE_TYPES.join(', ')}`);

function createIngestRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 255),
    body('sourceUrl')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('sourceUrl must be between 1 and 2000 characters')
      .custom((value) => {
        try {
          // eslint-disable-next-line no-new
          new URL(value);
          return true;
        } catch {
          throw new Error('sourceUrl must be a valid URL');
        }
      }),
    sourceTypeRule,
    body('fetchMethod')
      .optional({ values: 'falsy' })
      .isIn(['generic_http'])
      .withMessage('fetchMethod must be generic_http'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('notes')
      .optional({ values: 'falsy' })
      .isLength({ max: 10000 })
      .withMessage('notes must not exceed 10000 characters'),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.get(
    '/:id/runs',
    gate,
    commonRules.id('id'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit must be between 1 and 100'),
    validateRequest,
    (req, res) => controller.getRuns(req, res),
  );

  router.post(
    '/:id/run',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res, next) => controller.runImport(req, res, next),
  );

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    body('sourceUrl')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('sourceUrl must be between 1 and 2000 characters')
      .custom((value) => {
        try {
          // eslint-disable-next-line no-new
          new URL(value);
          return true;
        } catch {
          throw new Error('sourceUrl must be a valid URL');
        }
      }),
    sourceTypeRule,
    body('fetchMethod')
      .optional({ values: 'falsy' })
      .isIn(['generic_http'])
      .withMessage('fetchMethod must be generic_http'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
    body('notes')
      .optional({ values: 'falsy' })
      .isLength({ max: 10000 })
      .withMessage('notes must not exceed 10000 characters'),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createIngestRoutes;
