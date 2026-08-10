// plugins/pulses/routes.js
const express = require('express');
const { body } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { validateRequest } = require('../../server/core/middleware/validation');
const controller = require('./controller');
const config = require('./plugin.config');

function createPulseRoutes(context) {
  const router = express.Router();
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.post(
    '/send',
    gate,
    csrfProtection,
    [
      body('to').trim().notEmpty().withMessage('Recipient (to) is required'),
      body('body').optional(),
      body('pluginSource').optional().trim(),
      body('referenceId').optional().trim(),
    ],
    validateRequest,
    (req, res) => controller.send(req, res),
  );

  router.get('/history', gate, (req, res) => controller.getHistory(req, res));

  router.get('/providers/catalog', gate, (req, res) => controller.getCatalog(req, res));
  router.get('/providers/settings', gate, (req, res) => controller.getProviderSettings(req, res));
  router.get('/providers/routing', gate, (req, res) => controller.getRouting(req, res));

  router.put(
    '/providers/routing',
    gate,
    csrfProtection,
    [body('providerKey').isString().trim().notEmpty()],
    validateRequest,
    (req, res) => controller.saveGlobalRouting(req, res),
  );

  router.put(
    '/providers/routing/plugins/:pluginKey',
    gate,
    csrfProtection,
    [body('providerKey').isString().trim().notEmpty()],
    validateRequest,
    (req, res) => controller.savePluginRouting(req, res),
  );

  router.delete('/providers/routing/plugins/:pluginKey', gate, csrfProtection, (req, res) =>
    controller.deletePluginRouting(req, res),
  );

  router.put(
    '/providers/settings/:providerKey',
    gate,
    csrfProtection,
    [
      body('enabled').optional().isBoolean(),
      body('secretPrimary').optional({ values: 'null' }).isString(),
      body('secretSecondary').optional({ values: 'null' }).isString(),
      body('options').optional().isObject(),
      body('fields').optional().isObject(),
    ],
    validateRequest,
    (req, res) => controller.saveProviderSettings(req, res),
  );

  router.delete('/providers/settings/:providerKey', gate, csrfProtection, (req, res) =>
    controller.deleteProviderSettings(req, res),
  );

  router.post(
    '/providers/settings/:providerKey/test',
    gate,
    csrfProtection,
    [
      body('testTo').trim().notEmpty().withMessage('Phone number is required'),
      body('useSaved').optional().isBoolean(),
      body('secretPrimary').optional({ values: 'null' }).isString(),
      body('secretSecondary').optional({ values: 'null' }).isString(),
      body('options').optional().isObject(),
      body('fields').optional().isObject(),
      body('fromNumber').optional().trim(),
    ],
    validateRequest,
    (req, res) => controller.testProviderSettings(req, res),
  );

  router.post(
    '/history/delete',
    gate,
    csrfProtection,
    [body('ids').isArray({ min: 1 }).withMessage('At least one ID is required')],
    validateRequest,
    (req, res) => controller.deleteHistory(req, res),
  );

  return router;
}

module.exports = createPulseRoutes;
