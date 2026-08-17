// templates/plugin-backend-template/routes.js
// Align with production plugins: context from plugin-loader, shared validation + CSRF hooks.
// List layout (listViewMode / columnCount) persists via AppContext getSettings/updateSettings
// (core user_settings) — do not add a plugin GET/PUT /settings for that.
// Optional: add DELETE /batch with commonRules.requiredArray('ids') before /:id routes (see notes).
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

  return router;
}

module.exports = createTemplateRoutes;
