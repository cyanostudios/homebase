// templates/plugin-backend-template/routes.js
// Align with production plugins: context from plugin-loader, shared validation + CSRF hooks.
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createTemplateRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res, next) => controller.getAll(req, res, next));

  router.get('/settings', gate, (req, res) => {
    res.json({ defaultView: 'list', allowDuplicate: true });
  });

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('title', 1, 255),
    body('description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('description must not exceed 5000 characters'),
    validateRequest,
    (req, res, next) => controller.create(req, res, next),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('title', 1, 255),
    body('description')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 5000 })
      .withMessage('description must not exceed 5000 characters'),
    validateRequest,
    (req, res, next) => controller.update(req, res, next),
  );

  router.delete(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res, next) => controller.delete(req, res, next),
  );

  router.put(
    '/settings',
    gate,
    csrfProtection,
    body('defaultView').isIn(['list', 'grid']).withMessage('defaultView must be list or grid'),
    body('allowDuplicate').isBoolean().withMessage('allowDuplicate must be a boolean'),
    validateRequest,
    (req, res) => res.json(req.body),
  );

  return router;
}

module.exports = createTemplateRoutes;
