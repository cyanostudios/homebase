// plugins/pulses/routes.js
const express = require('express');
const { body } = require('express-validator');
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
  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));

  router.post(
    '/test',
    gate,
    [
      body('testTo').trim().notEmpty().withMessage('Phone number is required'),
      body('useSaved').optional().isBoolean(),
      body('activeProvider').optional().isIn(['twilio', 'mock']),
      body('twilioAccountSid').optional().trim(),
      body('twilioAuthToken').optional(),
      body('twilioFromNumber').optional().trim(),
    ],
    validateRequest,
    (req, res) => controller.testSettings(req, res),
  );

  router.post(
    '/settings',
    gate,
    [
      body('activeProvider').optional().isIn(['twilio', 'mock']),
      body('twilioAccountSid').optional().trim(),
      body('twilioAuthToken').optional(),
      body('twilioFromNumber').optional().trim(),
    ],
    validateRequest,
    (req, res) => controller.saveSettings(req, res),
  );

  router.post(
    '/history/delete',
    gate,
    [body('ids').isArray({ min: 1 }).withMessage('At least one ID is required')],
    validateRequest,
    (req, res) => controller.deleteHistory(req, res),
  );

  return router;
}

module.exports = createPulseRoutes;
