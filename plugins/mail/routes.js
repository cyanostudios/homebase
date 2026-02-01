// plugins/mail/routes.js
const express = require('express');
const { body } = require('express-validator');
const { validateRequest } = require('../../server/core/middleware/validation');
const controller = require('./controller');
const config = require('./plugin.config');

function createMailRoutes(context) {
  const router = express.Router();
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.post(
    '/send',
    gate,
    [
      body('subject').trim().notEmpty().withMessage('Subject is required'),
      body('to').custom((val) => {
        if (!val) throw new Error('At least one recipient is required');
        const arr = Array.isArray(val) ? val : [val];
        if (arr.every((r) => !String(r).trim())) throw new Error('At least one valid recipient is required');
        return true;
      }),
    ],
    validateRequest,
    (req, res) => controller.send(req, res)
  );

  router.get('/history', gate, (req, res) => controller.getHistory(req, res));
  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));
  router.post(
    '/test',
    gate,
    [
      body('testTo').trim().notEmpty().withMessage('E-postadress krävs').isEmail().withMessage('Ogiltig e-postadress'),
      body('provider').optional().isIn(['smtp', 'resend']),
      body('host').optional().trim(),
      body('port').optional().isInt({ min: 1, max: 65535 }),
      body('secure').optional().isBoolean(),
      body('authUser').optional().trim(),
      body('authPass').optional(),
      body('fromAddress').optional().trim(),
      body('resendApiKey').optional(),
      body('resendFromAddress').optional().trim(),
      body('useSaved').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.testSettings(req, res)
  );

  router.post(
    '/settings',
    gate,
    [
      body('provider').optional().isIn(['smtp', 'resend']),
      body('host').optional().trim(),
      body('port').optional().isInt({ min: 1, max: 65535 }),
      body('secure').optional().isBoolean(),
      body('authUser').optional().trim(),
      body('authPass').optional(),
      body('fromAddress').optional().trim(),
      body('resendApiKey').optional(),
      body('resendFromAddress').optional().trim(),
    ],
    validateRequest,
    (req, res) => controller.saveSettings(req, res)
  );

  return router;
}

module.exports = createMailRoutes;
