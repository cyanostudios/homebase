const express = require('express');
const { body } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { validateRequest } = require('../../server/core/middleware/validation');
const config = require('./plugin.config');

function createAIProvidersRoutes(controller, context) {
  const router = express.Router();
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/catalog', gate, (req, res) => controller.getCatalog(req, res));

  router.get('/routing', gate, (req, res) => controller.getRouting(req, res));

  router.put(
    '/routing',
    gate,
    csrfProtection,
    [
      body('providerKey').isString().trim().notEmpty(),
      body('model').optional({ values: 'null' }).isString().isLength({ max: 255 }),
    ],
    validateRequest,
    (req, res) => controller.saveGlobalRouting(req, res),
  );

  router.put(
    '/routing/plugins/:pluginKey',
    gate,
    csrfProtection,
    [
      body('providerKey').isString().trim().notEmpty(),
      body('model').optional({ values: 'null' }).isString().isLength({ max: 255 }),
    ],
    validateRequest,
    (req, res) => controller.savePluginRouting(req, res),
  );

  router.delete('/routing/plugins/:pluginKey', gate, csrfProtection, (req, res) =>
    controller.deletePluginRouting(req, res),
  );

  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));

  router.delete('/settings/:providerKey', gate, csrfProtection, (req, res) =>
    controller.deleteSettings(req, res),
  );

  router.put(
    '/settings/:providerKey',
    gate,
    csrfProtection,
    [
      body('enabled').optional().isBoolean(),
      body('apiKey').optional({ values: 'null' }).isString(),
      body('defaultModel').optional().isString().isLength({ min: 1, max: 255 }),
    ],
    validateRequest,
    (req, res) => controller.saveSettings(req, res),
  );

  router.post(
    '/settings/:providerKey/test',
    gate,
    csrfProtection,
    [
      body('apiKey').optional({ values: 'null' }).isString(),
      body('defaultModel').optional().isString().isLength({ min: 1, max: 255 }),
      body('useSaved').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.testSettings(req, res),
  );

  return router;
}

module.exports = createAIProvidersRoutes;
