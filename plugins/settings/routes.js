// plugins/settings/routes.js
// Mounted at /api/settings - use requireAuth only (settings is always-on)

const express = require('express');
const { param } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { validateRequest } = require('../../server/core/middleware/validation');
const { isAllowedSettingsCategory } = require('./settingsCategories');

function createSettingsRoutes(controller, context) {
  const router = express.Router();
  const requireAuth = context?.middleware?.requireAuth;
  if (!requireAuth) {
    throw new Error('Settings plugin requires requireAuth in context.middleware');
  }

  const categoryParamRule = param('category')
    .trim()
    .custom((value) => {
      if (!isAllowedSettingsCategory(value)) {
        throw new Error('Invalid settings category');
      }
      return true;
    });

  router.get('/activity-log', requireAuth, (req, res) => {
    controller.getActivityLogs(req, res);
  });

  router.delete('/activity-log', requireAuth, csrfProtection, (req, res) => {
    controller.deleteActivityLogs(req, res);
  });

  router.get('/', requireAuth, (req, res) => {
    controller.getAll(req, res);
  });

  router.get('/:category', requireAuth, categoryParamRule, validateRequest, (req, res) => {
    controller.getCategory(req, res);
  });

  router.put(
    '/:category',
    requireAuth,
    csrfProtection,
    categoryParamRule,
    validateRequest,
    (req, res) => {
      controller.updateCategory(req, res);
    },
  );

  return router;
}

module.exports = createSettingsRoutes;
